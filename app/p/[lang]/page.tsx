import { notFound } from 'next/navigation';
import { POLICY_TR } from '@/lib/consent/policy-content.tr';
import { POLICY_EN } from '@/lib/consent/policy-content.en';

const POLICIES: Record<string, string> = { tr: POLICY_TR, en: POLICY_EN };

export default async function PrivacyPolicy({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const policy = POLICIES[lang];
  if (!policy) notFound();
  return (
    <main className="max-w-2xl mx-auto p-8 prose prose-sm whitespace-pre-wrap">
      <meta name="policy-version" content="2026-05-31.v1" />
      {policy}
    </main>
  );
}
