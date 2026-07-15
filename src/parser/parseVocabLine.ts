import { extractReading, stripReadings } from '../lib/japanese.js';

export interface VocabLineParts {
  term: string | null;
  reading: string | null;
  gloss: string | null;
}

// A gloss separator is a dash that follows either a closing full-width paren
// (）- gloss) or whitespace ( - gloss), and is itself followed by whitespace.
// Hyphens inside words (uh-uh) never match because they lack surrounding space.
const SEP_RE = /）[-–—][\s　]|[\s　][-–—][\s　]/;

export function parseVocabLine(text: string): VocabLineParts {
  const cleaned = text.replace(/\*/g, '').replace(/ /g, ' ').trim();

  const m = SEP_RE.exec(cleaned);
  let head = cleaned;
  let gloss: string | null = null;
  if (m) {
    const headEnd = m.index + (m[0].startsWith('）') ? 1 : 0);
    head = cleaned.slice(0, headEnd).trim();
    gloss = cleaned.slice(m.index + m[0].length).trim() || null;
  }

  const term = stripReadings(head).trim() || null;
  const reading = head.includes('（') ? extractReading(head) : null;
  return { term, reading, gloss };
}
