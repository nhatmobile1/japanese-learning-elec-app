// Refresh the bundled grammar-data fallback from the sibling repo.
import fs from 'node:fs';
import path from 'node:path';

const SRC = '/Users/nhattran/Documents/projects/japanese-grammar-app/data';
const DEST = new URL('../grammar-data', import.meta.url).pathname;

if (!fs.existsSync(path.join(SRC, 'tofugu_grammar_complete.json'))) {
  console.error(`grammar repo not found at ${SRC} — keeping existing fallback`);
  process.exit(fs.existsSync(DEST) ? 0 : 1);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(path.join(DEST, 'grammar_content'), { recursive: true });
for (const f of ['tofugu_grammar_complete.json', 'custom_grammar.json']) {
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
}
for (const f of fs.readdirSync(path.join(SRC, 'grammar_content'))) {
  if (f.endsWith('.json'))
    fs.copyFileSync(path.join(SRC, 'grammar_content', f), path.join(DEST, 'grammar_content', f));
}
console.log('grammar-data fallback refreshed');
