import { buildObservabilitySnapshot } from "@/lib/observability/snapshot";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const snapshot = await buildObservabilitySnapshot();

  return Response.json(snapshot, {
    status: 200,
    headers: {
      "cache-control": "no-store, max-age=0",
      "x-due-observability-schema": snapshot.schemaVersion,
    },
  });
}
