import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";
import {
  buildApp,
  prepareSocketPath,
  start,
} from "../src/index";
import {
  describeProcess,
  normalizePm2Status,
  type Pm2Client,
} from "../src/pm2-adapter";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const UUID_SCHEMA = z.string().uuid();

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "1.0",
    requestId: UUID,
    actor: { id: "uno", role: "uno" },
    action: "service.inspect",
    target: "pianodivino-ui",
    parameters: {},
    ...overrides,
  };
}

async function listenUnix(socketPath: string): Promise<net.Server> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  return server;
}

async function closeServer(server: net.Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe("DUE Action Broker policy", () => {
  it("returns 400 with a server-generated UUID for an invalid requestId", async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/v1/actions",
      payload: validPayload({ requestId: "invalid" }),
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.error.code, "INVALID_REQUEST");
    assert.equal(UUID_SCHEMA.safeParse(body.requestId).success, true);
    assert.notEqual(body.requestId, "invalid");
  });

  it("returns 403 for a forbidden action", async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/v1/actions",
      payload: validPayload({ action: "service.restart" }),
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_ACTION");
  });

  it("returns 403 for a forbidden target", async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/v1/actions",
      payload: validPayload({ target: "database" }),
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_TARGET");
  });

  it("returns 400 for an actor outside the DUE role allowlist", async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/v1/actions",
      payload: validPayload({ actor: { id: "x", role: "agent" } }),
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "INVALID_REQUEST");
  });

  it("returns 404 when pianodivino-ui is absent", async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/v1/actions",
      payload: validPayload(),
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "SERVICE_NOT_FOUND");
  });

  it("returns a redacted 503 when PM2 fails", async () => {
    const app = buildApp(async () => {
      throw new Error("secret internal detail");
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/actions",
      payload: validPayload(),
    });

    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error.code, "PM2_UNAVAILABLE");
    assert.equal(response.payload.includes("secret internal detail"), false);
  });

  it("returns only the normalized PM2 result", async () => {
    const app = buildApp(async () => ({
      status: "online",
      pid: 1234,
      uptimeSeconds: 3600,
      restarts: 2,
      cpuPercent: 5.5,
      memoryBytes: 102400000,
    }));
    const response = await app.inject({
      method: "POST",
      url: "/v1/actions",
      payload: validPayload(),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(Object.keys(response.json().result).sort(), [
      "cpuPercent",
      "memoryBytes",
      "pid",
      "restarts",
      "status",
      "uptimeSeconds",
    ]);
  });
});

describe("PM2 adapter", () => {
  it("normalizes unknown PM2 states", () => {
    assert.equal(normalizePm2Status("online"), "online");
    assert.equal(normalizePm2Status("unexpected-state"), "unknown");
    assert.equal(normalizePm2Status(null), "unknown");
  });

  it("disconnects when PM2 connection fails", async () => {
    let disconnects = 0;
    const client: Pm2Client = {
      connect(callback) {
        callback(new Error("connect failed"));
      },
      describe() {
        throw new Error("describe must not run");
      },
      disconnect() {
        disconnects += 1;
      },
    };

    await assert.rejects(() => describeProcess("pianodivino-ui", 50, client));
    assert.equal(disconnects, 1);
  });

  it("times out and disconnects when describe never returns", async () => {
    let disconnects = 0;
    const client: Pm2Client = {
      connect(callback) {
        callback(null);
      },
      describe() {
        // Intentionally never calls back.
      },
      disconnect() {
        disconnects += 1;
      },
    };

    await assert.rejects(
      () => describeProcess("pianodivino-ui", 10, client),
      /timed out/,
    );
    assert.equal(disconnects, 1);
  });

  it("disconnects after a successful normalized inspection", async () => {
    let disconnects = 0;
    const client: Pm2Client = {
      connect(callback) {
        callback(null);
      },
      describe(_target, callback) {
        callback(null, [
          {
            pid: 99,
            pm2_env: {
              status: "unexpected-state",
              pm_uptime: Date.now() - 5_000,
              restart_time: 3,
            },
            monit: { cpu: 2, memory: 4096 },
          } as never,
        ]);
      },
      disconnect() {
        disconnects += 1;
      },
    };

    const result = await describeProcess("pianodivino-ui", 50, client);
    assert.equal(result?.status, "unknown");
    assert.equal(result?.pid, 99);
    assert.equal(disconnects, 1);
  });
});

describe("Unix socket safety", () => {
  it("refuses a regular file and does not delete it", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "due-broker-"));
    const socketPath = path.join(directory, "broker.sock");
    fs.writeFileSync(socketPath, "do-not-delete");

    await assert.rejects(() => prepareSocketPath(socketPath));
    assert.equal(fs.readFileSync(socketPath, "utf8"), "do-not-delete");
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("refuses an active Unix socket", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "due-broker-"));
    const socketPath = path.join(directory, "broker.sock");
    const server = await listenUnix(socketPath);

    await assert.rejects(() => prepareSocketPath(socketPath), /already active/);
    await closeServer(server);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("removes only a verified stale socket", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "due-broker-"));
    const socketPath = path.join(directory, "broker.sock");
    const server = await listenUnix(socketPath);

    await prepareSocketPath(socketPath, async () => false);
    assert.equal(fs.existsSync(socketPath), false);
    await closeServer(server);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("starts exclusively on a Unix socket with mode 0660", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "due-broker-"));
    const socketPath = path.join(directory, "broker.sock");
    const app = buildApp(async () => null);

    await start(socketPath, app);
    assert.equal(typeof app.server.address(), "string");
    assert.equal(fs.statSync(socketPath).mode & 0o777, 0o660);

    await app.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("contains no direct child_process execution path", () => {
    for (const file of ["index.ts", "pm2-adapter.ts"]) {
      const source = fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
      assert.equal(/child_process|\bexec\s*\(|\bspawn\s*\(/.test(source), false);
    }
  });
});
