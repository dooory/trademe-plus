export const RECENT_SEARCHES_KEY = 'expiredRecentSearches';
export const RECENT_SEARCHES_MESSAGE = 'trademe-plus:recent-searches';

export function updateRecentSearches(stored: unknown, keyword: string): string[] {
  const values = [keyword, ...(Array.isArray(stored) ? stored : [])];
  const seen = new Set<string>();
  const searches: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const term = value.trim();
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    searches.push(term);
    if (searches.length === 10) break;
  }
  return searches;
}
