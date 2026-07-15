import { parseVocabLine } from './parseVocabLine.js';
import type { EntryKind, ParsedEntry, ParseResult, UnparsedLine } from './types.js';

const CALLOUT_KIND: Record<string, EntryKind> = {
  example: 'vocab',
  tip: 'grammar',
  quote: 'sentence',
};

const BULLET_RE = /^>([\s　]*)-[\s　]+(.*)$/;

export function parseLessonFile(content: string): ParseResult {
  const entries: ParsedEntry[] = [];
  const unparsed: UnparsedLine[] = [];
  let date: string | null = null;
  let kind: EntryKind | null = null;
  let inUnknownCallout = false;
  let lastTop: ParsedEntry | null = null;

  content.split('\n').forEach((line, i) => {
    const lineNo = i + 1;

    const dm = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\s*$/);
    if (dm) {
      date = dm[1];
      kind = null;
      inUnknownCallout = false;
      lastTop = null;
      return;
    }

    const cm = line.match(/^>\s*\[!(\w+)\]/);
    if (cm) {
      kind = CALLOUT_KIND[cm[1].toLowerCase()] ?? null;
      inUnknownCallout = kind === null;
      lastTop = null;
      return;
    }

    if (!line.startsWith('>')) {
      if (line.trim()) {
        kind = null;
        inUnknownCallout = false;
        lastTop = null;
      }
      return;
    }

    const bm = line.match(BULLET_RE);
    if (!bm) {
      if (kind && line.replace(/^>/, '').trim()) {
        unparsed.push({ line: lineNo, text: line, reason: 'non-bullet line in callout' });
      }
      return;
    }

    if (inUnknownCallout) {
      unparsed.push({ line: lineNo, text: line, reason: 'bullet in unknown callout' });
      return;
    }
    if (!kind) {
      unparsed.push({ line: lineNo, text: line, reason: 'bullet outside any callout' });
      return;
    }
    if (!date) {
      unparsed.push({ line: lineNo, text: line, reason: 'bullet before any date heading' });
      return;
    }

    const parts = parseVocabLine(bm[2]);
    const entry: ParsedEntry = {
      ...parts,
      raw: bm[2].trim(),
      kind,
      sourceType: 'lesson',
      sourceRef: date,
      section: null,
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
