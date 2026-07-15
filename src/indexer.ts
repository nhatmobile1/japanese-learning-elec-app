import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { foldForSearch, isKanaOnly, normalizeTerm } from './lib/japanese.js';
import { parseGrammarNote } from './parser/parseGrammarNote.js';
import { parseLessonFile } from './parser/parseLessonFile.js';
import { parseTextbookFile } from './parser/parseTextbookFile.js';
import type { ParsedEntry, ParseResult } from './parser/types.js';

type Route = 'lesson' | 'textbook' | 'grammar';

export function routeFile(relPath: string): Route | null {
  // Case-insensitive: Obsidian vault folders get renamed (Lessons → lessons).
  const rel = relPath.split(path.sep).join('/').toLowerCase();
  if (/^lessons\/\d{4}\/\d{4}-\d{2}\.md$/.test(rel)) return 'lesson';
  if (rel.startsWith('vocabulary/') && rel.endsWith('.md')) return 'textbook';
  if (rel.startsWith('grammar/') && rel.endsWith('.md')) return 'grammar';
  return null;
}

export function listVaultFiles(vaultPath: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      console.error(`[indexer] failed to read directory ${dir}:`, err);
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('.') || name.startsWith('_')) continue;
      const abs = path.join(dir, name);
      try {
        if (entry.isDirectory()) walk(abs);
        else if (name.endsWith('.md')) out.push(path.relative(vaultPath, abs));
      } catch (err) {
        console.error(`[indexer] failed to process ${abs}:`, err);
      }
    }
  };
  walk(vaultPath);
  return out.sort();
}

function parseByRoute(route: Route, content: string, relPath: string): ParseResult {
  if (route === 'lesson') return parseLessonFile(content);
  if (route === 'textbook') return parseTextbookFile(content);
  return parseGrammarNote(content, path.basename(relPath));
}

function insertEntries(db: Database.Database, relPath: string, entries: ParsedEntry[]): number {
  const stmt = db.prepare(`
    INSERT INTO entries (term, reading, gloss, raw, kind, source_type, source_ref, section,
                         file, line, parent_id, norm_term, term_f, reading_f, gloss_f, raw_f)
    VALUES (@term, @reading, @gloss, @raw, @kind, @sourceType, @sourceRef, @section,
            @file, @line, @parentId, @normTerm, @termF, @readingF, @glossF, @rawF)
  `);
  let count = 0;
  const insertOne = (e: ParsedEntry, parentId: number | null): void => {
    const info = stmt.run({
      term: e.term,
      reading: e.reading,
      gloss: e.gloss,
      raw: e.raw,
      kind: e.kind,
      sourceType: e.sourceType,
      sourceRef: e.sourceRef,
      section: e.section,
      file: relPath,
      line: e.line,
      parentId,
      normTerm: e.term ? normalizeTerm(e.term) || null : null,
      termF: e.term ? foldForSearch(e.term) : null,
      readingF: e.reading ? foldForSearch(e.reading) : null,
      glossF: e.gloss ? e.gloss.normalize('NFKC').toLowerCase() : null,
      rawF: foldForSearch(e.raw),
    });
    count++;
    for (const child of e.children) insertOne(child, Number(info.lastInsertRowid));
  };
  for (const e of entries) insertOne(e, null);
  return count;
}

/** Delete + reinsert one file's rows. Caller wraps in a transaction. */
function indexFile(db: Database.Database, vaultPath: string, relPath: string): number {
  const route = routeFile(relPath);
  db.prepare('DELETE FROM entries WHERE file = ?').run(relPath);
  db.prepare('DELETE FROM unparsed WHERE file = ?').run(relPath);
  if (!route) return 0;

  const content = fs.readFileSync(path.join(vaultPath, relPath), 'utf8');
  const result = parseByRoute(route, content, relPath);
  const n = insertEntries(db, relPath, result.entries);
  const ins = db.prepare('INSERT INTO unparsed (file, line, text, reason) VALUES (?, ?, ?, ?)');
  for (const u of result.unparsed) ins.run(relPath, u.line, u.text, u.reason);
  return n;
}

/** Sortable textbook key from the first textbook source: Genki L8 → "1-08", Quartet I L5 → "2-05". */
function chapterSortKey(sources: { sourceType: string; sourceRef: string }[]): string | null {
  for (const s of sources) {
    if (s.sourceType !== 'genki' && s.sourceType !== 'quartet') continue;
    const m = s.sourceRef.match(/L(\d+)/i);
    if (!m) continue;
    return `${s.sourceType === 'genki' ? '1' : '2'}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

export function rebuildWords(db: Database.Database): void {
  db.exec('DELETE FROM words');
  const rows = db
    .prepare(
      `SELECT * FROM entries
       WHERE norm_term IS NOT NULL AND kind IN ('vocab','grammar') AND parent_id IS NULL`,
    )
    .all() as Array<{
    norm_term: string;
    term: string;
    reading: string | null;
    gloss: string | null;
    kind: string;
    source_type: string;
    source_ref: string;
  }>;

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const g = groups.get(r.norm_term);
    if (g) g.push(r);
    else groups.set(r.norm_term, [r]);
  }

  const ins = db.prepare(`
    INSERT INTO words (norm_term, term, reading, gloss, kind, occurrence_count, lesson_count,
                       sources, first_seen, last_seen, reading_sort, chapter_sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const [normTerm, group] of groups) {
    const display =
      group.find((r) => r.reading && r.gloss) ?? group.find((r) => r.gloss) ?? group[0];
    const seen = new Set<string>();
    const sources: { sourceType: string; sourceRef: string }[] = [];
    for (const r of group) {
      const key = `${r.source_type}:${r.source_ref}`;
      if (!seen.has(key)) {
        seen.add(key);
        sources.push({ sourceType: r.source_type, sourceRef: r.source_ref });
      }
    }
    // Textbooks first, then lessons newest-first.
    sources.sort((a, b) =>
      a.sourceType === 'lesson' && b.sourceType === 'lesson'
        ? b.sourceRef.localeCompare(a.sourceRef)
        : (a.sourceType === 'lesson' ? 1 : 0) - (b.sourceType === 'lesson' ? 1 : 0),
    );
    const lessonRefs = [...new Set(group.filter((r) => r.source_type === 'lesson').map((r) => r.source_ref))].sort();

    const vocabCount = group.filter((r) => r.kind === 'vocab').length;
    const kind = vocabCount * 2 >= group.length ? 'vocab' : 'grammar';
    const anyReading = group.find((r) => r.reading)?.reading ?? null;
    const readingSort = anyReading ?? (isKanaOnly(normTerm) ? normTerm : null);

    ins.run(
      normTerm,
      display.term,
      display.reading,
      display.gloss,
      kind,
      group.length,
      lessonRefs.length,
      JSON.stringify(sources),
      lessonRefs[0] ?? null,
      lessonRefs[lessonRefs.length - 1] ?? null,
      readingSort,
      chapterSortKey(sources),
    );
  }
}

export function indexVault(
  db: Database.Database,
  vaultPath: string,
): { files: number; entries: number } {
  const files = listVaultFiles(vaultPath);
  let entries = 0;
  db.transaction(() => {
    db.exec('DELETE FROM entries; DELETE FROM unparsed;');
    for (const rel of files) {
      try {
        entries += indexFile(db, vaultPath, rel);
      } catch (err) {
        console.error(`[indexer] failed to index ${rel}:`, err);
      }
    }
    rebuildWords(db);
  })();
  return { files: files.length, entries };
}

export function reindexFile(db: Database.Database, vaultPath: string, relPath: string): void {
  db.transaction(() => {
    indexFile(db, vaultPath, relPath);
    rebuildWords(db);
  })();
}

export function removeFile(db: Database.Database, relPath: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM entries WHERE file = ?').run(relPath);
    db.prepare('DELETE FROM unparsed WHERE file = ?').run(relPath);
    rebuildWords(db);
  })();
}
