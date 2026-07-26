import { z } from 'zod';

export const ActionRequestSchema = z.object({
  schemaVersion: z.literal('1.0'),
  requestId: z.string().uuid(),
  actor: z.object({
    id: z.string().min(1),
    role: z.enum(['admin', 'system', 'agent'])
  }),
  action: z.literal('service.inspect'),
  target: z.literal('pianodivino-ui'),
  parameters: z.object({}).strict()
}).strict();

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export const Pm2StatusSchema = z.object({
  status: z.enum(['online', 'stopping', 'stopped', 'launching', 'errored', 'one-launch-status', 'unknown']),
  pid: z.number().nullable(),
  uptimeSeconds: z.number().nullable(),
  restarts: z.number().nullable(),
  cpuPercent: z.number().nullable(),
  memoryBytes: z.number().nullable()
}).strict();

export type Pm2Status = z.infer<typeof Pm2StatusSchema>;

export const ActionResponseSchema = z.object({
  schemaVersion: z.literal('1.0'),
  requestId: z.string().uuid(),
  timestamp: z.string().datetime(),
  result: Pm2StatusSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string()
  }).strict().optional()
}).strict()
.refine(data => (data.result !== undefined) !== (data.error !== undefined), {
  message: "Risultato o errore devono essere mutuamente esclusivi"
});

export type ActionResponse = z.infer<typeof ActionResponseSchema>;

export const AuditLogSchema = z.object({
  schema: z.literal('audit.1.0'),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid(),
  actorId: z.string(),
  actorRole: z.string(),
  action: z.string(),
  target: z.string(),
  success: z.boolean(),
  errorCode: z.string().optional(),
  latencyMs: z.number(),
  brokerPid: z.number(),
  buildVersion: z.string()
}).strict();

export type AuditLog = z.infer<typeof AuditLogSchema>;
