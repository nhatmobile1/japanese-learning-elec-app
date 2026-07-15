export interface GrammarPoint {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  source: 'tofugu' | 'lessons';
  jlptLevel: string | null;
}

export interface GrammarContentBlock {
  type: 'heading' | 'paragraph' | 'formula' | 'example';
  text?: string;
  level?: number;
  id?: string;
  japanese?: string;
  english?: string;
}

export interface GrammarContentFile {
  title: string;
  description: string;
  slug: string;
  categories: string[];
  content: GrammarContentBlock[];
  examples: { japanese: string; english: string; type?: string }[];
}
