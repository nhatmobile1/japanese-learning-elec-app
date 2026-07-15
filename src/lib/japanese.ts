const KANJI_RE = /[㐀-䶿一-鿿々〆]/;
const KANJI_RUN = '[\\u3400-\\u4dbf\\u4e00-\\u9fff々〆]+';
// Hiragana, katakana, prolonged sound mark, iteration marks, and light punctuation
// that appears inside furigana readings.
const KANA_ONLY_RE = /^[ぁ-ゖァ-ヺー-ヾゝゞー・、。～]+$/;

export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export function hasKanji(s: string): boolean {
  return KANJI_RE.test(s);
}

export function isKanaOnly(s: string): boolean {
  return s.length > 0 && KANA_ONLY_RE.test(s);
}

/** Paren content minus ［…］ asides and whitespace: "［～が］あく" → "あく". */
function cleanParenInner(inner: string): string {
  return inner.replace(/［[^］]*］/g, '').replace(/[\s　 ]/g, '');
}

/** Remove furigana groups (（…） whose content is kana); keep other parens. */
export function stripReadings(s: string): string {
  return s.replace(/（([^（）]*)）/g, (m, inner: string) =>
    isKanaOnly(cleanParenInner(inner)) ? '' : m,
  );
}

/** Kana chars of `pre`, in order, must all appear in order within `reading`. */
function kanaIsSubsequence(pre: string, reading: string): boolean {
  const kana = [...kataToHira(pre)].filter((c) => /[ぁ-ゖー]/.test(c));
  let i = 0;
  for (const c of reading) if (i < kana.length && c === kana[i]) i++;
  return i === kana.length;
}

/**
 * Best-effort hiragana rendering of a Japanese head.
 * Handles whole-word furigana (乗り換え（のりかえ）), per-kanji furigana
 * (作（つく）りましたか), and kana-only heads. Returns null when bare kanji
 * remain unreadable.
 */
export function extractReading(head: string): string | null {
  const h = head.trim();

  // Whole-word furigana: a single trailing （…） whose kana covers the head's kana.
  const t = h.match(/^([^（）]+)（([^（）]*)）$/);
  if (t) {
    const r = cleanParenInner(t[2]);
    if (isKanaOnly(r) && kanaIsSubsequence(t[1], r)) return kataToHira(r);
  }

  // Per-kanji furigana: replace each kanji-run（reading） with its reading.
  const substituted = h.replace(
    new RegExp(`(${KANJI_RUN})（([^（）]*)）`, 'g'),
    (m, _kanji: string, inner: string) => {
      const r = cleanParenInner(inner);
      return isKanaOnly(r) ? r : m;
    },
  );

  const flat = stripReadings(substituted).replace(/[\s　 ]/g, '');
  if (flat && !hasKanji(flat) && isKanaOnly(flat)) return kataToHira(flat);
  return null;
}

/** NFKC + lowercase + katakana→hiragana + strip every kind of whitespace. */
export function foldForSearch(s: string): string {
  return kataToHira(s.normalize('NFKC').toLowerCase()).replace(/[\s　 ]/g, '');
}

/** Grouping key for a term: drop ［…］ asides and leading/trailing ～〜, then fold. */
export function normalizeTerm(term: string): string {
  return foldForSearch(term.replace(/［[^］]*］/g, '').replace(/^[～〜]+|[～〜]+$/g, ''));
}
