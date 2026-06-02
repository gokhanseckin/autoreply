function appOrigin(appUrl: string): string | null {
  const trimmed = appUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  const withProtocol =
    trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function getAuthRedirectUrl(
  requestUrl: string,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '',
): string | null {
  const url = new URL(requestUrl);
  const hasRootAuthCode = url.pathname === '/' && url.searchParams.has('code');
  const canonicalOrigin = isLocalHostname(url.hostname) ? null : appOrigin(appUrl);

  if (hasRootAuthCode) {
    url.pathname = '/auth/callback';
  }

  if (canonicalOrigin) {
    const canonical = new URL(canonicalOrigin);
    if (url.origin !== canonical.origin) {
      url.protocol = canonical.protocol;
      url.host = canonical.host;
    }
  }

  return url.toString() === requestUrl ? null : url.toString();
}
