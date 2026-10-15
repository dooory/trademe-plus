/** Match Trade Me's domain and subdomains, never lookalike domains. */
export function isTradeMeUrl(value: string | undefined): boolean {
  if (!value) return false;

  try {
    const { protocol, hostname } = new URL(value);
    return (
      (protocol === 'https:' || protocol === 'http:') &&
      (hostname === 'trademe.co.nz' || hostname.endsWith('.trademe.co.nz'))
    );
  } catch {
    return false;
  }
}
