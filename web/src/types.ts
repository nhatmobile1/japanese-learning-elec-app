export interface SearchResultWord {
  normTerm: string | null;
  term: string;
  reading: string | null;
  gloss: string | null;
  kind: string;
  occurrenceCount: number;
  lessonCount: number;
  sources: { sourceType: string; sourceRef: string }[];
  score: number;
  slug?: string;
}

export interface Entry {
  id: number;
  term: string | null;
  reading: string | null;
  gloss: string | null;
  raw: string;
  kind: string;
  source_type: string;
  source_ref: string;
  section: string | null;
  children?: Entry[];
}

export interface WordResponse {
  word: {
    norm_term: string;
    term: string;
    reading: string | null;
    gloss: string | null;
    occurrence_count: number;
    lesson_count: number;
    first_seen: string | null;
    last_seen: string | null;
  } | null;
  occurrences: Entry[];
  mentions: Entry[];
  grammarRefs?: { slug: string; title: string; jlptLevel: string | null }[];
}

export interface BrowsePage<T> {
  total: number;
  page: number;
  results: T[];
}

export interface GrammarPointSummary {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  source: string;
  jlptLevel: string | null;
}

export interface GrammarContentBlock {
  type: 'heading' | 'paragraph' | 'formula' | 'example';
  text?: string;
  level?: number;
  japanese?: string;
  english?: string;
}

export interface GrammarDetailResponse {
  point: GrammarPointSummary;
  content: { content: GrammarContentBlock[] } | null;
  lessonNotes: { normTerm: string; term: string; reading: string | null; gloss: string | null; kind: string }[];
}
