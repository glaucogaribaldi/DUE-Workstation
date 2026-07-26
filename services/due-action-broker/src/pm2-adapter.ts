import * as pm2 from "pm2";
import type { Pm2ProcessState, Pm2Status } from "../../../packages/action-contracts/index";

export interface Pm2Client {
  connect(callback: (error?: Error) => void): void;
  describe(
    target: string,
    callback: (error: Error | null, processes: pm2.ProcessDescription[]) => void,
  ): void;
  disconnect(): void;
}

const ALLOWED_STATES = new Set<Pm2ProcessState>([
  "online",
  "stopping",
  "stopped",
  "launching",
  "errored",
  "one-launch-status",
  "unknown",
]);

export function normalizePm2Status(value: unknown): Pm2ProcessState {
  return typeof value === "string" && ALLOWED_STATES.has(value as Pm2ProcessState)
    ? (value as Pm2ProcessState)
    : "unknown";
}

function safeDisconnect(client: Pm2Client): void {
  try {
    client.disconnect();
  } catch {
    // Disconnect is best-effort and must not mask the original result.
  }
}

export async function describeProcess(
  target: string,
  timeoutMs = 2_000,
  client: Pm2Client = pm2 as unknown as Pm2Client,
): Promise<Pm2Status | null> {
  if (target !== "pianodivino-ui") {
    throw new Error("Target is not allowlisted");
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error: Error | null, value: Pm2Status | null = null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      safeDisconnect(client);
      if (error) reject(error);
      else resolve(value);
    };

    const timer = setTimeout(() => {
      finish(new Error("PM2 operation timed out"));
    }, timeoutMs);

    client.connect((connectError) => {
      if (connectError) {
        finish(new Error("PM2 connection failed"));
        return;
      }

      client.describe(target, (describeError, processDescriptions) => {
        if (describeError) {
          finish(new Error("PM2 inspection failed"));
          return;
        }

        if (!processDescriptions || processDescriptions.length === 0) {
          finish(null, null);
          return;
        }

        const proc = processDescriptions[0];
        const startedAt = proc.pm2_env?.pm_uptime;
        const uptimeSeconds =
          typeof startedAt === "number" && startedAt <= Date.now()
            ? Math.floor((Date.now() - startedAt) / 1_000)
            : null;

        finish(null, {
          status: normalizePm2Status(proc.pm2_env?.status),
          pid: typeof proc.pid === "number" && proc.pid >= 0 ? proc.pid : null,
          uptimeSeconds,
          restarts:
            typeof proc.pm2_env?.restart_time === "number" && proc.pm2_env.restart_time >= 0
              ? proc.pm2_env.restart_time
              : null,
          cpuPercent:
            typeof proc.monit?.cpu === "number" && proc.monit.cpu >= 0 ? proc.monit.cpu : null,
          memoryBytes:
            typeof proc.monit?.memory === "number" && proc.monit.memory >= 0
              ? proc.monit.memory
              : null,
        });
      });
    });
  });
}
