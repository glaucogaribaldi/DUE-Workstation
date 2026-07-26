import Fastify from 'fastify';
import * as fs from 'fs';
import { ActionRequestSchema, AuditLogSchema, ActionResponseSchema, ActionRequest } from '@contracts/index';
import { describeProcess as defaultDescribeProcess } from './pm2-adapter';

const SOCKET_PATH = '/run/due-action-broker/broker.sock';
const BUILD_VERSION = process.env.BUILD_VERSION || '1.0.0-r2a';

export const buildApp = (describeProcessFn = defaultDescribeProcess) => {
  const fastify = Fastify({ logger: false });

  fastify.post('/v1/actions', async (request, reply) => {
    const startedAt = Date.now();
    let auditReqId = '00000000-0000-0000-0000-000000000000';
    let actorId = 'unknown';
    let actorRole = 'unknown';
    let action = 'unknown';
    let target = 'unknown';

    try {
      const body: unknown = request.body;
      if (body && typeof body === 'object' && 'requestId' in body) {
        auditReqId = String((body as Record<string, unknown>).requestId);
      } else {
        auditReqId = crypto.randomUUID();
      }

      const parsed = ActionRequestSchema.parse(body);
      actorId = parsed.actor.id;
      actorRole = parsed.actor.role;
      action = parsed.action;
      target = parsed.target;

      if (parsed.action === 'service.inspect' && parsed.target === 'pianodivino-ui') {
        try {
          const procStatus = await describeProcessFn(parsed.target);
          if (!procStatus) {
            writeAudit(auditReqId, actorId, actorRole, action, target, false, Date.now() - startedAt, 'SERVICE_NOT_FOUND');
            return reply.code(404).send(ActionResponseSchema.parse({
              schemaVersion: '1.0',
              requestId: auditReqId,
              timestamp: new Date().toISOString(),
              error: { code: 'SERVICE_NOT_FOUND', message: 'Process not found' }
            }));
          }

          writeAudit(auditReqId, actorId, actorRole, action, target, true, Date.now() - startedAt);
          return reply.code(200).send(ActionResponseSchema.parse({
            schemaVersion: '1.0',
            requestId: auditReqId,
            timestamp: new Date().toISOString(),
            result: procStatus
          }));

        } catch (e: unknown) {
          writeAudit(auditReqId, actorId, actorRole, action, target, false, Date.now() - startedAt, 'PM2_UNAVAILABLE');
          return reply.code(503).send(ActionResponseSchema.parse({
            schemaVersion: '1.0',
            requestId: auditReqId,
            timestamp: new Date().toISOString(),
            error: { code: 'PM2_UNAVAILABLE', message: 'PM2 is unavailable or timed out' }
          }));
        }
      } else {
        writeAudit(auditReqId, actorId, actorRole, action, target, false, Date.now() - startedAt, 'FORBIDDEN');
        return reply.code(403).send(ActionResponseSchema.parse({
          schemaVersion: '1.0',
          requestId: auditReqId,
          timestamp: new Date().toISOString(),
          error: { code: 'FORBIDDEN', message: 'Action or target forbidden' }
        }));
      }

    } catch (e: unknown) {
      writeAudit(auditReqId, actorId, actorRole, action, target, false, Date.now() - startedAt, 'BAD_REQUEST');
      return reply.code(400).send({
        schemaVersion: '1.0',
        requestId: auditReqId,
        timestamp: new Date().toISOString(),
        error: { code: 'BAD_REQUEST', message: 'Invalid payload schema' }
      });
    }
  });

  return fastify;
};

function writeAudit(requestId: string, actorId: string, actorRole: string, action: string, target: string, success: boolean, latencyMs: number, errorCode?: string) {
  const log = AuditLogSchema.parse({
    schema: 'audit.1.0',
    timestamp: new Date().toISOString(),
    requestId,
    actorId,
    actorRole,
    action,
    target,
    success,
    latencyMs,
    errorCode,
    brokerPid: process.pid,
    buildVersion: BUILD_VERSION
  });
  process.stdout.write(JSON.stringify(log) + '\n');
}

export const start = async () => {
  const app = buildApp();
  
  if (fs.existsSync(SOCKET_PATH)) {
    try {
      const stats = fs.statSync(SOCKET_PATH);
      if (stats.isSocket()) {
        fs.unlinkSync(SOCKET_PATH);
      } else {
        throw new Error('Path exists and is not a socket');
      }
    } catch (e: unknown) {
      console.error('Failed to cleanup stale socket:', e);
      process.exit(1);
    }
  }

  try {
    await app.listen({ path: SOCKET_PATH });
    fs.chmodSync(SOCKET_PATH, '0660');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}
