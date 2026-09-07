export class AIProvider {
  id = 'abstract';
  async generate() { throw new Error('generate() must be implemented'); }
  async generateStructured() { throw new Error('generateStructured() must be implemented'); }
  async embed() { throw new Error('embed() must be implemented'); }
  async *stream() { throw new Error('stream() must be implemented'); }
  getModelInfo() { throw new Error('getModelInfo() must be implemented'); }
  async healthCheck() { return { connected: false, reason: 'not implemented' }; }
}

export function coerceJson(text) {
  if (!text) return null;
  const trimmed = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { return null; }
}
