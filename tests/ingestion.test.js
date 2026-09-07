import { describe, expect, it } from 'vitest';
import { chunkText, extractSource } from '../src/ingestion/extract.js';

describe('knowledge ingestion', () => {
  it('extracts FAQ entries and removes noisy whitespace', async () => {
    const text = await extractSource({ type: 'faq', faqEntries: [{ question: 'Returns?', answer: 'Within 30 days.' }] });
    expect(text).toContain('Question: Returns?'); expect(text).toContain('Answer: Within 30 days.');
  });
  it('chunks long content with overlap without empty chunks', () => {
    const chunks = chunkText('Policy sentence. '.repeat(300), 500, 80);
    expect(chunks.length).toBeGreaterThan(2); expect(chunks.every(Boolean)).toBe(true);
  });
});
