"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorResponseSchema = exports.SuccessResponseSchema = exports.InspectDataSchema = void 0;
const zod_1 = require("zod");
exports.InspectDataSchema = zod_1.z.object({
    service: zod_1.z.string(),
    environment: zod_1.z.string(),
    status: zod_1.z.string(),
    pid: zod_1.z.number().nullable(),
    startedAt: zod_1.z.string().nullable(),
    uptimeSeconds: zod_1.z.number().nullable(),
    restartCount: zod_1.z.number().nullable(),
    memoryBytes: zod_1.z.number().nullable(),
    cpuPercent: zod_1.z.number().nullable()
}).strict();
exports.SuccessResponseSchema = zod_1.z.object({
    schemaVersion: zod_1.z.literal('1.0'),
    requestId: zod_1.z.string().uuid(),
    ok: zod_1.z.literal(true),
    observedAt: zod_1.z.string().datetime(),
    data: exports.InspectDataSchema
}).strict();
exports.ErrorResponseSchema = zod_1.z.object({
    schemaVersion: zod_1.z.literal('1.0'),
    requestId: zod_1.z.string().uuid(),
    ok: zod_1.z.literal(false),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string()
    }).strict()
}).strict();
