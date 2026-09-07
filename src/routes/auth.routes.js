import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { requireDatabase } from '../db/mongoose.js';
import { DEMO_ACCOUNTS } from '../config/demo-accounts.js';

const credentials = z.object({ email: z.string().email(), password: z.string().min(10).max(128) });
const cookieOptions = { path: '/api/auth', httpOnly: true, sameSite: 'strict', secure: env.NODE_ENV === 'production', maxAge: env.REFRESH_TOKEN_DAYS * 86400 };
const context = request => ({ ip: request.ip, userAgent: request.headers['user-agent'] });

export async function authRoutes(app) {
  app.get('/demo-accounts', async () => env.NODE_ENV === 'production' ? [] : DEMO_ACCOUNTS.map(({ password, ...account }) => ({ ...account, password })));
  app.post('/register', async request => {
    const input = z.object({ name: z.string().min(2).max(100), ...credentials.shape }).parse(request.body);
    await requireDatabase(request);
    return authService.register(input);
  });
  app.post('/login', async (request, reply) => {
    const input = credentials.parse(request.body);
    await requireDatabase(request);
    const session = await authService.login(input, context(request));
    reply.setCookie('refresh_token', session.refreshToken, cookieOptions);
    return { user: session.user, accessToken: session.accessToken };
  });
  app.post('/refresh', { preHandler: requireDatabase }, async (request, reply) => {
    const raw = request.cookies.refresh_token || request.body?.refreshToken;
    const session = await authService.refresh(raw, context(request));
    reply.setCookie('refresh_token', session.refreshToken, cookieOptions);
    return { user: session.user, accessToken: session.accessToken };
  });
  app.post('/logout', { preHandler: requireDatabase }, async (request, reply) => { await authService.logout(request.cookies.refresh_token); reply.clearCookie('refresh_token', cookieOptions); return { ok: true }; });
  app.get('/me', { preHandler: [requireDatabase, authenticate] }, async request => ({ user: { id: request.user._id, name: request.user.name, email: request.user.email, accountRole: request.user.accountRole || 'applicant', emailVerified: Boolean(request.user.emailVerifiedAt) } }));
  app.post('/forgot-password', async request => { const email = z.object({ email: z.string().email() }).parse(request.body).email; await requireDatabase(request); return authService.forgotPassword(email); });
  app.post('/reset-password', async request => { const body = z.object({ token: z.string(), password: z.string().min(10).max(128) }).parse(request.body); await requireDatabase(request); await authService.resetPassword(body.token, body.password); return { ok: true }; });
  app.post('/verify-email', async request => { const token = z.object({ token: z.string() }).parse(request.body).token; await requireDatabase(request); await authService.verifyEmail(token); return { ok: true }; });
}
