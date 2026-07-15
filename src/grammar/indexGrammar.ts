import type Database from 'better-sqlite3';
import { foldForSearch } from '../lib/japanese.js';
import type { GrammarPoint } from './types.js';

/** Replace-all index of reference grammar points. Startup-only; cheap (~200 rows). */
export function indexGrammarPoints(
  db: Database.Database,
  points: GrammarPoint[],
): number {
  const ins = db.prepare(`
    INSERT INTO grammar_points (slug, title, description, categories, source, jlpt_level, title_f, desc_f)
    VALUES (@slug, @title, @description, @categories, @source, @jlptLevel, @titleF, @descF)
  `);
  db.transaction(() => {
    db.exec('DELETE FROM grammar_points');
    for (const p of points) {
      ins.run({
        slug: p.slug,
        title: p.title,
        description: p.description,
        categories: JSON.stringify(p.categories),
        source: p.source,
        jlptLevel: p.jlptLevel,
        titleF: foldForSearch(p.title),
        descF: p.description.normalize('NFKC').toLowerCase(),
      });
    }
  })();
  return points.length;
}
