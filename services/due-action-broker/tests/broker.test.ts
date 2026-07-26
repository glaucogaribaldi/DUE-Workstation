import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { buildApp } from '../src/index';

describe('Action Broker Tests', () => {
  it('should return 400 for invalid payload', async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/actions',
      payload: { action: 'invalid' }
    });
    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error.code, 'BAD_REQUEST');
  });

  it('should return 400 for missing requestId', async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/actions',
      payload: { 
        schemaVersion: '1.0',
        actor: { id: 'test', role: 'admin' },
        action: 'service.inspect',
        target: 'pianodivino-ui',
        parameters: {}
      }
    });
    assert.strictEqual(response.statusCode, 400);
  });

  it('should return 400 for non-empty parameters', async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/actions',
      payload: { 
        schemaVersion: '1.0',
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        actor: { id: 'test', role: 'admin' },
        action: 'service.inspect',
        target: 'pianodivino-ui',
        parameters: { something: true }
      }
    });
    assert.strictEqual(response.statusCode, 400);
  });

  it('should return 400 for mutative action', async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/actions',
      payload: { 
        schemaVersion: '1.0', 
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        actor: { id: 'test', role: 'admin' },
        action: 'service.restart', 
        target: 'pianodivino-ui',
        parameters: {}
      }
    });
    assert.strictEqual(response.statusCode, 400);
  });

  it('should return 400 for unallowed target', async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/actions',
      payload: { 
        schemaVersion: '1.0', 
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        actor: { id: 'test', role: 'admin' },
        action: 'service.inspect', 
        target: 'other-service',
        parameters: {}
      }
    });
    assert.strictEqual(response.statusCode, 400);
  });

  it('should return 404 for service not found', async () => {
    const app = buildApp(async () => null);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/actions',
      payload: { 
        schemaVersion: '1.0', 
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        actor: { id: 'test', role: 'admin' },
        action: 'service.inspect', 
        target: 'pianodivino-ui',
        parameters: {}
      }
    });
    assert.strictEqual(response.statusCode, 404);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error.code, 'SERVICE_NOT_FOUND');
  });

  it('should return 503 for PM2 unavailable', async () => {
    const app = buildApp(async () => { throw new Error('PM2 Connection failed'); });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/actions',
      payload: { 
        schemaVersion: '1.0', 
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        actor: { id: 'test', role: 'admin' },
        action: 'service.inspect', 
        target: 'pianodivino-ui',
        parameters: {}
      }
    });
    assert.strictEqual(response.statusCode, 503);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error.code, 'PM2_UNAVAILABLE');
  });

  it('should return 200 with normal process status', async () => {
    const mockStatus = {
        status: 'online',
        pid: 1234,
        uptimeSeconds: 3600,
        restarts: 2,
        cpuPercent: 5.5,
        memoryBytes: 102400000
    };
    const app = buildApp(async () => mockStatus);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/actions',
      payload: { 
        schemaVersion: '1.0', 
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        actor: { id: 'test', role: 'admin' },
        action: 'service.inspect', 
        target: 'pianodivino-ui',
        parameters: {}
      }
    });
    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.ok(body.result);
    assert.strictEqual(body.result.status, 'online');
    assert.strictEqual(body.result.pid, 1234);
    assert.strictEqual(body.result.uptimeSeconds, 3600);
  });
});
