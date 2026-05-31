import { notFound } from 'next/navigation';
import { DATA_DELETION_TR } from '@/lib/consent/data-deletion-content.tr';
import { DATA_DELETION_EN } from '@/lib/consent/data-deletion-content.en';

const DOCS: Record<string, string> = { tr: DATA_DELETION_TR, en: DATA_DELETION_EN };

export default async function DataDeletion({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const doc = DOCS[lang];
  if (!doc) notFound();
  return (
    <main className="max-w-2xl mx-auto p-8 prose prose-sm whitespace-pre-wrap">
      {doc}
    </main>
  );
}
