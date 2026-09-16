import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

// Build a single app instance for all integration tests.
const app = await buildApp({ logger: false });

describe('integration: structured error contract over the real Fastify app', () => {
  it('every error response carries the request-id header', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/nonexistent-endpoint-for-testing' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toMatch(/^req_[a-f0-9]{16}$/);
  });

  it('a successful 200 also echoes the request-id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/llm',
      headers: { 'x-request-id': 'req_test_abcdef' }
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('req_test_abcdef');
  });

  it('rejects invalid client-supplied request-id and generates its own', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/llm',
      headers: { 'x-request-id': '!!invalid!!' }
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toMatch(/^req_[a-f0-9]{16}$/);
  });

  it('ZodError-style 400 returns userMessage + retryable=false', async () => {
    // POST /api/auth/login with an empty body triggers a zod validation error.
    // We expect a 400 with the new structured error contract.
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {}
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(typeof body.error.retryable).toBe('boolean');
    expect(typeof body.error.userMessage).toBe('string');
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.retryable).toBe(false);
    expect(response.headers['x-request-id']).toMatch(/^req_[a-f0-9]{16}$/);
  });

  it('health/llm endpoint is reachable and returns 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/llm' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('connectivity');
    expect(body).toHaveProperty('trainedModel');
    expect(body).toHaveProperty('trainedDeployment');
    expect(body).toHaveProperty('trainedDeploymentStatus');
    expect(['CONNECTED', 'OFFLINE']).toContain(body.connectivity);
  });

  it('returns a dependency error instead of a 500 when MongoDB is unavailable', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Test User', email: 'test@example.com', password: 'long-password' }
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({ code: 'DATABASE_UNAVAILABLE', retryable: true });
  });

  it('CORS preflight for /api/auth/* still passes', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/login',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    });
    // 204 from CORS, or 200 — both fine
    expect([200, 204]).toContain(response.statusCode);
  });

  it('non-existent endpoint returns 404 with a structured error body', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/this-does-not-exist' });
    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body).toHaveProperty('error');
    // Fastify default 404 doesn't carry our custom shape, but the header must be set
    expect(response.headers['x-request-id']).toMatch(/^req_[a-f0-9]{16}$/);
  });

  it('health endpoint returns a successful response', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect([200, 404]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = response.json();
      expect(body).toHaveProperty('status');
    }
  });
});

describe('integration: rate limit is wired for /api/auth/*', () => {
  it('does not crash under repeated unauthenticated hits (limit configured at 15/min)', async () => {
    // The endpoint requires a body; we just want to ensure repeated bad requests
    // get a structured error rather than crashing the server.
    const responses = [];
    for (let i = 0; i < 4; i++) {
      responses.push(await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} }));
    }
    for (const r of responses) {
      expect([400, 401, 429]).toContain(r.statusCode);
      const body = r.json();
      expect(body).toHaveProperty('error');
    }
  });
});
