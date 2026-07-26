import {
  OBSERVABILITY_SCHEMA_VERSION,
  type DueObservabilitySnapshot,
  type FrontendObservationData,
  type Observation,
  type ObservationComponent,
  type ObservationStatus,
  type RemoteObservationData,
} from "./contracts";

const DEFAULT_TIMEOUT_MS = 1_500;
const MAX_RESPONSE_BYTES = 64 * 1024;

function nowIso(): string {
  return new Date().toISOString();
}

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const value = process.env?.[name]?.trim();
  return value || undefined;
}

function readFrontend(): Observation<FrontendObservationData> {
  const runtime =
    typeof process !== "undefined" && typeof process.version === "string"
      ? process.version
      : "unknown";
  const uptimeSeconds =
    typeof process !== "undefined" && typeof process.uptime === "function"
      ? Math.round(process.uptime())
      : null;

  return {
    component: "frontend",
    status: "healthy",
    observedAt: nowIso(),
    source: "runtime:pianodivino-ui",
    data: {
      service: "pianodivino-ui",
      runtime,
      uptimeSeconds,
      buildSha: readEnv("DUE_BUILD_SHA") ?? readEnv("GITHUB_SHA") ?? null,
    },
    error: null,
  };
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }

  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function allowedEndpoint(rawUrl: string): URL | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(url.protocol)) return null;
  if (url.username || url.password || url.search || url.hash) return null;

  const hostname = url.hostname.toLowerCase();
  const configuredHosts = (readEnv("DUE_OBSERVABILITY_ALLOWED_HOSTS") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const loopbackOrPrivate =
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    isPrivateIpv4(hostname);

  if (!loopbackOrPrivate && !configuredHosts.includes(hostname)) return null;
  return url;
}

function remoteSource(component: Exclude<ObservationComponent, "frontend">): string {
  return `remote:${component}`;
}

function pickString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length <= 256 ? value : null;
}

function normalizeStatus(reportedStatus: string | null, httpOk: boolean): ObservationStatus {
  if (!httpOk) return "unavailable";
  if (!reportedStatus) return "unknown";

  const normalized = reportedStatus.toLowerCase();
  if (["healthy", "ok", "online", "up", "ready"].includes(normalized)) return "healthy";
  if (["degraded", "warning", "warn", "partial"].includes(normalized)) return "degraded";
  if (["unavailable", "offline", "down", "error", "failed"].includes(normalized)) return "unavailable";
  return "unknown";
}

async function readRemote(
  component: Exclude<ObservationComponent, "frontend">,
  envName: string,
): Promise<Observation<RemoteObservationData>> {
  const configuredUrl = readEnv(envName);
  const observedAt = nowIso();

  if (!configuredUrl) {
    return {
      component,
      status: "unavailable",
      observedAt,
      source: `env:${envName}`,
      data: {
        configured: false,
        httpStatus: null,
        latencyMs: null,
        reportedStatus: null,
        service: null,
        version: null,
      },
      error: {
        code: "NOT_CONFIGURED",
        message: `${envName} is not configured`,
      },
    };
  }

  const endpoint = allowedEndpoint(configuredUrl);
  if (!endpoint) {
    return {
      component,
      status: "unavailable",
      observedAt,
      source: `env:${envName}`,
      data: {
        configured: true,
        httpStatus: null,
        latencyMs: null,
        reportedStatus: null,
        service: null,
        version: null,
      },
      error: {
        code: "ENDPOINT_NOT_ALLOWED",
        message: "Endpoint must use HTTP(S), contain no credentials, query, or fragment, and target an allowed private host",
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const body = await response.text();

    if (body.length > MAX_RESPONSE_BYTES) {
      return {
        component,
        status: "degraded",
        observedAt,
        source: remoteSource(component),
        data: {
          configured: true,
          httpStatus: response.status,
          latencyMs,
          reportedStatus: null,
          service: null,
          version: null,
        },
        error: {
          code: "RESPONSE_TOO_LARGE",
          message: `Health response exceeded ${MAX_RESPONSE_BYTES} bytes`,
        },
      };
    }

    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(body);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected JSON object");
      payload = parsed as Record<string, unknown>;
    } catch {
      return {
        component,
        status: response.ok ? "degraded" : "unavailable",
        observedAt,
        source: remoteSource(component),
        data: {
          configured: true,
          httpStatus: response.status,
          latencyMs,
          reportedStatus: null,
          service: null,
          version: null,
        },
        error: {
          code: "INVALID_RESPONSE",
          message: "Health endpoint did not return a JSON object",
        },
      };
    }

    const reportedStatus = pickString(payload, "status");
    return {
      component,
      status: normalizeStatus(reportedStatus, response.ok),
      observedAt,
      source: remoteSource(component),
      data: {
        configured: true,
        httpStatus: response.status,
        latencyMs,
        reportedStatus,
        service: pickString(payload, "service"),
        version: pickString(payload, "version"),
      },
      error: response.ok
        ? null
        : {
            code: "HTTP_ERROR",
            message: `Health endpoint returned HTTP ${response.status}`,
          },
    };
  } catch (error) {
    const aborted = controller.signal.aborted;
    return {
      component,
      status: "unavailable",
      observedAt,
      source: remoteSource(component),
      data: {
        configured: true,
        httpStatus: null,
        latencyMs: Date.now() - startedAt,
        reportedStatus: null,
        service: null,
        version: null,
      },
      error: {
        code: aborted ? "TIMEOUT" : "FETCH_FAILED",
        message: aborted
          ? `Health endpoint exceeded ${DEFAULT_TIMEOUT_MS} ms`
          : error instanceof Error
            ? error.message
            : "Unknown fetch failure",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildObservabilitySnapshot(): Promise<DueObservabilitySnapshot> {
  const [pm2, openclaw, gpu] = await Promise.all([
    readRemote("pm2", "DUE_PM2_HEALTH_URL"),
    readRemote("openclaw", "DUE_OPENCLAW_HEALTH_URL"),
    readRemote("gpu", "DUE_GPU_HEALTH_URL"),
  ]);

  return {
    schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
    generatedAt: nowIso(),
    frontend: readFrontend(),
    pm2,
    openclaw,
    gpu,
  };
}
