export const OBSERVABILITY_SCHEMA_VERSION = "1" as const;

export type ObservationStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "unknown";

export type ObservationComponent = "frontend" | "pm2" | "openclaw" | "gpu";

export type ObservationError = {
  code: string;
  message: string;
};

export type Observation<T> = {
  component: ObservationComponent;
  status: ObservationStatus;
  observedAt: string;
  source: string;
  data: T | null;
  error: ObservationError | null;
};

export type FrontendObservationData = {
  service: "pianodivino-ui";
  runtime: string;
  uptimeSeconds: number | null;
  buildSha: string | null;
};

export type RemoteObservationData = {
  configured: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
  reportedStatus: string | null;
  service: string | null;
  version: string | null;
};

export type DueObservabilitySnapshot = {
  schemaVersion: typeof OBSERVABILITY_SCHEMA_VERSION;
  generatedAt: string;
  frontend: Observation<FrontendObservationData>;
  pm2: Observation<RemoteObservationData>;
  openclaw: Observation<RemoteObservationData>;
  gpu: Observation<RemoteObservationData>;
};
