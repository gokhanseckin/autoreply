# Code & Functionality Review — autoreply

**Date:** 2026-05-31
**Scope:** Full review of the Instagram DM/comment autoreply pipeline. The app has never worked end-to-end.
**Method:** Read the hot path (webhook → routing → flow engine → Meta client → DB) plus admin actions, email/links/erasure subsystems, schema migrations. Findings below are verified against code + schema, not speculative.

## TL;DR — why it has never worked

There is no single bug; there are several independent show-stoppers. In priority order:

1. **Comment flows throw on every event** — `flow_posts.post_id` is a UUID, but the webhook queries it with the Instagram media id (text). Postgres rejects it; the whole comment branch errors and is swallowed.
2. **Account lookup hinges on a hand-typed ID** — `ig_business_account_id` is free-text in the admin form. If it isn't byte-for-byte the value Meta puts in `entry.id`, every DM and comment is silently dropped. This matches the historical "user cannot be found" / "database empty despite webhook activity" symptoms.
3. **Email capture is entirely unwired** — the consent step loops on itself; `captureEmail` has zero callers.
4. **Click tracking always fails** — `bcrypt.hash(ip, salt)` throws on a plain-string salt; swallowed, so clicks are never recorded.

Signature verification (the prior 401 saga) is now correct and is *not* a current blocker.

---

## CRITICAL — blocks the core flow

### C1. Comment flows can never match (type mismatch → runtime throw)
- **Where:** `lib/flow-engine/routing.ts:19` vs `app/api/webhooks/meta/handler.ts:46`; schema `supabase/migrations/20260528010000_flow_posts.sql:3`.
- **What:** `findCommentFlow` filters `flow_posts.post_id == args.postId`, and the handler passes `postId: v.media.id` — the **Instagram media id** (a text string like `178414…`). But `flow_posts.post_id` is a **UUID FK to `posts.id`**, and `setPostFlows` (`app/admin/(gated)/posts/actions.ts:10`) stores `posts.id` UUIDs there.
- **Impact:** PostgREST sends `post_id=eq.178414…`; Postgres raises `invalid input syntax for type uuid`. `routing.ts:23` re-throws, `handler` throws, `route.ts` catch returns 200. **Every comment is silently dropped.**
- **Fix:** In `findCommentFlow`, resolve the IG media id to the internal post first (`posts` where `ig_media_id == v.media.id` → take `posts.id`), then query `flow_posts` by that UUID. Add a unit test with a real IG media id.

### C2. Account lookup depends on unvalidated free-text `ig_business_account_id`
- **Where:** `app/admin/(gated)/accounts/actions.ts:8,15` (write) vs `lib/db/queries.ts:19` / `handler.ts:44,67` (read).
- **What:** `addAccount` stores whatever the admin typed into `ig_business_account_id`. The webhook matches `entry.id` against that exact column via `findIgAccountByBusinessId`. The query is correct; the **data source is not**. If the admin pasted the IG user id, the @handle, or the FB page id instead of the IG Business Account ID that Meta emits in `entry.id`, the lookup returns `null` and the event is dropped (`continue`).
- **Impact:** Most likely root cause of "webhook receiving events but database empty." Nothing verifies this value against Graph.
- **Fix:** During account add, fetch the canonical id from Graph (`graph.instagram.com/v23.0/me?fields=id,user_id,username`) using the supplied token and persist that, instead of trusting the form. At minimum, validate and show the resolved id back to the admin. **Verify the currently-stored value matches the live webhook `entry.id` before anything else** — quickest way to confirm/deny this is the blocker.

### C3. Email capture subsystem is dead
- **Where:** `lib/flow-engine/machine.ts:111-124` (`collect_email`), `lib/flow-engine/email-step.ts` (`captureEmail`), `handler.ts` (no postback handling for `EMAIL_*`).
- **What:** `collect_email` sends a consent prompt with `EMAIL_AGREE_<id>` / `EMAIL_DECLINE_<id>` postbacks and returns `nextStepId: step.id, awaitingInputType: 'button'` — pointing at **itself**. When the user taps Agree, the handler reloads `current_step_id = <collect_email id>` and re-enters the same branch, **re-sending the prompt (infinite loop)**. The machine never transitions to an email-waiting state, never matches `EMAIL_*` payloads, and **never calls `captureEmail`** (it has zero callers). Provider config is never read from `ig_accounts.email_provider_config`.
- **Impact:** No subscriber is ever captured. The entire email/Resend/Mailchimp layer is unreachable.
- **Fix:** In the machine, handle the inbound `EMAIL_AGREE_*` button → write a `consent_log` row and set `awaitingInputType: 'email'` with a state flag; on the next inbound text, call `captureEmail` with `providerConfig` built from the account's `email_provider_config`. Handle `EMAIL_DECLINE_*` → end. Add an integration test for the agree→email→confirm path.

### C4. Click tracking always fails (bcrypt misuse)
- **Where:** `lib/links/ip-hash.ts:6`.
- **What:** `bcrypt.hash(ip, process.env.IP_HASH_SALT)` passes a plain string where bcryptjs expects an integer round count or a bcrypt-format salt (`$2a$10$…`). It throws `Invalid salt`. In `app/r/[code]/route.ts` the throw is swallowed by the surrounding try/catch, so the redirect still works but **no `clicks` row is ever written**. Separately, bcrypt is the wrong primitive — it's non-deterministic, so per-IP dedup/analytics is impossible even if it didn't throw.
- **Fix:** Replace with deterministic HMAC: `crypto.createHmac('sha256', IP_HASH_SALT).update(ip).digest('hex')`. Add a test asserting same input → same output and that a click row is inserted.

---

## HIGH — silent failures / footguns

### H1. `syncPosts` ignores Graph errors and reports false success
- **Where:** `app/admin/(gated)/posts/actions.ts:22-24`.
- **What:** No `res.ok` check. An expired/invalid token returns `{ error: {...} }`; `json.data ?? []` iterates nothing; the UI shows "Synced!" Masks the real failure and leaves zero posts (which then makes C1 untestable).
- **Fix:** Check `res.ok`; on error, surface `json.error.message` to the admin.

### H2. Newly created flows have `steps: []` and throw / no-op when triggered
- **Where:** `app/admin/(gated)/flows/actions.ts:16` seeds `steps: []`; `machine.ts:47` `firstStep` throws `Flow has no steps`; `handler.ts:50` `FlowStepsSchema.parse(flow.steps)[0]` is `undefined`.
- **What:** A flow created and attached to a post but not yet edited will, on trigger, throw in `advance` (DM/story path) or skip the private reply (comment path). Looks "configured" in the UI but does nothing.
- **Fix:** Exclude flows with empty `steps` from routing queries (or guard in the handler), and block activation of stepless flows in the admin.

### H3. No middleware to refresh the admin session
- **Where:** `lib/db/client.ts:16-19` comment claims "refresh happens in middleware/route handlers," but there is **no `middleware.ts`** in the repo.
- **What:** `setAll` is a no-op inside Server Components, so the Supabase access token is never refreshed. Initial magic-link sign-in works (cookie set in `app/auth/callback/route.ts`), but once the access token expires the gated layout's `getUser()` fails to refresh and bounces the admin to sign-in.
- **Fix:** Add `middleware.ts` running the standard Supabase SSR session-refresh, matched to `/admin/:path*`.

---

## MEDIUM

### M1. Webhook schema is brittle — drops valid payloads
- **Where:** `lib/meta/types.ts:3-47`.
- **What:** `MetaWebhookSchema` requires `object: z.literal('instagram')` and `changes` to be an array where **every** element is `field: 'comments'`. Any other change field (mentions, message reactions, mixed entries) makes `safeParse` fail → `handler.ts:37` returns 200 and the **entire delivery is dropped**, including any comment changes bundled in the same entry.
- **Fix:** Make `changes` an array of a permissive union that ignores unknown `field` values; parse the comment subset leniently. Don't let one unknown field discard the batch.

### M2. Erasure is not atomic
- **Where:** `lib/flow-engine/erasure-execute.ts`.
- **What:** Anonymizes `messages_log`/`consent_log`, deletes the contact, then marks `deletion_requests` completed — with no transaction and no try/catch. A mid-sequence throw leaves the request stranded in `pending` with partial deletion.
- **Fix:** Wrap in a Postgres function/RPC (single transaction), or reorder + guard so the request status reflects partial failure.

### M3. Multi-button flow transitions are fragile
- **Where:** `machine.ts:60-71` (send_message + buttons) vs `:90-98` (`wait_for_button`).
- **What:** For a `send_message` with buttons, the postback payload is set to the button's `next_id`, and `nextStepId` is forced to the *first* button's next. The code comments "all buttons share the same wait step." Any flow where buttons lead to *different* steps will mis-route, because the saved `current_step_id` ignores which button was actually pressed until the next `wait_for_button`/`branch` re-reads the payload. Works for a single linear "tap to continue"; misbehaves for real branching.
- **Fix:** Don't pre-advance to a guessed next step. Save the `send_message`+buttons step id with `awaiting 'button'`, and let the following `wait_for_button`/`branch` consume the real payload.

---

## LOW / cleanup

- **L1.** `app/api/webhooks/meta/route.ts:21-30` still contains the TEMP DEBUG HMAC block from the signature-debugging session. Remove it now that the secret is fixed — it recomputes the HMAC on every failed request and adds log noise.
- **L2.** Access tokens are passed in URL query strings (`posts/actions.ts:22`, `meta/client.ts:17`). Tokens leak into request logs/proxies. Prefer `Authorization: Bearer <token>` header.
- **L3.** `saveConversationState` (`queries.ts:59`) is a full-row upsert; it's safe today only because every handler call passes the full state object. If a future caller passes a partial state on insert, defaulted columns will be written. Consider an explicit update path or a typed full-state argument.
- **L4.** Mailchimp datacenter parsing (`mailchimp.ts:8`) and Resend audience handling (`resend.ts:8`) are now **correct** (the prior suffix-vs-prefix bug is fixed) — but unreachable until C3 is fixed.

---

## What's actually correct (so we don't re-break it)

- Signature verification (`lib/meta/signature.ts`) — constant-time, length-checked. Good.
- Auth gate (`app/admin/(gated)/layout.tsx`) — uses server-validated `getUser()` + allowlist. No bypass found.
- `serviceClient()` uses the service role key and correctly bypasses RLS for the webhook hot path. RLS is enabled on all tables.
- Token encryption round-trips consistently (`encryptSecret`/`encodeBytea` write ↔ `decodeBytea`/`decryptSecret` read).
- Link code generation ↔ `/r/[code]` resolution is schema-consistent (the only break is click *logging*, C4).
- `messages_log` uses `sent_at` (not `created_at`); current code does not reference a missing `created_at` — the historical symptom is resolved.

---

## Recommended action sequence

1. **Confirm C2 first** (5 min): compare the stored `ig_accounts.ig_business_account_id` against a live webhook `entry.id`. This alone may explain "never worked."
2. **Fix C1 + H1 + H2** together (comment routing + sync errors + empty-flow guard) so a comment-trigger flow can be authored and tested end-to-end.
3. **Fix C4** (HMAC) — small, isolated, unblocks click analytics.
4. **Fix C3** (email wiring) — the largest piece; needs machine changes + an integration test.
5. **Then** M1 (schema leniency), H3 (middleware), M2 (erasure atomicity), and the LOW cleanups.
6. Remove the TEMP DEBUG block (L1) before any production redeploy.

Each fix should land with a test: the repo already has good unit coverage (`tests/unit/*`) and webhook fixtures (`tests/fixtures/meta/*`) to build integration tests on.
