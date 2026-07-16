export interface GrammarPoint {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  source: 'tofugu' | 'lessons';
  jlptLevel: string | null;
}

export interface GrammarContentBlock {
  type: 'heading' | 'paragraph' | 'formula' | 'example' | 'table';
  text?: string;
  level?: number;
  id?: string;
  japanese?: string;
  english?: string;
  rows?: string[][];
}

export interface GrammarContentFile {
  title: string;
  description: string;
  slug: string;
  categories: string[];
  content: GrammarContentBlock[];
  examples: { japanese: string; english: string; type?: string }[];
}
