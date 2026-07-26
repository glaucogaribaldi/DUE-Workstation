import Fastify from 'fastify';
import * as pm2 from 'pm2';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ActionRequestSchema } from '@contracts/index';

const fastify = Fastify({ logger: false });
const SOCKET_PATH = '/run/due-action-broker/broker.sock';

function auditLog(actor: string, action: string, target: string, success: boolean, level: string, reqId: string, errCode?: string, duration?: number) {
    const log = {
        requestId: reqId,
        actor,
        action,
        target,
        timestamp: new Date().toISOString(),
        success,
        level,
        errorCode: errCode,
        durationMs: duration
    };
    console.log(JSON.stringify(log));
}

fastify.post('/action', async (request, reply) => {
    const reqId = (request.body as any)?.requestId || crypto.randomUUID();
    const start = Date.now();
    try {
        const parsed = ActionRequestSchema.parse(request.body);
        
        if (parsed.action === 'service.inspect') {
             return new Promise((resolve) => {
                pm2.connect((err) => {
                    if (err) {
                        auditLog('uno-local', parsed.action, parsed.target, false, 'green', reqId, 'PM2_CONN_ERR', Date.now() - start);
                        reply.code(500).send({ schemaVersion: '1.0', requestId: reqId, ok: false, error: { code: 'PM2_ERROR', message: 'PM2 Connection failed' } });
                        resolve(undefined);
                        return;
                    }
                    pm2.describe(parsed.target, (err, processDescription) => {
                        pm2.disconnect();
                        if (err || !processDescription || processDescription.length === 0) {
                             auditLog('uno-local', parsed.action, parsed.target, false, 'green', reqId, 'NOT_FOUND', Date.now() - start);
                             reply.code(404).send({ schemaVersion: '1.0', requestId: reqId, ok: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
                             resolve(undefined);
                        } else {
                             const proc = processDescription[0];
                             auditLog('uno-local', parsed.action, parsed.target, true, 'green', reqId, undefined, Date.now() - start);
                             reply.send({
                                 schemaVersion: '1.0',
                                 requestId: reqId,
                                 ok: true,
                                 observedAt: new Date().toISOString(),
                                 data: {
                                     service: parsed.target,
                                     environment: 'production',
                                     status: proc.pm2_env?.status || 'unknown',
                                     pid: proc.pid || null,
                                     startedAt: proc.pm2_env?.pm_uptime ? new Date(proc.pm2_env.pm_uptime).toISOString() : null,
                                     uptimeSeconds: proc.pm2_env?.pm_uptime ? Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000) : null,
                                     restartCount: proc.pm2_env?.restart_time || 0,
                                     memoryBytes: proc.monit?.memory || 0,
                                     cpuPercent: proc.monit?.cpu || 0
                                 }
                             });
                             resolve(undefined);
                        }
                    });
                });
            });
        } else {
            auditLog('uno-local', parsed.action, parsed.target, false, 'green', reqId, 'ACTION_NOT_ALLOWED', Date.now() - start);
            reply.code(403).send({
                schemaVersion: '1.0',
                requestId: reqId,
                ok: false,
                error: { code: 'ACTION_NOT_ALLOWED', message: 'The requested action is not available.' }
            });
        }
    } catch (err: any) {
        auditLog('uno-local', 'unknown', 'unknown', false, 'green', reqId, 'INVALID_PAYLOAD', Date.now() - start);
        reply.code(400).send({
            schemaVersion: '1.0',
            requestId: reqId,
            ok: false,
            error: { code: 'BAD_REQUEST', message: 'Payload format invalid or action not allowed' }
        });
    }
});

export const buildApp = () => fastify;

if (require.main === module) {
    const startApp = async () => {
        try {
            const isSystemd = process.env.LISTEN_FDS && parseInt(process.env.LISTEN_FDS, 10) > 0;
            if (isSystemd) {
                await fastify.listen({ host: 'localhost', port: 4000 });
                console.log('Action Broker listening on systemd fallback port 4000');
            } else {
                if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);
                await fastify.listen({ path: SOCKET_PATH });
                fs.chmodSync(SOCKET_PATH, '0660');
                console.log('Action Broker listening on ' + SOCKET_PATH);
            }
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    };
    startApp();
}
