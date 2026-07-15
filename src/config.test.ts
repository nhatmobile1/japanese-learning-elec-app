import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  test('defaults when env and file are empty', () => {
    const c = loadConfig({});
    expect(c.port).toBe(3456);
    expect(c.host).toBe('127.0.0.1');
    expect(c.dbPath).toBe('data/vocab.db');
    expect(c.webDistPath).toBe('./web/dist');
    expect(c.grammarDataPath).toBe(
      '/Users/nhattran/Documents/projects/japanese-grammar-app/data',
    );
    expect(c.grammarFallbackPath).toBeNull();
  });

  test('file config beats defaults, env beats file', () => {
    const c = loadConfig(
      { PORT: '4000' },
      { port: 3999, vaultPath: '/tmp/vault-from-file' },
    );
    expect(c.port).toBe(4000);
    expect(c.vaultPath).toBe('/tmp/vault-from-file');
  });

  test('APP_DATA_DIR moves the default dbPath into the data dir', () => {
    const c = loadConfig({ APP_DATA_DIR: '/tmp/appdata' });
    expect(c.dbPath).toBe(path.join('/tmp/appdata', 'vocab.db'));
  });

  test('readFileConfig-equivalent: config singleton tolerates a missing file', async () => {
    // config.ts must not throw at import time when APP_DATA_DIR has no config.json
    const mod = await import('./config.js');
    expect(mod.config.port).toBeTypeOf('number');
  });

  test('env GRAMMAR_FALLBACK_PATH and WEB_DIST are honored', () => {
    const c = loadConfig({ GRAMMAR_FALLBACK_PATH: '/tmp/gd', WEB_DIST: '/tmp/dist' });
    expect(c.grammarFallbackPath).toBe('/tmp/gd');
    expect(c.webDistPath).toBe('/tmp/dist');
  });

  test('malformed config.json is ignored, not fatal', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
    fs.writeFileSync(path.join(dir, 'config.json'), '{not json');
    const c = loadConfig({ APP_DATA_DIR: dir });
    expect(c.port).toBe(3456);
  });
});
