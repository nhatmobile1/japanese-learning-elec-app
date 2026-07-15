export const config = {
  vaultPath:
    process.env.VAULT_PATH ??
    '/Users/nhattran/documents/obsidian-main/nhat-mind/efforts/japanese-learning',
  dbPath: process.env.DB_PATH ?? 'data/vocab.db',
  port: Number(process.env.PORT ?? 3456),
  // Localhost-only by default: the vault is personal. Set HOST=0.0.0.0 (or a
  // Tailscale IP) deliberately to reach the app from other devices.
  host: process.env.HOST ?? '127.0.0.1',
};
