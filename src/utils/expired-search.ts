export function isHomepagePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/a' || pathname === '/a/';
}

export function isMarketplacePath(pathname: string): boolean {
  return pathname === '/a/marketplace' || pathname.startsWith('/a/marketplace/') ||
    pathname === '/a/search' || pathname === '/a/search/';
}

export function buildExpiredSearchUrl(keyword: string, currentParams?: URLSearchParams): string {
  const url = new URL('https://www.trademe.co.nz/Browse/SearchResults.aspx');
  const params = new URLSearchParams(currentParams);
  // The legacy site accepts mixed-case keys. Remove old keywords and pagination.
  for (const key of [...params.keys()]) {
    if (['searchstring', 'page', 'pagenumber', 'advanced', 'current'].includes(key.toLowerCase())) {
      params.delete(key);
    }
  }
  params.set('advanced', 'true');
  params.set('searchstring', keyword.trim());
  params.set('current', '0');
  url.search = params.toString();
  return url.href;
}
