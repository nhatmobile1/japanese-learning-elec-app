import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.js';
import { config } from './config.js';
import { openDb } from './db.js';
import { indexVault, rebuildWords } from './indexer.js';
import { startWatcher } from './watcher.js';

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

const app = createApp(db);
app.get('/api/*', (c) => c.json({ error: 'not found' }, 404));
app.use('/*', serveStatic({ root: './web/dist' }));
app.get('*', serveStatic({ path: './web/dist/index.html' }));

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, () => {
  console.log(`[server] http://localhost:${config.port} (bound to ${config.host})`);
  if (config.host !== '127.0.0.1') {
    console.warn('[server] non-localhost bind: the app is reachable by other devices on this network');
  }
});
