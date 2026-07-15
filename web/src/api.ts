import type {
  BrowsePage,
  Entry,
  GrammarDetailResponse,
  GrammarPointSummary,
  SearchResultWord,
  WordResponse,
} from './types';

export async function searchApi(
  q: string,
  kind: string,
  signal: AbortSignal,
): Promise<SearchResultWord[]> {
  const res = await fetch(
    `/api/search?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(kind)}`,
    { signal },
  );
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  return ((await res.json()) as { results: SearchResultWord[] }).results;
}

export async function wordApi(normTerm: string): Promise<WordResponse> {
  const res = await fetch(`/api/word/${encodeURIComponent(normTerm)}`);
  if (!res.ok) throw new Error(`word lookup failed: ${res.status}`);
  return (await res.json()) as WordResponse;
}

export async function browseWords(
  kind: string,
  sort: string,
  page: number,
  signal?: AbortSignal,
): Promise<BrowsePage<SearchResultWord>> {
  const res = await fetch(
    `/api/browse?kind=${encodeURIComponent(kind)}&sort=${encodeURIComponent(sort)}&page=${page}`,
    { signal },
  );
  if (!res.ok) throw new Error(`browse failed: ${res.status}`);
  return (await res.json()) as BrowsePage<SearchResultWord>;
}

export async function browseSentences(
  page: number,
  signal?: AbortSignal,
): Promise<BrowsePage<Entry>> {
  const res = await fetch(`/api/browse?kind=sentence&page=${page}`, { signal });
  if (!res.ok) throw new Error(`browse failed: ${res.status}`);
  return (await res.json()) as BrowsePage<Entry>;
}

export async function grammarPointsApi(signal?: AbortSignal): Promise<GrammarPointSummary[]> {
  const res = await fetch('/api/grammar-points', { signal });
  if (!res.ok) throw new Error(`grammar points failed: ${res.status}`);
  return ((await res.json()) as { results: GrammarPointSummary[] }).results;
}

export async function grammarPointApi(slug: string): Promise<GrammarDetailResponse> {
  const res = await fetch(`/api/grammar-points/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`grammar point failed: ${res.status}`);
  return (await res.json()) as GrammarDetailResponse;
}
