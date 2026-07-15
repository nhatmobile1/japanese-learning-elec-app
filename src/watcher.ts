import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type Database from 'better-sqlite3';
import { reindexFile, removeFile } from './indexer.js';

const DEBOUNCE_MS = 400;

export function startWatcher(db: Database.Database, vaultPath: string): FSWatcher {
  const timers = new Map<string, NodeJS.Timeout>();

  const schedule = (absPath: string, gone: boolean) => {
    if (!absPath.endsWith('.md')) return;
    const rel = path.relative(vaultPath, absPath);
    if (rel.split(path.sep).some((seg) => seg.startsWith('_') || seg.startsWith('.'))) return;
    clearTimeout(timers.get(rel));
    timers.set(
      rel,
      setTimeout(() => {
        timers.delete(rel);
        try {
          if (gone) removeFile(db, rel);
          else reindexFile(db, vaultPath, rel);
          console.log(`[watcher] reindexed ${rel}`);
        } catch (err) {
          console.error(`[watcher] failed on ${rel}:`, err);
        }
      }, DEBOUNCE_MS),
    );
  };

  const watcher = chokidar.watch(vaultPath, {
    ignoreInitial: true,
    ignored: /(^|[/\\])\../,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });
  watcher
    .on('add', (p) => schedule(p, false))
    .on('change', (p) => schedule(p, false))
    .on('unlink', (p) => schedule(p, true));
  return watcher;
}
