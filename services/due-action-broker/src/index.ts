import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import * as fs from "node:fs";
import * as net from "node:net";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ActionRequestSchema,
  ActionResponseSchema,
  AuditLogSchema,
  type BrokerErrorCode,
} from "../../../packages/action-contracts/index";
import { describeProcess as defaultDescribeProcess } from "./pm2-adapter";

export const SOCKET_PATH = "/run/due-action-broker/broker.sock";
const BUILD_VERSION = process.env.BUILD_VERSION || "1.0.0-r2a";
const UuidSchema = z.string().uuid();

type RawRecord = Record<string, unknown>;
type SocketProbe = (socketPath: string) => Promise<boolean>;

function asRecord(value: unknown): RawRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : null;
}

function safeRequestId(body: RawRecord | null): string {
  const candidate = body?.requestId;
  return UuidSchema.safeParse(candidate).success ? (candidate as string) : randomUUID();
}

function writeAudit(input: {
  requestId: string;
  actorId: string;
  actorRole: string;
  action: string;
  target: string;
  success: boolean;
  latencyMs: number;
  errorCode?: BrokerErrorCode;
}): void {
  const parsed = AuditLogSchema.safeParse({
    schema: "audit.1.0",
    timestamp: new Date().toISOString(),
    requestId: input.requestId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    target: input.target,
    success: input.success,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    errorCode: input.errorCode,
    brokerPid: process.pid,
    buildVersion: BUILD_VERSION,
  });

  if (parsed.success) {
    process.stdout.write(`${JSON.stringify(parsed.data)}\n`);
    return;
  }

  process.stderr.write(
    `${JSON.stringify({
      schema: "audit.failure.1.0",
      timestamp: new Date().toISOString(),
      requestId: input.requestId,
      error: "AUDIT_VALIDATION_FAILED",
    })}\n`,
  );
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  requestId: string,
  code: BrokerErrorCode,
  message: string,
) {
  return reply.code(statusCode).send(
    ActionResponseSchema.parse({
      schemaVersion: "1.0",
      requestId,
      timestamp: new Date().toISOString(),
      error: { code, message },
    }),
  );
}

export const buildApp = (describeProcessFn = defaultDescribeProcess): FastifyInstance => {
  const fastify = Fastify({ logger: false });

  fastify.post("/v1/actions", async (request, reply) => {
    const startedAt = Date.now();
    const rawBody = asRecord(request.body);
    const requestId = safeRequestId(rawBody);
    let actorId = "unknown";
    let actorRole = "unknown";
    let action = "unknown";
    let target = "unknown";

    const rawAction = rawBody?.action;
    if (typeof rawAction === "string" && rawAction !== "service.inspect") {
      writeAudit({
        requestId,
        actorId,
        actorRole,
        action,
        target,
        success: false,
        latencyMs: Date.now() - startedAt,
        errorCode: "FORBIDDEN_ACTION",
      });
      return sendError(reply, 403, requestId, "FORBIDDEN_ACTION", "Action is not allowlisted");
    }

    const rawTarget = rawBody?.target;
    if (typeof rawTarget === "string" && rawTarget !== "pianodivino-ui") {
      writeAudit({
        requestId,
        actorId,
        actorRole,
        action: rawAction === "service.inspect" ? rawAction : action,
        target,
        success: false,
        latencyMs: Date.now() - startedAt,
        errorCode: "FORBIDDEN_TARGET",
      });
      return sendError(reply, 403, requestId, "FORBIDDEN_TARGET", "Target is not allowlisted");
    }

    const parsedRequest = ActionRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      writeAudit({
        requestId,
        actorId,
        actorRole,
        action,
        target,
        success: false,
        latencyMs: Date.now() - startedAt,
        errorCode: "INVALID_REQUEST",
      });
      return sendError(reply, 400, requestId, "INVALID_REQUEST", "Invalid payload schema");
    }

    const parsed = parsedRequest.data;
    actorId = parsed.actor.id;
    actorRole = parsed.actor.role;
    action = parsed.action;
    target = parsed.target;

    try {
      const processStatus = await describeProcessFn(parsed.target);
      if (!processStatus) {
        writeAudit({
          requestId,
          actorId,
          actorRole,
          action,
          target,
          success: false,
          latencyMs: Date.now() - startedAt,
          errorCode: "SERVICE_NOT_FOUND",
        });
        return sendError(reply, 404, requestId, "SERVICE_NOT_FOUND", "Process not found");
      }

      const response = ActionResponseSchema.parse({
        schemaVersion: "1.0",
        requestId,
        timestamp: new Date().toISOString(),
        result: processStatus,
      });
      writeAudit({
        requestId,
        actorId,
        actorRole,
        action,
        target,
        success: true,
        latencyMs: Date.now() - startedAt,
      });
      return reply.code(200).send(response);
    } catch {
      writeAudit({
        requestId,
        actorId,
        actorRole,
        action,
        target,
        success: false,
        latencyMs: Date.now() - startedAt,
        errorCode: "PM2_UNAVAILABLE",
      });
      return sendError(
        reply,
        503,
        requestId,
        "PM2_UNAVAILABLE",
        "PM2 is unavailable or timed out",
      );
    }
  });

  return fastify;
};

export const probeSocketActive: SocketProbe = async (socketPath) =>
  new Promise((resolve) => {
    const socket = net.createConnection(socketPath);
    let settled = false;

    const finish = (active: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(active);
    };

    socket.once("connect", () => finish(true));
    socket.once("error", (error: NodeJS.ErrnoException) => {
      finish(!["ECONNREFUSED", "ENOENT"].includes(error.code ?? ""));
    });
    socket.setTimeout(250, () => finish(true));
  });

export async function prepareSocketPath(
  socketPath: string,
  probe: SocketProbe = probeSocketActive,
  expectedUid = typeof process.getuid === "function" ? process.getuid() : undefined,
): Promise<void> {
  if (!fs.existsSync(socketPath)) return;

  const initial = fs.lstatSync(socketPath);
  if (initial.isSymbolicLink() || !initial.isSocket()) {
    throw new Error("Socket path exists but is not a broker-owned Unix socket");
  }
  if (expectedUid !== undefined && initial.uid !== expectedUid) {
    throw new Error("Existing socket is not owned by the broker user");
  }
  if (await probe(socketPath)) {
    throw new Error("Broker socket is already active");
  }

  const confirmed = fs.lstatSync(socketPath);
  if (
    !confirmed.isSocket() ||
    confirmed.isSymbolicLink() ||
    confirmed.dev !== initial.dev ||
    confirmed.ino !== initial.ino ||
    (expectedUid !== undefined && confirmed.uid !== expectedUid)
  ) {
    throw new Error("Socket path changed during stale-socket verification");
  }

  fs.unlinkSync(socketPath);
}

export async function start(
  socketPath = SOCKET_PATH,
  app: FastifyInstance = buildApp(),
): Promise<FastifyInstance> {
  await prepareSocketPath(socketPath);
  await app.listen({ path: socketPath });
  fs.chmodSync(socketPath, 0o660);
  return app;
}

if (require.main === module) {
  void start().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Action Broker startup failed"}\n`,
    );
    process.exitCode = 1;
  });
}
