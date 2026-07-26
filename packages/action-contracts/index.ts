import { z } from "zod";

export const BROKER_SCHEMA_VERSION = "1.0" as const;
export const BrokerActorRoleSchema = z.enum(["zava", "uno", "admin", "system"]);
export const BrokerActionSchema = z.literal("service.inspect");
export const BrokerTargetSchema = z.literal("pianodivino-ui");
export const BrokerErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "FORBIDDEN_ACTION",
  "FORBIDDEN_TARGET",
  "SERVICE_NOT_FOUND",
  "PM2_UNAVAILABLE",
  "INSPECTION_FAILED",
  "INTERNAL_ERROR",
]);

export const ActionRequestSchema = z.object({
  schemaVersion: z.literal(BROKER_SCHEMA_VERSION),
  requestId: z.string().uuid(),
  actor: z.object({
    id: z.string().min(1).max(128),
    role: BrokerActorRoleSchema,
  }).strict(),
  action: BrokerActionSchema,
  target: BrokerTargetSchema,
  parameters: z.object({}).strict(),
}).strict();

export type ActionRequest = z.infer<typeof ActionRequestSchema>;
export type BrokerActorRole = z.infer<typeof BrokerActorRoleSchema>;
export type BrokerErrorCode = z.infer<typeof BrokerErrorCodeSchema>;

export const Pm2ProcessStateSchema = z.enum([
  "online",
  "stopping",
  "stopped",
  "launching",
  "errored",
  "one-launch-status",
  "unknown",
]);

export const Pm2StatusSchema = z.object({
  status: Pm2ProcessStateSchema,
  pid: z.number().int().nonnegative().nullable(),
  uptimeSeconds: z.number().int().nonnegative().nullable(),
  restarts: z.number().int().nonnegative().nullable(),
  cpuPercent: z.number().nonnegative().nullable(),
  memoryBytes: z.number().int().nonnegative().nullable(),
}).strict();

export type Pm2ProcessState = z.infer<typeof Pm2ProcessStateSchema>;
export type Pm2Status = z.infer<typeof Pm2StatusSchema>;

export const ActionResponseSchema = z.object({
  schemaVersion: z.literal(BROKER_SCHEMA_VERSION),
  requestId: z.string().uuid(),
  timestamp: z.string().datetime(),
  result: Pm2StatusSchema.optional(),
  error: z.object({
    code: BrokerErrorCodeSchema,
    message: z.string().min(1).max(256),
  }).strict().optional(),
}).strict().refine(
  (data) => (data.result !== undefined) !== (data.error !== undefined),
  { message: "Result and error must be mutually exclusive" },
);

export type ActionResponse = z.infer<typeof ActionResponseSchema>;

export const AuditLogSchema = z.object({
  schema: z.literal("audit.1.0"),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid(),
  actorId: z.string().min(1).max(128),
  actorRole: z.union([BrokerActorRoleSchema, z.literal("unknown")]),
  action: z.union([BrokerActionSchema, z.literal("unknown")]),
  target: z.union([BrokerTargetSchema, z.literal("unknown")]),
  success: z.boolean(),
  errorCode: BrokerErrorCodeSchema.optional(),
  latencyMs: z.number().int().nonnegative(),
  brokerPid: z.number().int().positive(),
  buildVersion: z.string().min(1).max(128),
}).strict();

export type AuditLog = z.infer<typeof AuditLogSchema>;
