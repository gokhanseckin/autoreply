export function authCallbackUrl(origin: string, appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''): string {
  const base = (appUrl.trim() || origin).replace(/\/+$/, '');
  const withProtocol = base.startsWith('http://') || base.startsWith('https://') ? base : `https://${base}`;
  return `${withProtocol}/auth/callback`;
}
