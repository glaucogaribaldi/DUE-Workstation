import { z } from 'zod';

export const InspectDataSchema = z.object({
  service: z.string(),
  environment: z.string(),
  status: z.string(),
  pid: z.number().nullable(),
  startedAt: z.string().nullable(),
  uptimeSeconds: z.number().nullable(),
  restartCount: z.number().nullable(),
  memoryBytes: z.number().nullable(),
  cpuPercent: z.number().nullable()
}).strict();

export const SuccessResponseSchema = z.object({
  schemaVersion: z.literal('1.0'),
  requestId: z.string().uuid(),
  ok: z.literal(true),
  observedAt: z.string().datetime(),
  data: InspectDataSchema
}).strict();

export const ErrorResponseSchema = z.object({
  schemaVersion: z.literal('1.0'),
  requestId: z.string().uuid(),
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string()
  }).strict()
}).strict();
