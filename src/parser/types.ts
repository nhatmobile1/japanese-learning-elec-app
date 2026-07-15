export type EntryKind = 'vocab' | 'grammar' | 'sentence';
export type SourceType = 'lesson' | 'genki' | 'quartet' | 'grammar-note';

export interface ParsedEntry {
  term: string | null;
  reading: string | null;
  gloss: string | null;
  raw: string;
  kind: EntryKind;
  sourceType: SourceType;
  sourceRef: string;
  section: string | null;
  line: number;
  children: ParsedEntry[];
}

export interface UnparsedLine {
  line: number;
  text: string;
  reason: string;
}

export interface ParseResult {
  entries: ParsedEntry[];
  unparsed: UnparsedLine[];
}
