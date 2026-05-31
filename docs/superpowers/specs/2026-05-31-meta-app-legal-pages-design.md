# Meta App Legal Pages — Design

**Date:** 2026-05-31
**Goal:** Make the AnyReply Meta app publishable by providing the three legally required public URLs (Privacy Policy, Terms of Service, User Data Deletion) and wiring them into the Meta app form.

## Locked decisions

| Decision | Value |
|---|---|
| Public domain | `https://autoreply-three.vercel.app` (existing stable Vercel alias → main branch) |
| Data controller / operator | Gokhan Seckin (individual) |
| Public contact email | iyibey@gmail.com |
| Data deletion mechanism | Instructions URL (no Meta callback endpoint) |

## Context (current state)

- Privacy policy already exists: `app/p/[lang]/page.tsx` renders content strings from `lib/consent/policy-content.en.ts` / `policy-content.tr.ts` with `whitespace-pre-wrap` (markdown shown as literal text — acceptable for compliance pages).
- Data erasure already works via DM keywords (`delete`, `sil`, `stop`, `unsubscribe`, `kaldir`) → `lib/flow-engine/erasure-flow.ts`, `erasure-execute.ts`.
- Privacy content contains placeholders: `[Operator name]` / `[Operatör Adı]` and `privacy@example.com`.
- No Terms of Service page exists.
- No public Data Deletion instructions page exists.
- `NEXT_PUBLIC_APP_URL` is empty in Vercel production, so the DM privacy footer (`lib/consent/footer.ts`) renders a broken relative link.

## Approach

**Approach A — mirror the existing privacy-policy pattern.** Each legal doc is a `lang`-keyed content string in `lib/consent/`, rendered by a thin `app/<doc>/[lang]/page.tsx` route that 404s on unknown languages. No new dependencies, no markdown renderer, consistent with the existing privacy page.

Rejected: B (single combined `/legal` page — Meta requires distinct Privacy vs TOS URLs); C (add markdown renderer — new dep, diverges from existing style, YAGNI).

## Changes

### 1. Fix privacy policy placeholders
- `lib/consent/policy-content.en.ts`: `[Operator name]` → `Gokhan Seckin`; `privacy@example.com` → `iyibey@gmail.com`.
- `lib/consent/policy-content.tr.ts`: `[Operatör Adı]` → `Gokhan Seckin`; `privacy@example.com` → `iyibey@gmail.com`.
- Bump policy version to `2026-05-31.v1` in **all four** locations that must stay in sync (it is written into consent logs via `CURRENT_POLICY_VERSION`):
  1. `lib/consent/policy-versions.ts` (`CURRENT_POLICY_VERSION` — consumed by `email-step.ts` + `machine.ts` consent logging)
  2. `lib/consent/policy-content.en.ts` (`Policy version:` footer line)
  3. `lib/consent/policy-content.tr.ts` (`Politika sürümü:` footer line)
  4. `app/p/[lang]/page.tsx` (`<meta name="policy-version">`)

### 2. Terms of Service
- New: `lib/consent/terms-content.en.ts` (`TERMS_EN`) and `lib/consent/terms-content.tr.ts` (`TERMS_TR`).
- New route: `app/terms/[lang]/page.tsx` — clone of `app/p/[lang]/page.tsx`, mapping `{ tr, en }` to the terms content, `notFound()` on unknown lang.
- Content sections: acceptance of terms; service description (Instagram comment-trigger + DM automation tool); acceptable use; **not affiliated with / endorsed by Meta or Instagram**; no warranty ("as is"); limitation of liability; suspension/termination; governing law (Turkey / KVKK); contact (iyibey@gmail.com). EN + TR.

### 3. Data Deletion instructions
- New: `lib/consent/data-deletion-content.en.ts` (`DATA_DELETION_EN`) and `lib/consent/data-deletion-content.tr.ts` (`DATA_DELETION_TR`).
- New route: `app/data-deletion/[lang]/page.tsx` — same thin-route pattern.
- Content: how to request deletion (DM `DELETE` / `SİL` to the connected Instagram account — triggers the existing erasure flow; or email iyibey@gmail.com); what data is erased (IG username + user id, optional email, click metadata); timeline (processed on receipt / without undue delay); confirmation behaviour.

### 4. Fix production env
- Set `NEXT_PUBLIC_APP_URL=https://autoreply-three.vercel.app` in Vercel production environment so the DM privacy footer renders an absolute, clickable link.

### 5. Deploy & verify
- Deploy to Vercel production (main).
- Verify HTTP 200 for: `/p/en`, `/p/tr`, `/terms/en`, `/terms/tr`, `/data-deletion/en`, `/data-deletion/tr`.
- Provide the user the exact strings for the Meta app form:
  - Privacy policy URL: `https://autoreply-three.vercel.app/p/en`
  - Terms of Service URL: `https://autoreply-three.vercel.app/terms/en`
  - User data deletion → Data deletion instructions URL: `https://autoreply-three.vercel.app/data-deletion/en`

## Out of scope
- Markdown rendering / page styling beyond the existing `prose whitespace-pre-wrap`.
- Meta data-deletion **callback** endpoint (signed_request handler).
- Custom domain setup.
- Changes to the erasure flow logic itself (already works).

## Verification
- `npm run build` succeeds.
- All six pages return 200 in production; unknown lang (e.g. `/terms/de`) returns 404.
- Privacy/TOS pages show "Gokhan Seckin" and "iyibey@gmail.com" — no remaining `[Operator name]` / `example.com` placeholders.
