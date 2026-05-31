import { notFound } from 'next/navigation';
import { TERMS_TR } from '@/lib/consent/terms-content.tr';
import { TERMS_EN } from '@/lib/consent/terms-content.en';

const TERMS: Record<string, string> = { tr: TERMS_TR, en: TERMS_EN };

export default async function Terms({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const doc = TERMS[lang];
  if (!doc) notFound();
  return (
    <main className="max-w-2xl mx-auto p-8 prose prose-sm whitespace-pre-wrap">
      {doc}
    </main>
  );
}
