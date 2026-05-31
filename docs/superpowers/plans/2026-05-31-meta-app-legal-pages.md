# Meta App Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the three legally required public pages (Privacy Policy, Terms of Service, Data Deletion instructions) so the AnyReply Meta app can be submitted for publishing.

**Architecture:** Mirror the existing privacy-policy pattern — each legal document is a `lang`-keyed string constant in `lib/consent/`, rendered by a thin `app/<doc>/[lang]/page.tsx` route that `notFound()`s on unknown languages. Fix the existing privacy placeholders, add TOS + data-deletion docs, set the production base URL, deploy via push-to-main, and verify all six URLs serve 200.

**Tech Stack:** Next.js 16 (App Router), React 19, Vitest (unit), Playwright (e2e), Vercel (deploy), Supabase (data).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/consent/policy-content.en.ts` | EN privacy text | Modify (fill placeholders, bump version) |
| `lib/consent/policy-content.tr.ts` | TR privacy text | Modify (fill placeholders, bump version) |
| `lib/consent/policy-versions.ts` | `CURRENT_POLICY_VERSION` (logged into consent records) | Modify (bump version) |
| `app/p/[lang]/page.tsx` | Privacy route + `<meta>` version | Modify (bump version) |
| `lib/consent/terms-content.en.ts` | EN Terms of Service text | Create |
| `lib/consent/terms-content.tr.ts` | TR Terms of Service text | Create |
| `app/terms/[lang]/page.tsx` | Terms route | Create |
| `lib/consent/data-deletion-content.en.ts` | EN data-deletion instructions | Create |
| `lib/consent/data-deletion-content.tr.ts` | TR data-deletion instructions | Create |
| `app/data-deletion/[lang]/page.tsx` | Data-deletion route | Create |
| `tests/unit/legal-content.test.ts` | Asserts required clauses + version present in all legal content | Create |
| `tests/e2e/smoke.spec.ts` | Route smoke tests | Modify (add terms + data-deletion routes) |

---

## Task 1: Fix privacy policy placeholders + bump version

**Files:**
- Modify: `lib/consent/policy-content.en.ts`
- Modify: `lib/consent/policy-content.tr.ts`
- Modify: `lib/consent/policy-versions.ts`
- Modify: `app/p/[lang]/page.tsx:13`
- Test: `tests/unit/legal-content.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/legal-content.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { POLICY_EN } from '@/lib/consent/policy-content.en';
import { POLICY_TR } from '@/lib/consent/policy-content.tr';
import { CURRENT_POLICY_VERSION } from '@/lib/consent/policy-versions';

const VERSION = '2026-05-31.v1';

describe('privacy policy content', () => {
  it('names the real operator and contact, no placeholders', () => {
    for (const doc of [POLICY_EN, POLICY_TR]) {
      expect(doc).toContain('Gokhan Seckin');
      expect(doc).toContain('iyibey@gmail.com');
      expect(doc).not.toContain('[Operator');
      expect(doc).not.toContain('[Operatör');
      expect(doc).not.toContain('example.com');
    }
  });

  it('carries the bumped policy version everywhere', () => {
    expect(CURRENT_POLICY_VERSION).toBe(VERSION);
    expect(POLICY_EN).toContain(VERSION);
    expect(POLICY_TR).toContain(VERSION);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/legal-content.test.ts`
Expected: FAIL — current content has `[Operator name]` / `[Operatör Adı]`, `privacy@example.com`, and version `2026-05-27.v1`.

- [ ] **Step 3: Apply the edits**

In `lib/consent/policy-content.en.ts`:
- Replace `**Data controller:** [Operator name] — contact: privacy@example.com` with `**Data controller:** Gokhan Seckin — contact: iyibey@gmail.com`
- Replace `Policy version: 2026-05-27.v1` with `Policy version: 2026-05-31.v1`

In `lib/consent/policy-content.tr.ts`:
- Replace `**Veri Sorumlusu:** [Operatör Adı] — iletişim: privacy@example.com` with `**Veri Sorumlusu:** Gokhan Seckin — iletişim: iyibey@gmail.com`
- Replace `Politika sürümü: 2026-05-27.v1` with `Politika sürümü: 2026-05-31.v1`

In `lib/consent/policy-versions.ts`:
- Replace `export const CURRENT_POLICY_VERSION = '2026-05-27.v1';` with `export const CURRENT_POLICY_VERSION = '2026-05-31.v1';`

In `app/p/[lang]/page.tsx` line 13:
- Replace `<meta name="policy-version" content="2026-05-27.v1" />` with `<meta name="policy-version" content="2026-05-31.v1" />`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/legal-content.test.ts`
Expected: PASS (both `describe` blocks green).

- [ ] **Step 5: Commit**

```bash
git add lib/consent/policy-content.en.ts lib/consent/policy-content.tr.ts lib/consent/policy-versions.ts app/p/[lang]/page.tsx tests/unit/legal-content.test.ts
git commit -m "fix: fill privacy policy operator details and bump version"
```

---

## Task 2: Terms of Service content + route

**Files:**
- Create: `lib/consent/terms-content.en.ts`
- Create: `lib/consent/terms-content.tr.ts`
- Create: `app/terms/[lang]/page.tsx`
- Test: `tests/unit/legal-content.test.ts` (extend), `tests/e2e/smoke.spec.ts` (extend)

- [ ] **Step 1: Write the failing unit test**

Append to `tests/unit/legal-content.test.ts`:

```typescript
import { TERMS_EN } from '@/lib/consent/terms-content.en';
import { TERMS_TR } from '@/lib/consent/terms-content.tr';

describe('terms of service content', () => {
  it('declares operator, no-affiliation, and contact (EN)', () => {
    expect(TERMS_EN).toContain('Gokhan Seckin');
    expect(TERMS_EN).toContain('not');           // "not ... affiliated"
    expect(TERMS_EN.toLowerCase()).toContain('affiliated');
    expect(TERMS_EN).toContain('iyibey@gmail.com');
  });

  it('declares operator, no-affiliation, and contact (TR)', () => {
    expect(TERMS_TR).toContain('Gokhan Seckin');
    expect(TERMS_TR).toContain('ilişkili değildir');
    expect(TERMS_TR).toContain('iyibey@gmail.com');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/unit/legal-content.test.ts`
Expected: FAIL — `Cannot find module '@/lib/consent/terms-content.en'`.

- [ ] **Step 3: Create the EN content**

Create `lib/consent/terms-content.en.ts`:

```typescript
export const TERMS_EN = `
# Terms of Service

**Operator:** Gokhan Seckin — contact: iyibey@gmail.com
**Effective:** 2026-05-31

## 1. Acceptance
By using AnyReply ("the Service"), you agree to these Terms. If you do not agree, do not use the Service.

## 2. The Service
AnyReply is an automation tool for Instagram. When a user comments on a connected Instagram account or sends it a direct message, the Service may reply automatically and send follow-up direct messages according to flows configured by the account operator.

## 3. Not affiliated with Meta
AnyReply is an independent tool. It is not created by, endorsed by, sponsored by, or affiliated with Meta Platforms, Inc., Instagram, or Facebook. "Instagram" is a trademark of its respective owner.

## 4. Acceptable use
You agree not to use the Service to send spam, harass, deceive, or distribute unlawful content, or in any way that violates the Instagram Platform Terms or applicable law. You are responsible for the messages your configured flows send.

## 5. No warranty
The Service is provided "as is" and "as available", without warranties of any kind. We do not guarantee uninterrupted or error-free operation, or that messages will be delivered.

## 6. Limitation of liability
To the maximum extent permitted by law, the operator is not liable for any indirect, incidental, or consequential damages arising from your use of the Service.

## 7. Suspension and termination
We may suspend or terminate access at any time, including if you breach these Terms or the Instagram Platform Terms.

## 8. Changes
We may update these Terms. Continued use after changes means you accept the updated Terms.

## 9. Governing law
These Terms are governed by the laws of the Republic of Türkiye. Personal data is handled under KVKK and, where applicable, the GDPR — see the Privacy Policy.

## 10. Contact
Questions: iyibey@gmail.com
`;
```

- [ ] **Step 4: Create the TR content**

Create `lib/consent/terms-content.tr.ts`:

```typescript
export const TERMS_TR = `
# Kullanım Koşulları

**İşletmeci:** Gokhan Seckin — iletişim: iyibey@gmail.com
**Yürürlük:** 2026-05-31

## 1. Kabul
AnyReply'ı ("Hizmet") kullanarak bu Koşulları kabul etmiş olursunuz. Kabul etmiyorsanız Hizmeti kullanmayın.

## 2. Hizmet
AnyReply, Instagram için bir otomasyon aracıdır. Bir kullanıcı bağlı Instagram hesabına yorum yaptığında veya doğrudan mesaj gönderdiğinde, Hizmet hesap işletmecisinin tanımladığı akışlara göre otomatik yanıt verebilir ve takip mesajları gönderebilir.

## 3. Meta ile ilişki yoktur
AnyReply bağımsız bir araçtır. Meta Platforms, Inc., Instagram veya Facebook tarafından oluşturulmamış, onaylanmamış, desteklenmemiş olup bunlarla ilişkili değildir. "Instagram" ilgili sahibinin ticari markasıdır.

## 4. Kabul edilebilir kullanım
Hizmeti spam, taciz, aldatma veya hukuka aykırı içerik dağıtmak için ya da Instagram Platform Koşullarını veya geçerli yasaları ihlal edecek şekilde kullanmamayı kabul edersiniz. Tanımladığınız akışların gönderdiği mesajlardan siz sorumlusunuz.

## 5. Garanti verilmez
Hizmet "olduğu gibi" ve "mevcut haliyle", hiçbir garanti olmaksızın sunulur. Kesintisiz veya hatasız çalışacağını ya da mesajların iletileceğini garanti etmeyiz.

## 6. Sorumluluğun sınırlandırılması
Yasaların izin verdiği azami ölçüde, işletmeci Hizmeti kullanmanızdan kaynaklanan dolaylı, arızi veya sonuçsal zararlardan sorumlu değildir.

## 7. Askıya alma ve fesih
Bu Koşulları veya Instagram Platform Koşullarını ihlal etmeniz dahil, erişimi her zaman askıya alabilir veya sonlandırabiliriz.

## 8. Değişiklikler
Bu Koşulları güncelleyebiliriz. Değişikliklerden sonra kullanmaya devam etmeniz güncel Koşulları kabul ettiğiniz anlamına gelir.

## 9. Uygulanacak hukuk
Bu Koşullar Türkiye Cumhuriyeti yasalarına tabidir. Kişisel veriler KVKK ve geçerli olduğu hallerde GDPR kapsamında işlenir — Gizlilik Politikasına bakınız.

## 10. İletişim
Sorularınız: iyibey@gmail.com
`;
```

- [ ] **Step 5: Create the route**

Create `app/terms/[lang]/page.tsx`:

```tsx
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
```

- [ ] **Step 6: Run unit test to verify it passes**

Run: `npm test -- tests/unit/legal-content.test.ts`
Expected: PASS (terms describe blocks green).

- [ ] **Step 7: Add e2e smoke for the route**

In `tests/e2e/smoke.spec.ts`, append:

```typescript
test('terms of service renders TR and EN', async ({ page }) => {
  await page.goto('/terms/tr');
  await expect(page.getByText('Kullanım Koşulları')).toBeVisible();
  await page.goto('/terms/en');
  await expect(page.getByText('Terms of Service')).toBeVisible();
});
```

- [ ] **Step 8: Commit**

```bash
git add lib/consent/terms-content.en.ts lib/consent/terms-content.tr.ts app/terms/[lang]/page.tsx tests/unit/legal-content.test.ts tests/e2e/smoke.spec.ts
git commit -m "feat: add Terms of Service pages (EN/TR)"
```

---

## Task 3: Data Deletion instructions content + route

**Files:**
- Create: `lib/consent/data-deletion-content.en.ts`
- Create: `lib/consent/data-deletion-content.tr.ts`
- Create: `app/data-deletion/[lang]/page.tsx`
- Test: `tests/unit/legal-content.test.ts` (extend), `tests/e2e/smoke.spec.ts` (extend)

- [ ] **Step 1: Write the failing unit test**

Append to `tests/unit/legal-content.test.ts`:

```typescript
import { DATA_DELETION_EN } from '@/lib/consent/data-deletion-content.en';
import { DATA_DELETION_TR } from '@/lib/consent/data-deletion-content.tr';

describe('data deletion content', () => {
  it('explains the DELETE keyword and contact (EN)', () => {
    expect(DATA_DELETION_EN).toContain('DELETE');
    expect(DATA_DELETION_EN).toContain('iyibey@gmail.com');
  });

  it('explains the SİL keyword and contact (TR)', () => {
    expect(DATA_DELETION_TR).toContain('SİL');
    expect(DATA_DELETION_TR).toContain('iyibey@gmail.com');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/unit/legal-content.test.ts`
Expected: FAIL — `Cannot find module '@/lib/consent/data-deletion-content.en'`.

- [ ] **Step 3: Create the EN content**

Create `lib/consent/data-deletion-content.en.ts` (note: backticks around DELETE/SİL are escaped because the string is a template literal):

```typescript
export const DATA_DELETION_EN = `
# Data Deletion Instructions

**Operator:** Gokhan Seckin — contact: iyibey@gmail.com

AnyReply lets you delete all personal data we hold about you at any time.

## How to request deletion
- **Easiest:** Send a direct message containing the word \`DELETE\` (or \`SİL\`) to the Instagram account you interacted with. This immediately starts our automated erasure flow and asks you to confirm.
- **By email:** Write to iyibey@gmail.com, telling us the Instagram username you used.

## What is deleted
- Your Instagram username and Instagram user id
- Any email address you optionally provided
- Click metadata for tracked links (timestamps, the one-way hash of your IP)

## When
Requests are processed on receipt, without undue delay. Once deleted, the data cannot be recovered.

## Confirmation
The automated flow replies "Your data has been deleted." For email requests, we reply to confirm completion.
`;
```

- [ ] **Step 4: Create the TR content**

Create `lib/consent/data-deletion-content.tr.ts`:

```typescript
export const DATA_DELETION_TR = `
# Veri Silme Talimatları

**İşletmeci:** Gokhan Seckin — iletişim: iyibey@gmail.com

AnyReply, hakkınızda tuttuğumuz tüm kişisel verileri dilediğiniz zaman silmenize olanak tanır.

## Silme talebi nasıl yapılır
- **En kolayı:** Etkileşimde bulunduğunuz Instagram hesabına \`SİL\` (veya \`DELETE\`) kelimesini içeren bir doğrudan mesaj gönderin. Bu, otomatik silme akışımızı hemen başlatır ve onayınızı ister.
- **E-posta ile:** Kullandığınız Instagram kullanıcı adını belirterek iyibey@gmail.com adresine yazın.

## Hangi veriler silinir
- Instagram kullanıcı adınız ve Instagram kullanıcı kimliğiniz
- İsteğe bağlı olarak verdiğiniz e-posta adresi
- Takip edilen bağlantılara ait tıklama meta-verisi (zaman damgaları, IP'nizin tek yönlü özeti)

## Ne zaman
Talepler alındığında, gecikmeksizin işlenir. Silindikten sonra veriler kurtarılamaz.

## Onay
Otomatik akış "Verilerin silindi." yanıtını verir. E-posta talepleri için tamamlandığını teyit eden bir yanıt göndeririz.
`;
```

- [ ] **Step 5: Create the route**

Create `app/data-deletion/[lang]/page.tsx`:

```tsx
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
```

- [ ] **Step 6: Run unit test to verify it passes**

Run: `npm test -- tests/unit/legal-content.test.ts`
Expected: PASS (data-deletion describe blocks green).

- [ ] **Step 7: Add e2e smoke for the route**

In `tests/e2e/smoke.spec.ts`, append:

```typescript
test('data deletion renders TR and EN', async ({ page }) => {
  await page.goto('/data-deletion/tr');
  await expect(page.getByText('Veri Silme Talimatları')).toBeVisible();
  await page.goto('/data-deletion/en');
  await expect(page.getByText('Data Deletion Instructions')).toBeVisible();
});
```

- [ ] **Step 8: Commit**

```bash
git add lib/consent/data-deletion-content.en.ts lib/consent/data-deletion-content.tr.ts app/data-deletion/[lang]/page.tsx tests/unit/legal-content.test.ts tests/e2e/smoke.spec.ts
git commit -m "feat: add data deletion instructions pages (EN/TR)"
```

---

## Task 4: Set production base URL in Vercel

**Files:** none (Vercel environment change).

- [ ] **Step 1: Check current value**

Run: `vercel env ls production`
Expected: shows whether `NEXT_PUBLIC_APP_URL` already exists for production (memory says it is empty/missing).

- [ ] **Step 2: Remove stale value if present**

Only if it exists for production:
Run: `vercel env rm NEXT_PUBLIC_APP_URL production -y`
Expected: `Removed Environment Variable NEXT_PUBLIC_APP_URL`.

- [ ] **Step 3: Add the correct value**

Run: `printf "https://autoreply-three.vercel.app" | vercel env add NEXT_PUBLIC_APP_URL production`
Expected: `Added Environment Variable NEXT_PUBLIC_APP_URL to ... [production]`.

- [ ] **Step 4: Confirm**

Run: `vercel env ls production`
Expected: `NEXT_PUBLIC_APP_URL` listed under production. (Value takes effect on next production build — Task 5.)

---

## Task 5: Deploy to production and verify

**Files:** none (deploy + verification).

Deploy via push-to-main (Vercel git integration auto-builds production). This avoids the local `vercel --prod` Trash-permission error seen previously.

- [ ] **Step 1: Run the full test suite locally**

Run: `npm test`
Expected: all unit + integration tests PASS, including the new `tests/unit/legal-content.test.ts`.

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: `✓ Compiled successfully`; routes `/terms/[lang]` and `/data-deletion/[lang]` appear in the route list.

- [ ] **Step 3: Push to main to trigger production deploy**

```bash
git push origin main
```
Expected: push succeeds; Vercel starts a production deployment for the main branch.

- [ ] **Step 4: Wait for the deployment to finish**

Run: `vercel ls autoreply | head -3`
Expected: newest deployment shows state `Ready`. (Re-run until Ready.)

- [ ] **Step 5: Confirm the production alias points at the new deployment**

Run: `vercel alias ls 2>/dev/null | grep autoreply-three`
Expected: `autoreply-three.vercel.app` maps to the latest Ready deployment. If it still points to an older deployment, re-alias:
Run: `vercel alias set <newest-ready-deployment-url> autoreply-three.vercel.app`
Expected: `Success! ... now points to ...`.

- [ ] **Step 6: Verify all six legal URLs return 200**

Run:
```bash
for u in p/en p/tr terms/en terms/tr data-deletion/en data-deletion/tr; do \
  echo -n "$u -> "; curl -s -o /dev/null -w "%{http_code}\n" "https://autoreply-three.vercel.app/$u"; \
done
```
Expected: every line ends in `200`.

- [ ] **Step 7: Verify an unknown language 404s**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "https://autoreply-three.vercel.app/terms/de"`
Expected: `404`.

- [ ] **Step 8: Verify the privacy page shows real operator details (no placeholder leaked)**

Run: `curl -s "https://autoreply-three.vercel.app/p/en" | grep -o "Gokhan Seckin"`
Expected: prints `Gokhan Seckin`.

- [ ] **Step 9: Hand the URLs to the user for the Meta app form**

Report these exact strings to paste into the AnyReply Meta app settings:
- **Privacy policy URL:** `https://autoreply-three.vercel.app/p/en`
- **Terms of Service URL:** `https://autoreply-three.vercel.app/terms/en`
- **User data deletion → Data deletion instructions URL:** `https://autoreply-three.vercel.app/data-deletion/en`

---

## Done when
- All six legal URLs serve 200 in production; unknown lang 404s.
- Privacy/TOS pages show "Gokhan Seckin" + "iyibey@gmail.com" — no `[Operator…]` / `example.com` placeholders remain.
- `NEXT_PUBLIC_APP_URL` is set in Vercel production.
- The three URLs are reported to the user for pasting into the Meta app form.
