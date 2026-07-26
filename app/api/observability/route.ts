import { buildObservabilitySnapshot } from "@/lib/observability/snapshot";

export const dynamic = "force-dynamic";

function observabilityEnabled(): boolean {
  return typeof process !== "undefined" && process.env?.DUE_OBSERVABILITY_ENABLED === "true";
}

export async function GET(): Promise<Response> {
  const headers = {
    "cache-control": "no-store, max-age=0",
    "x-due-observability-schema": "1",
  };

  if (!observabilityEnabled()) {
    return Response.json(
      {
        schemaVersion: "1",
        status: "disabled",
      },
      {
        status: 503,
        headers,
      },
    );
  }

  const snapshot = await buildObservabilitySnapshot();

  return Response.json(snapshot, {
    status: 200,
    headers,
  });
}
