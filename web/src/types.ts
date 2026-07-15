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
}

export interface BrowsePage<T> {
  total: number;
  page: number;
  results: T[];
}
