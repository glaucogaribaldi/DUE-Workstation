import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

delete process.env.DUE_OBSERVABILITY_ENABLED;
delete process.env.DUE_OPENCLAW_HEALTH_URL;

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("observability-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const bindings = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

function requestObservability() {
  return worker.fetch(
    new Request("http://localhost/api/observability", {
      headers: { accept: "application/json" },
    }),
    bindings,
    executionContext,
  );
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return address.port;
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("observability defaults closed and opens only with explicit enablement", async () => {
  const disabledResponse = await requestObservability();
  assert.equal(disabledResponse.status, 503);
  assert.equal(disabledResponse.headers.get("x-due-observability-schema"), "1");
  assert.deepEqual(await disabledResponse.json(), {
    schemaVersion: "1",
    status: "disabled",
  });

  process.env.DUE_OBSERVABILITY_ENABLED = "true";
  try {
    const response = await requestObservability();
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
  } finally {
    delete process.env.DUE_OBSERVABILITY_ENABLED;
  }
});

test("normalizes OpenClaw status live as healthy", async () => {
  const server = createServer((request, response) => {
    assert.equal(request.url, "/health");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, status: "live", service: "openclaw" }));
  });
  const port = await listen(server);

  process.env.DUE_OBSERVABILITY_ENABLED = "true";
  process.env.DUE_OPENCLAW_HEALTH_URL = `http://127.0.0.1:${port}/health`;

  try {
    const response = await requestObservability();
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    assert.equal(snapshot.openclaw.status, "healthy");
    assert.equal(snapshot.openclaw.data.reportedStatus, "live");
    assert.equal(snapshot.openclaw.data.service, "openclaw");
    assert.equal(snapshot.openclaw.source, "remote:openclaw");
  } finally {
    delete process.env.DUE_OBSERVABILITY_ENABLED;
    delete process.env.DUE_OPENCLAW_HEALTH_URL;
    await close(server);
  }
});
