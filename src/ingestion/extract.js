import fs from 'node:fs/promises';
import path from 'node:path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { assertSafePublicUrl } from '../utils/security.js';

const clean = text => text.replace(/\r/g, '').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

export async function extractSource(source) {
  if (source.type === 'text') return clean(source.content || '');
  if (source.type === 'faq') return clean((source.faqEntries || []).map(item => `Question: ${item.question}\nAnswer: ${item.answer}`).join('\n\n'));
  if (source.type === 'txt') return clean(await fs.readFile(source.filePath, 'utf8'));
  if (source.type === 'pdf') return clean((await pdf(await fs.readFile(source.filePath))).text);
  if (source.type === 'docx') return clean((await mammoth.extractRawText({ path: source.filePath })).value);
  if (source.type === 'url') {
    const url = await assertSafePublicUrl(source.url);
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'AidenKnowledgeBot/1.0' } });
    if (!response.ok) throw new Error(`Website returned ${response.status}`);
    if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('Website URL must return HTML');
    const body = await response.text();
    if (Buffer.byteLength(body) > 5 * 1024 * 1024) throw new Error('Website response is too large');
    const $ = cheerio.load(body);
    $('script,style,noscript,nav,footer,form').remove();
    return clean($('main,article,body').first().text());
  }
  throw new Error(`Unsupported source type: ${path.extname(source.name || '') || source.type}`);
}

export function chunkText(text, size = 1200, overlap = 180) {
  if (!text) return [];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('. ', end));
      if (boundary > start + size * 0.55) end = boundary + 1;
    }
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks.filter(Boolean);
}
