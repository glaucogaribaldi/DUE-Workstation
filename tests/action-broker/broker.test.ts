import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { buildApp } from '../../services/due-action-broker/src/index';

describe('Action Broker Tests', () => {
  it('should return 400 for invalid payload', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/action',
      payload: { action: 'invalid' }
    });
    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'BAD_REQUEST');
  });

  it('should return 400 for mutative action', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/action',
      payload: { 
        schemaVersion: '1.0', 
        action: 'service.restart', 
        target: 'pianodivino-ui', 
        requestId: '123e4567-e89b-12d3-a456-426614174000' 
      }
    });
    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.ok, false);
  });
});
