"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = void 0;
const fastify_1 = __importDefault(require("fastify"));
const pm2 = __importStar(require("pm2"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const index_1 = require("@contracts/index");
const fastify = (0, fastify_1.default)({ logger: false });
const SOCKET_PATH = '/run/due-action-broker/broker.sock';
function auditLog(actor, action, target, success, level, reqId, errCode, duration) {
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
    const reqId = request.body?.requestId || crypto.randomUUID();
    const start = Date.now();
    try {
        const parsed = index_1.ActionRequestSchema.parse(request.body);
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
                        }
                        else {
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
        }
        else {
            auditLog('uno-local', parsed.action, parsed.target, false, 'green', reqId, 'ACTION_NOT_ALLOWED', Date.now() - start);
            reply.code(403).send({
                schemaVersion: '1.0',
                requestId: reqId,
                ok: false,
                error: { code: 'ACTION_NOT_ALLOWED', message: 'The requested action is not available.' }
            });
        }
    }
    catch (err) {
        auditLog('uno-local', 'unknown', 'unknown', false, 'green', reqId, 'INVALID_PAYLOAD', Date.now() - start);
        reply.code(400).send({
            schemaVersion: '1.0',
            requestId: reqId,
            ok: false,
            error: { code: 'BAD_REQUEST', message: 'Payload format invalid or action not allowed' }
        });
    }
});
const buildApp = () => fastify;
exports.buildApp = buildApp;
if (require.main === module) {
    const startApp = async () => {
        try {
            const isSystemd = process.env.LISTEN_FDS && parseInt(process.env.LISTEN_FDS, 10) > 0;
            if (isSystemd) {
                await fastify.listen({ host: 'localhost', port: 4000 });
                console.log('Action Broker listening on systemd fallback port 4000');
            }
            else {
                if (fs.existsSync(SOCKET_PATH))
                    fs.unlinkSync(SOCKET_PATH);
                await fastify.listen({ path: SOCKET_PATH });
                fs.chmodSync(SOCKET_PATH, '0660');
                console.log('Action Broker listening on ' + SOCKET_PATH);
            }
        }
        catch (err) {
            console.error(err);
            process.exit(1);
        }
    };
    startApp();
}
