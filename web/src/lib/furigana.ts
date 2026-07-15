const KANJI_RUN = '[\\u3400-\\u4dbf\\u4e00-\\u9fff々〆]+';
const KANA_ONLY_RE = /^[ぁ-ゖァ-ヺー-ヾゝゞー・、。～]+$/;
const PAIR_RE = new RegExp(`(${KANJI_RUN})（([^（）]+)）`, 'g');

export interface RubySegment {
  base: string;
  ruby?: string;
}

/** Split 漢字（かな） furigana notation into ruby segments; leaves other text alone. */
export function parseFurigana(text: string): RubySegment[] {
  const out: RubySegment[] = [];
  let last = 0;
  for (const m of text.matchAll(PAIR_RE)) {
    if (!KANA_ONLY_RE.test(m[2])) continue; // （English） etc. — not furigana
    if (m.index > last) out.push({ base: text.slice(last, m.index) });
    out.push({ base: m[1], ruby: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ base: text.slice(last) });
  return out;
}
