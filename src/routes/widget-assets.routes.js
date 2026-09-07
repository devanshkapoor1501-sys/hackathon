import fs from 'node:fs/promises';
import path from 'node:path';

export async function registerWidgetAssets(app) {
  app.get('/widget.js', async (_, reply) => reply.type('application/javascript; charset=utf-8').send(await fs.readFile(path.resolve('public/widget.js'), 'utf8')));
  app.get('/widget/frame', async (_, reply) => reply.type('text/html; charset=utf-8').header('content-security-policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' https: data:; frame-ancestors *").send(await fs.readFile(path.resolve('public/widget-frame.html'), 'utf8')));
}
