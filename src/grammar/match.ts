import { foldForSearch } from '../lib/japanese.js';

/**
 * Japanese pattern tokens from a reference-point title.
 * "〜てしまう・〜ちゃう" → ["てしまう","ちゃう"];  "〜させる (Causative)" → ["させる"].
 */
export function patternTokens(title: string): string[] {
  return title
    .replace(/\([^)]*\)/g, '') // ASCII parenthetical (English annotation)
    .split(/[・／\/]/)
    .map((t) => foldForSearch(t.replace(/^[～〜]+|[～〜]+$/g, '')))
    // Drop English-only fragments ("form") and empties; keep Japanese tokens.
    .map((t) => t.replace(/[a-z0-9\s'-]+/g, ''))
    .filter(Boolean);
}

/**
 * Conservative match: a vault term links to a reference point only when the
 * normalized term EQUALS one of the title's pattern tokens of length ≥ 2.
 * Unsure = false — the UI must never show a wrong link.
 */
export function titleMatchesTerm(pointTitle: string, vaultNormTerm: string): boolean {
  const term = foldForSearch(vaultNormTerm);
  if (term.length < 2) return false;
  return patternTokens(pointTitle).some((tok) => tok.length >= 2 && tok === term);
}
