/**
 * Formula/table line-splitting ported from japanese-grammar-app/index.html.
 * Tofugu formula blocks pack several equations into one string:
 *   "会（あ）う + った = 会（あ）った 立（た）つ + った = 立（た）った"
 * and conjugation-table cells pack several pairs:
 *   "会（あ）う → 会（あ）った 立（た）つ → 立（た）った"
 */

/** Split "A + B = C  D + E = F" (or "A → B  C → D") formulas into lines. */
export function splitFormulaLines(text: string): string[] {
  if (!text) return [text];
  if (text.includes('=')) {
    const parts = text.match(/\S+(?:\s*\+\s*\S+)*\s*=\s*\S+/g);
    if (parts && parts.length > 1) return parts;
  }
  if (text.includes('→')) {
    const parts = text.match(/\S+\s*→\s*\S+/g);
    if (parts && parts.length > 1) return parts;
  }
  return [text];
}

/** Split "X → Y  Z → W" conjugation cells into lines. */
export function splitConjugationLines(text: string): string[] {
  if (!text) return [text];
  const pairs = text.match(/\S+\s*→\s*\S+/g);
  if (pairs && pairs.length > 1) return pairs;
  return [text];
}

/**
 * Tofugu pages repeat each formula as a mangled plain paragraph right after
 * the formula block (a scraper artifact, often with wrong readings). The
 * original app hides them; compare with readings and whitespace stripped.
 */
export function isFormulaDuplicate(formulaText: string, paragraphText: string): boolean {
  const strip = (s: string) => s.replace(/\s+/g, '').replace(/（[^）]*）/g, '');
  const f = strip(formulaText);
  const p = strip(paragraphText);
  return f.length > 0 && p.length > 0 && (p.includes(f) || f.includes(p));
}
