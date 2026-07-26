"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogSchema = exports.ActionRequestSchema = exports.ActionLevel = void 0;
const zod_1 = require("zod");
exports.ActionLevel = zod_1.z.enum(['green', 'yellow', 'orange', 'red']);
exports.ActionRequestSchema = zod_1.z.object({
    schemaVersion: zod_1.z.literal('1.0'),
    action: zod_1.z.enum(['service.inspect']),
    target: zod_1.z.enum(['pianodivino-ui']),
    requestId: zod_1.z.string().uuid()
}).strict();
exports.AuditLogSchema = zod_1.z.object({
    requestId: zod_1.z.string().uuid(),
    actor: zod_1.z.string(),
    action: zod_1.z.string(),
    target: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    success: zod_1.z.boolean(),
    level: exports.ActionLevel,
    durationMs: zod_1.z.number().optional(),
    errorCode: zod_1.z.string().optional()
});
