import fs from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.js';
import { config } from './config.js';
import { openDb } from './db.js';
import { indexGrammarPoints } from './grammar/indexGrammar.js';
import { loadGrammarPoints, resolveGrammarDataPath } from './grammar/load.js';
import { indexVault, rebuildWords } from './indexer.js';
import { listenWithRetry } from './listen.js';
import { startWatcher } from './watcher.js';

// Under Electron's utilityProcess this exists; under plain node it doesn't.
const parentPort = (process as unknown as { parentPort?: { postMessage(m: unknown): void } })
  .parentPort;

async function main(): Promise<void> {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = openDb(config.dbPath);

  const vaultExists = fs.existsSync(config.vaultPath);
  if (!vaultExists) {
    const existing = (db.prepare('SELECT COUNT(*) AS n FROM entries').get() as { n: number }).n;
    if (existing > 0) {
      console.warn(`[server] vault not found at ${config.vaultPath} — serving stale index (${existing} entries)`);
      rebuildWords(db);
    } else {
      console.error(`[server] vault not found at ${config.vaultPath} and no existing index. Set VAULT_PATH.`);
      process.exit(1);
    }
  } else {
    const t0 = Date.now();
    const { files, entries } = indexVault(db, config.vaultPath);
    console.log(`[server] indexed ${entries} entries from ${files} files in ${Date.now() - t0}ms`);
    startWatcher(db, config.vaultPath);
  }

  const grammarPath = resolveGrammarDataPath(config.grammarDataPath, config.grammarFallbackPath);
  if (grammarPath) {
    const n = indexGrammarPoints(db, loadGrammarPoints(grammarPath));
    console.log(`[server] indexed ${n} grammar points from ${grammarPath}`);
  } else {
    console.warn(`[server] grammar data not found at ${config.grammarDataPath} (no fallback) — grammar section will be empty`);
  }

  const app = createApp(db, { grammarDataPath: grammarPath });
  app.get('/api/*', (c) => c.json({ error: 'not found' }, 404));
  // @hono/node-server's serveStatic treats root/path as cwd-relative; the shell
  // passes an absolute WEB_DIST, so convert (path.relative handles both cases).
  const webDist = path.relative(process.cwd(), path.resolve(config.webDistPath)) || '.';
  app.use('/*', serveStatic({ root: webDist }));
  app.get('*', serveStatic({ path: path.join(webDist, 'index.html') }));

  const { port } = await listenWithRetry(app.fetch, config.host, config.port);
  console.log(`[server] http://localhost:${port} (bound to ${config.host})`);
  if (config.host !== '127.0.0.1') {
    console.warn('[server] non-localhost bind: the app is reachable by other devices on this network');
  }
  parentPort?.postMessage({ type: 'ready', port });
}

main().catch((err) => {
  console.error('[server] fatal:', err);
  process.exit(1);
});
