import { z } from 'zod';

export const ActionLevel = z.enum(['green', 'yellow', 'orange', 'red']);

export const ActionRequestSchema = z.object({
  schemaVersion: z.literal('1.0'),
  action: z.enum(['service.inspect']),
  target: z.enum(['pianodivino-ui']),
  requestId: z.string().uuid()
}).strict();

export const AuditLogSchema = z.object({
  requestId: z.string().uuid(),
  actor: z.string(),
  action: z.string(),
  target: z.string(),
  timestamp: z.string().datetime(),
  success: z.boolean(),
  level: ActionLevel,
  durationMs: z.number().optional(),
  errorCode: z.string().optional()
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;
