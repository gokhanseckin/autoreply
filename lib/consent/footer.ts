const FOOTERS: Record<'tr' | 'en', (url: string) => string> = {
  tr: (url) => `Gizlilik: ${url}/p/tr`,
  en: (url) => `Privacy: ${url}/p/en`,
};

const MAX = 1000;

export function appendPrivacyFooter(body: string, language: 'tr' | 'en'): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const footer = FOOTERS[language](url);
  const sep = '\n\n—\n';
  const overhead = sep.length + footer.length;
  const bodyMax = MAX - overhead;
  const trimmed = body.length > bodyMax ? body.slice(0, bodyMax - 1).trimEnd() + '…' : body;
  return `${trimmed}${sep}${footer}`;
}
