import fs from 'node:fs';
import path from 'node:path';
import { jlptForTitle } from './jlpt.js';
import type { GrammarContentFile, GrammarPoint } from './types.js';

export const SLUG_RE = /^[a-z0-9-]+$/;

interface RawPoint {
  title: string;
  description: string;
  categories?: string[];
  slug: string;
  source?: string;
  jlptLevel?: string;
}

export function resolveGrammarDataPath(
  primary: string,
  fallback: string | null,
): string | null {
  if (fs.existsSync(path.join(primary, 'tofugu_grammar_complete.json'))) return primary;
  if (fallback && fs.existsSync(path.join(fallback, 'tofugu_grammar_complete.json')))
    return fallback;
  return null;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function loadGrammarPoints(dataPath: string): GrammarPoint[] {
  const tofugu = readJson<{ grammar_points: RawPoint[] }>(
    path.join(dataPath, 'tofugu_grammar_complete.json'),
  ).grammar_points.map<GrammarPoint>((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    categories: p.categories ?? [],
    source: 'tofugu',
    jlptLevel: jlptForTitle(p.title),
  }));

  let custom: GrammarPoint[] = [];
  try {
    custom = readJson<{ grammar_points: RawPoint[] }>(
      path.join(dataPath, 'custom_grammar.json'),
    ).grammar_points.map<GrammarPoint>((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      categories: p.categories ?? [],
      source: 'lessons',
      jlptLevel: p.jlptLevel ?? null,
    }));
  } catch {
    // custom file is optional — Tofugu-only is a valid dataset
  }
  return [...tofugu, ...custom];
}

export function loadGrammarContent(
  dataPath: string,
  slug: string,
): GrammarContentFile | null {
  if (!SLUG_RE.test(slug)) return null;
  const file = path.join(dataPath, 'grammar_content', `${slug}.json`);
  try {
    return readJson<GrammarContentFile>(file);
  } catch {
    return null;
  }
}
