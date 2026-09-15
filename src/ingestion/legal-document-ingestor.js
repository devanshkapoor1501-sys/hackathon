import { detectInjection } from '../retrieval/legal-retrieval.service.js';

const CHAPTER_RE = /^\s*(CHAPTER|PART)\s+([IVXLCDM]+|\d+)\b[.\-–:]?\s*(.*)$/im;
const SECTION_RE = /^\s*(SECTION|ARTICLE|RULE)\s+(\d+[A-Z]?)\b\s*[.)\-–:]?\s*(.*)$/im;
const NUMBERED_RE = /^\s*(\d+[A-Z]?)\s*[.)]\s+(.*)$/;
const LONG_TITLE_RE = /^[A-Z][A-Za-z\s,;:'"()-]{12,120}$/;

function normalize(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitLong(text, max = 1800) {
  if (text.length <= max) return [text];
  const parts = [];
  let rest = text;
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf('. ', max), rest.lastIndexOf('। ', max), rest.lastIndexOf('\n', max));
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

/**
 * Structure-aware legal chunking: preserves Act → Chapter/Part → Section/Rule/Article
 * hierarchy. Each chunk carries its nearest section label and parent chapter.
 * Returns [{ sectionLabel, subsection, text }].
 */
export function chunkLegalDocument(rawText) {
  const text = normalize(rawText);
  if (!text) return [];

  // Case-sensitive on purpose: mid-sentence lowercase "section 4 of the Act" must
  // never become a chunk boundary. Heading regexes below stay case-insensitive.
  const blocks = text.split(/\n\s*\n|\n(?=\s*(?:CHAPTER|PART)\s+[IVXLCDM]+)|\n(?=\s*(?:SECTION|ARTICLE|RULE)\s+\d)/);
  const chunks = [];
  let currentChapter = '';
  let currentSection = '';
  let buffer = '';

  const flush = () => {
    const content = buffer.trim();
    buffer = '';
    if (!content) return;
    for (const part of splitLong(content)) {
      chunks.push({
        sectionLabel: currentSection || currentChapter || '',
        subsection: currentSection && currentChapter ? currentChapter : '',
        text: part
      });
    }
  };

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    const chapterMatch = CHAPTER_RE.exec(block);
    const sectionMatch = SECTION_RE.exec(block);
    const numberedMatch = NUMBERED_RE.exec(block);
    const isHeadingLike = block.length < 400 &&
      (chapterMatch || sectionMatch ||
        (numberedMatch && block.split('\n').length === 1) ||
        LONG_TITLE_RE.test(block.split('\n')[0]) && block.split('\n').length <= 2);

    if (sectionMatch) {
      flush();
      const keyword = sectionMatch[1][0].toUpperCase() + sectionMatch[1].slice(1).toLowerCase();
      currentSection = `${keyword} ${sectionMatch[2]}`;
      buffer = `${currentSection}: ${block.replace(sectionMatch[0], sectionMatch[0].trim()).replace(/^\s*(SECTION|ARTICLE|RULE)\s+\d+[A-Z]?\s*[.)\-–:]?\s*/i, '')}`;
      continue;
    }
    if (chapterMatch) {
      flush();
      currentChapter = `${chapterMatch[1].toUpperCase()} ${chapterMatch[2]}${chapterMatch[3] ? ` — ${chapterMatch[3]}` : ''}`;
      continue;
    }
    if (isHeadingLike && numberedMatch) {
      flush();
      currentSection = `Clause ${numberedMatch[1]}`;
      buffer = block.replace(NUMBERED_RE, '$2');
      continue;
    }
    buffer += (buffer ? '\n\n' : '') + block;
  }
  flush();

  // Guarantee every chunk carries a usable label (preamble → nearest heading or General)
  let lastLabel = '';
  for (const chunk of chunks) {
    if (!chunk.sectionLabel) chunk.sectionLabel = lastLabel || 'General';
    else lastLabel = chunk.sectionLabel;
  }
  return chunks.map((chunk, index) => ({ ...chunk, chunkIndex: index }));
}

/**
 * Full ingestion pipeline: validate metadata → structured chunks → injection flags.
 * Returns { source fields ready for LegalSource, chunks ready for LegalChunk }.
 * Persistence is handled by the caller/route so this stays pure and testable.
 */
export function buildIngestPayload({ title, authority, documentType, regimes, status, sourceLevel, effectiveFrom, effectiveTo, url, notes, language = 'en', jurisdiction = 'IN', trainingEligibility = 'RETRIEVAL_ONLY', attribution = '' }) {
  const errors = [];
  if (!title || String(title).trim().length < 4) errors.push('Title is required (min 4 chars)');
  if (!authority || !String(authority).trim()) errors.push('Authority is required (e.g., "Parliament of India")');
  const level = Number(sourceLevel);
  if (!Number.isInteger(level) || level < 1 || level > 7) errors.push('sourceLevel must be 1–7');
  const allowedTypes = ['act', 'rules', 'regulation', 'notification', 'gazette', 'treaty', 'guidance', 'database', 'registry', 'webpage', 'formulary'];
  if (!allowedTypes.includes(documentType)) errors.push(`documentType must be one of ${allowedTypes.join(', ')}`);
  const allowedStatuses = ['CURRENT', 'HISTORICAL', 'SUPERSEDED', 'DRAFT', 'PROPOSED', 'UNKNOWN'];
  if (!allowedStatuses.includes(status)) errors.push(`status must be one of ${allowedStatuses.join(', ')}`);
  if (status === 'CURRENT' && !effectiveFrom) errors.push('CURRENT documents require effectiveFrom');
  if (!['IN', 'INTL'].includes(String(jurisdiction).toUpperCase())) errors.push('jurisdiction must be IN or INTL');
  if (!['RETRIEVAL_ONLY', 'TRAINING_ELIGIBLE', 'EXCLUDED'].includes(String(trainingEligibility).toUpperCase())) errors.push('trainingEligibility must be RETRIEVAL_ONLY, TRAINING_ELIGIBLE or EXCLUDED');
  if (errors.length) return { ok: false, errors };

  const regimeList = String(regimes || '').split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
  return {
    ok: true,
    source: {
      sourceKey: null,
      title: String(title).trim(),
      authority: String(authority).trim(),
      jurisdiction: String(jurisdiction).toUpperCase(),
      documentType,
      regimes: regimeList,
      publicationDate: '',
      effectiveFrom: effectiveFrom || null,
      effectiveTo: effectiveTo || null,
      version: 'ingested-1',
      status,
      url: url || '',
      language,
      sourceLevel: level,
      lastVerifiedAt: new Date().toISOString().slice(0, 10),
      trainingEligibility: String(trainingEligibility).toUpperCase(),
      ingestionStatus: 'UPLOADED_DOCUMENT',
      attribution: attribution ? String(attribution).slice(0, 500) : String(authority).trim(),
      relations: [],
      notes: notes ? String(notes).slice(0, 1000) : 'Ingested via admin corpus panel.'
    }
  };
}

export function flagChunks(chunks) {
  return chunks.map(chunk => ({ ...chunk, flagged: detectInjection(chunk.text) }));
}
