import crypto from 'node:crypto';
import { promises as dns } from 'node:dns';
import net from 'node:net';

export const randomId = (prefix = '') => `${prefix}${crypto.randomBytes(18).toString('base64url')}`;
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const hashIp = ip => sha256(ip || 'unknown');

export function normalizeDomain(value) {
  if (!value) return '';
  try { return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase(); }
  catch { return ''; }
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:');
}

export async function assertSafePublicUrl(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public HTTP(S) URLs are allowed');
  if (['localhost', 'localhost.localdomain'].includes(url.hostname)) throw new Error('Private network URLs are blocked');
  const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => isPrivateIp(record.address))) throw new Error('Private network URLs are blocked');
  return url;
}
