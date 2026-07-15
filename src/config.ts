import fs from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  vaultPath: string;
  dbPath: string;
  port: number;
  host: string;
  grammarDataPath: string;
  grammarFallbackPath: string | null;
  webDistPath: string;
}

export interface FileConfig {
  vaultPath?: string;
  dbPath?: string;
  port?: number;
  host?: string;
  grammarDataPath?: string;
}

function readFileConfig(appDataDir: string | undefined): FileConfig {
  if (!appDataDir) return {};
  try {
    return JSON.parse(
      fs.readFileSync(path.join(appDataDir, 'config.json'), 'utf8'),
    ) as FileConfig;
  } catch {
    return {}; // missing or malformed → defaults; never fatal
  }
}

export function loadConfig(
  env: Record<string, string | undefined>,
  fileCfg?: FileConfig,
): AppConfig {
  const file = fileCfg ?? readFileConfig(env.APP_DATA_DIR);
  return {
    vaultPath:
      env.VAULT_PATH ??
      file.vaultPath ??
      '/Users/nhattran/documents/obsidian-main/nhat-mind/efforts/japanese-learning',
    dbPath:
      env.DB_PATH ??
      file.dbPath ??
      (env.APP_DATA_DIR ? path.join(env.APP_DATA_DIR, 'vocab.db') : 'data/vocab.db'),
    port: Number(env.PORT ?? file.port ?? 3456),
    // Localhost-only by default: the vault is personal. Set HOST=0.0.0.0 (or a
    // Tailscale IP) deliberately to reach the app from other devices.
    host: env.HOST ?? file.host ?? '127.0.0.1',
    grammarDataPath:
      env.GRAMMAR_DATA_PATH ??
      file.grammarDataPath ??
      '/Users/nhattran/Documents/projects/japanese-grammar-app/data',
    grammarFallbackPath: env.GRAMMAR_FALLBACK_PATH ?? null,
    webDistPath: env.WEB_DIST ?? './web/dist',
  };
}

export const config: AppConfig = loadConfig(process.env);
