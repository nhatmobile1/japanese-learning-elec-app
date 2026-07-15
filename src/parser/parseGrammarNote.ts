import { parseVocabLine } from './parseVocabLine.js';
import type { ParsedEntry, ParseResult } from './types.js';

const BULLET_RE = /^>([\s　]*)-[\s　]+(.*)$/;

export function parseGrammarNote(content: string, fileName: string): ParseResult {
  const sourceRef = fileName.replace(/\.md$/, '');
  const entries: ParsedEntry[] = [];
  let section: string | null = null;
  let inCallout = false;
  let lastTop: ParsedEntry | null = null;

  content.split('\n').forEach((line, i) => {
    const hm = line.match(/^##\s+(.+?)\s*$/);
    if (hm) {
      section = hm[1];
      inCallout = false;
      lastTop = null;
      return;
    }
    if (/^>\s*\[!\w+\]/.test(line)) {
      inCallout = true;
      lastTop = null;
      return;
    }
    if (!line.startsWith('>')) {
      if (line.trim()) {
        inCallout = false;
        lastTop = null;
      }
      return;
    }
    const bm = line.match(BULLET_RE);
    if (!bm || !inCallout) return;

    const parts = parseVocabLine(bm[2]);
    const entry: ParsedEntry = {
      ...parts,
      raw: bm[2].trim(),
      kind: 'grammar',
      sourceType: 'grammar-note',
      sourceRef,
      section,
      line: i + 1,
      children: [],
    };
    if (bm[1].length > 2 && lastTop) lastTop.children.push(entry);
    else {
      entries.push(entry);
      lastTop = entry;
    }
  });

  return { entries, unparsed: [] };
}
