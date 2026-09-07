import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';

describe('dashboard CORS', () => {
  let app;

  afterEach(async () => {
    await app?.close();
  });

  it('allows every HTTP method used by dashboard mutations', async () => {
    app = await buildApp({ logger: false });
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/organizations/org/bots/bot',
      headers: {
        origin: env.APP_ORIGIN,
        'access-control-request-method': 'PATCH'
      }
    });

    expect(response.statusCode).toBe(204);
    const methods = response.headers['access-control-allow-methods'];
    expect(methods).toContain('PUT');
    expect(methods).toContain('PATCH');
    expect(methods).toContain('DELETE');
  });
});
