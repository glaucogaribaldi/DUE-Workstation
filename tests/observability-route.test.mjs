import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("observability-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

test("returns a safe read-only observability snapshot", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/api/observability", {
      headers: { accept: "application/json" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-due-observability-schema"), "1");
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);

  const snapshot = await response.json();
  assert.equal(snapshot.schemaVersion, "1");
  assert.match(snapshot.generatedAt, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(snapshot.frontend.component, "frontend");
  assert.equal(snapshot.frontend.status, "healthy");
  assert.equal(snapshot.frontend.data.service, "pianodivino-ui");

  for (const component of ["pm2", "openclaw", "gpu"]) {
    assert.equal(snapshot[component].component, component);
    assert.equal(snapshot[component].status, "unavailable");
    assert.equal(snapshot[component].data.configured, false);
    assert.equal(snapshot[component].error.code, "NOT_CONFIGURED");
  }
});
