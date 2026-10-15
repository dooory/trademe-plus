export function isMarketplacePath(pathname: string): boolean {
  return pathname === '/a/marketplace' || pathname.startsWith('/a/marketplace/');
}

export function buildExpiredSearchUrl(keyword: string): string {
  const url = new URL('https://www.trademe.co.nz/Browse/SearchResults.aspx');
  url.search = new URLSearchParams({
    advanced: 'true',
    searchstring: keyword.trim(),
    current: '0',
  }).toString();
  return url.href;
}
