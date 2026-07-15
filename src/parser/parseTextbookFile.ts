import { parseVocabLine } from './parseVocabLine.js';
import type { ParsedEntry, ParseResult, SourceType, UnparsedLine } from './types.js';

const BULLET_RE = /^>([\s　]*)-[\s　]+(.*)$/;

function parseFrontmatter(content: string): Record<string, string> {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

export function parseTextbookFile(content: string): ParseResult {
  const fm = parseFrontmatter(content);
  if (!fm.textbook || !fm.chapter) return { entries: [], unparsed: [] }; // index/MOC file

  const tb = fm.textbook.toLowerCase();
  const sourceType: SourceType = tb.includes('genki') ? 'genki' : 'quartet';
  const label =
    sourceType === 'genki'
      ? 'Genki'
      : `Quartet ${(fm.textbook.match(/quartet\s+(\S+)/i)?.[1] ?? 'I').toUpperCase()}`;
  const sourceRef = `${label} ${fm.chapter}`;

  const entries: ParsedEntry[] = [];
  const unparsed: UnparsedLine[] = [];
  let section: string | null = null;
  let inVocab = false;
  let lastTop: ParsedEntry | null = null;

  content.split('\n').forEach((line, i) => {
    const lineNo = i + 1;

    const hm = line.match(/^##\s+(.+?)\s*$/);
    if (hm) {
      section = hm[1];
      inVocab = false;
      lastTop = null;
      return;
    }

    const cm = line.match(/^>\s*\[!(\w+)\]/);
    if (cm) {
      inVocab = cm[1].toLowerCase() === 'example';
      lastTop = null;
      return;
    }

    if (!line.startsWith('>')) {
      if (line.trim()) {
        inVocab = false;
        lastTop = null;
      }
      return;
    }

    const bm = line.match(BULLET_RE);
    if (!bm) {
      if (inVocab && line.replace(/^>/, '').trim()) {
        unparsed.push({ line: lineNo, text: line, reason: 'non-bullet line in callout' });
      }
      return;
    }
    if (!inVocab) return;

    const parts = parseVocabLine(bm[2]);
    const entry: ParsedEntry = {
      ...parts,
      raw: bm[2].trim(),
      kind: 'vocab',
      sourceType,
      sourceRef,
      section,
      line: lineNo,
      children: [],
    };

    if (bm[1].length > 2 && lastTop) lastTop.children.push(entry);
    else {
      entries.push(entry);
      lastTop = entry;
    }
  });

  return { entries, unparsed };
}
