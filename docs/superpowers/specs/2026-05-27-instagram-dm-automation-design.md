# Instagram DM Automation — Design Spec

**Date:** 2026-05-27
**Status:** Approved (brainstorming complete, ready for implementation plan)
**Scope:** Personal-use ManyChat-style automation for a single operator running multiple Instagram Business accounts.

---

## 1. Goal and non-goals

### Goal
Operate keyword-triggered DM flows across the operator's own Instagram accounts: when a follower comments a keyword on a chosen post, DMs a keyword, or replies to a Story, send a pre-authored multi-step DM flow that may include buttons, tracked links, and optional email capture — fully compliant with KVKK, GDPR, and CCPA.

### Non-goals (explicit)
- Multi-tenant SaaS, billing, signup, team roles.
- Visual drag-and-drop flow canvas (form-based authoring only in v1).
- Scheduled future-dated follow-up messages (e.g., "send X 24h later") — out of v1.
- Branching beyond simple button-payload routing.
- Mobile native app.
- Direct provisioning of Meta App approval — that's done by the operator on developers.facebook.com.

---

## 2. Decisions captured from brainstorming

| Topic                  | Decision                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Instagram API          | Official Meta Graph API with `instagram_manage_messages` permission                   |
| Accounts               | Multiple IG accounts, single admin user                                               |
| Hosting & stack        | Next.js 16 (App Router) on Vercel + Supabase Postgres + Supabase Auth                 |
| Flow depth             | Multi-step linear flows with postback and URL buttons                                 |
| Triggers               | Post-comment keyword, DM keyword, story reply                                         |
| Link tracking          | Custom short URLs (`/r/<code>`) with per-recipient unique codes                       |
| Email capture          | DM gift always; optional email gift via pluggable provider adapter                    |
| Compliance jurisdictions| KVKK + GDPR + CCPA (single notice satisfies the strictest standard, localized TR/EN) |
| Consent UX             | Privacy-policy footer on every DM + explicit consent button at email step             |
| Admin auth             | Supabase Auth magic link, single allowlisted email                                    |
| Erasure                | DM keyword (`DELETE`/`SİL`/`STOP`) + admin dashboard                                  |
| Language               | Per-flow `language` field (TR/EN)                                                     |
| Architecture           | Approach A — single Next.js app, DB-driven flows, state-machine execution             |

---

## 3. System architecture

One Next.js 16 app on Vercel, three bounded concerns:

1. **`/admin/*`** — server-rendered admin UI (React Server Components). Magic-link sign-in via Supabase Auth, email allowlist enforced on every request. Manages IG accounts, monitored posts, flows, contacts, stats.
2. **`/api/webhooks/meta`** — POST endpoint Meta calls for every subscribed event. Verifies HMAC-SHA256 signature, dedupes by event id, routes the event to the flow engine.
3. **`/r/[code]`** — public GET endpoint for short-link redirects. Logs click then 302-redirects to the stored destination URL.
4. **`/p/[lang]`** — public privacy-policy page (TR/EN versions).

**Supabase Postgres** holds all state. Row-level security on every table; only the server-side service role key reads/writes. **Supabase Auth** for admin magic link.

**Meta Graph API** is the only mandatory external dependency. **Email provider adapter** is pluggable: `NoneAdapter` (default, DM-only), `ResendAdapter`, `MailchimpAdapter` — chosen per flow.

### Trust boundaries

- Meta webhook → HMAC signature verification on every request, reject if invalid (401, no body).
- Public `/r/[code]` → no auth, destination URL stored server-side (not encoded in the code), per-IP rate limit to prevent crawler abuse.
- Admin → Supabase session cookie + email allowlist check in `(admin)` layout's server component.
- Page access tokens encrypted at rest with libsodium using a key from Vercel env vars.

### Why this architecture

At expected personal volume (likely < 1k DMs/day), Vercel Fluid Compute handles the webhook handler without a separate queue. Failed Meta API calls are recorded inline for manual retry from the admin UI rather than auto-retried. If volume ever justifies it, sending can move behind Vercel Queues with a minor refactor — the state machine is already isolated.

---

## 4. Data model

All tables in Supabase Postgres. RLS enabled, service role only.

```sql
ig_accounts(
  id uuid pk,
  ig_business_account_id text unique,
  fb_page_id text,
  page_access_token_enc bytea,       -- libsodium-sealed
  name text,
  default_language text,             -- 'tr' | 'en'
  email_provider_config jsonb,       -- {kind: 'none'|'resend'|'mailchimp', api_key_enc, audience_id, ...}
  created_at timestamptz
)

posts(
  id uuid pk,
  ig_account_id uuid fk,
  ig_media_id text unique,
  caption_excerpt text,
  permalink text,
  monitored bool default false,
  created_at timestamptz
)

flows(
  id uuid pk,
  ig_account_id uuid fk,
  name text,
  language text,                     -- 'tr' | 'en'
  trigger_type text,                 -- 'comment' | 'dm' | 'story_reply'
  trigger_keywords text[],
  post_id uuid fk nullable,          -- required when trigger_type='comment'
  steps jsonb,                       -- validated by Zod schema
  email_capture_enabled bool default false,
  email_provider text default 'none',
  archived bool default false,
  created_at timestamptz,
  updated_at timestamptz
)

contacts(
  id uuid pk,
  ig_account_id uuid fk,
  ig_user_id text,                   -- Meta's IGSID
  ig_username text,
  language text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  deleted_at timestamptz nullable,   -- soft-delete marker
  unique(ig_account_id, ig_user_id)
)

conversation_state(
  id uuid pk,
  contact_id uuid fk unique,
  current_flow_id uuid fk nullable,
  current_step_id text nullable,
  awaiting_input_type text nullable, -- 'email' | 'button' | null
  context jsonb,                     -- arbitrary flow-local state
  expires_at timestamptz,            -- 24h window tracker
  updated_at timestamptz
)

messages_log(
  id uuid pk,
  ig_account_id uuid fk,
  contact_id uuid fk,
  direction text,                    -- 'in' | 'out'
  message_type text,                 -- 'text' | 'buttons' | 'postback' | 'comment_reply' | ...
  payload jsonb,
  meta_message_id text unique,       -- dedupe key
  error jsonb nullable,              -- {code, type, fbtrace_id, ts}
  sent_at timestamptz
)

links(
  id uuid pk,
  flow_id uuid fk,
  step_id text,
  label text,
  destination_url text,
  created_at timestamptz
)

link_codes(
  id uuid pk,
  link_id uuid fk,
  contact_id uuid fk,
  code text unique,                  -- nanoid(10)
  first_clicked_at timestamptz nullable,
  created_at timestamptz
)

clicks(
  id uuid pk,
  link_code_id uuid fk,
  ip_hash text,                      -- bcrypt(ip, server-salt)
  user_agent text,
  clicked_at timestamptz
)

email_subscribers(
  id uuid pk,
  ig_account_id uuid fk,
  contact_id uuid fk,
  email text,
  consent_at timestamptz,
  consent_text_version text,         -- references policy version
  source_flow_id uuid fk,
  provider_id text nullable,         -- external service id
  status text,                       -- 'pending' | 'confirmed' | 'unsubscribed' | 'deleted'
  created_at timestamptz
)

consent_log(
  id uuid pk,
  contact_id uuid fk nullable,       -- nulled on erasure, row preserved
  consent_type text,                 -- 'privacy_footer' | 'email_capture' | 'deletion'
  consent_text_version text,
  granted_at timestamptz,
  dm_message_id uuid fk nullable     -- references messages_log
)
-- append-only; no UPDATE permission even to service role

deletion_requests(
  id uuid pk,
  contact_id uuid fk nullable,       -- nulled after processing
  requested_via text,                -- 'dm' | 'admin' | 'email'
  requested_at timestamptz,
  processed_at timestamptz nullable,
  status text                        -- 'pending' | 'completed'
)
```

Indexes: `contacts(ig_account_id, ig_user_id)`, `messages_log(meta_message_id)`, `link_codes(code)`, `flows(ig_account_id, trigger_type, archived)`.

---

## 5. Flow engine

A finite state machine. The `steps` JSON in a flow is an ordered list of nodes; each node has an `id` (string), a `type`, and type-specific fields.

### Step types

| Type             | Fields                                                                                          | Behavior                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `send_message`   | `text`, optional `buttons: Array<{label, action}>` where `action` is `{type:'next', next_id}` or `{type:'url', url}` or `{type:'end'}` | Sends a Meta `text` or `generic`/`button_template` payload depending on buttons       |
| `wait_for_button`| `expected_payloads: string[]`, `on_each: Record<payload, next_id>`                              | Pauses; sets `awaiting_input_type='button'`. On postback event, routes by payload     |
| `wait_for_text`  | `regex` (optional), `on_match_next_id`, `on_miss: 'retry'\|'end'\|'fallback_step_id'`, `max_retries` | Pauses; sets `awaiting_input_type='text'`. On text DM, regex-matches and routes       |
| `collect_email`  | (no extra fields)                                                                                | Special combo: sends consent message with buttons → on agree, waits for email → validates with regex → stores + calls email provider |
| `send_link`      | `label`, `destination_url`                                                                       | Helper that wraps `send_message` with a single URL button; auto-generates link_code   |
| `branch`         | `cases: Array<{when, next_id}>`                                                                  | Evaluates against the inbound event's payload; not used heavily in v1                 |
| `end`            | (none)                                                                                          | Clears `conversation_state.current_flow_id`                                           |

### Webhook handler pipeline

`POST /api/webhooks/meta`:

1. **Verify signature.** Compute `HMAC-SHA256(body, META_APP_SECRET)`, compare to `X-Hub-Signature-256`. On mismatch return 401, no body, log to rate-limited `webhook_audit`.
2. **Dedupe.** Look up `messages_log.meta_message_id` for the event's `mid` or `comment.id`. If found, return 200 immediately.
3. **Resolve account + contact.** From recipient/account id, find `ig_accounts` row. From sender id, upsert `contacts` (update `last_seen_at`, set `language` from flow context later).
4. **Pre-empt reserved keywords.** If the inbound text matches `DELETE`/`SİL`/`STOP`/`UNSUBSCRIBE` (case-insensitive), enter the erasure flow regardless of current state.
5. **Match flow.**
   - `comment` event on monitored post → match against flows where `trigger_type='comment'`, `post_id` matches, and the comment text contains a `trigger_keywords` entry.
   - `message` event with text → if `conversation_state` has an active flow, route there (text input). Otherwise match against `trigger_type='dm'` flows with keyword in the text.
   - `messaging_postbacks` → always routes to active flow; payload is the button's `payload` field.
   - `story_reply` → match against `trigger_type='story_reply'` flows.
6. **Advance state machine.** Load `conversation_state`, find the transition for the current step + event, execute. Side-effects (outbound Meta API calls) executed inline; results recorded to `messages_log`. Save new `conversation_state`.
7. **Respond 200** within Meta's 2-second timeout window. If side-effects exceed time budget, fire-and-await-with-timeout, with overflow logged as `error: 'timeout'` for manual retry.

### 24h window enforcement

`conversation_state.expires_at = last_user_interaction + 24h`. Outbound sends refuse if `now > expires_at` and the message is not flagged with a Meta `MESSAGE_TAG` (v1 doesn't use tags). Such refusals appear in admin failures panel — the operator can decide whether to apply a tag manually.

### Reserved keywords

Hard-coded list pre-empts all flow matching:

- `DELETE`, `SİL`, `STOP`, `UNSUBSCRIBE`, `KALDIR` — enter erasure flow.

Erasure flow is built-in (not editable in admin): single confirm step with `[Yes, delete everything]` / `[Cancel]` buttons. Localized via the contact's `language` (default to IG account's `default_language` if unknown).

---

## 6. Flow authoring (admin UI)

Form-based, no canvas. One page per flow (`/admin/flows/[id]`):

- **Header:** name, language (TR/EN), IG account, archived toggle.
- **Trigger block:** type radio (comment/DM/story_reply), conditional fields:
  - `comment`: post picker (lists `posts` where `monitored=true`), keyword multi-input.
  - `dm`: keyword multi-input.
  - `story_reply`: keyword multi-input.
- **Steps editor:** ordered list of cards, drag to reorder. Each card has type selector and type-specific fields. `send_message` cards have a nested rows-editor for buttons (label + action).
- **Email capture:** toggle. If on, inserts `collect_email` step at the configured position and exposes provider config (`none`/`resend`/`mailchimp` + audience id + API key).
- **Save:** validates `steps` against Zod schema, writes JSON to `flows.steps`.

Posts list (`/admin/posts`) lists media for each linked IG account (fetched on demand from Meta) and lets the operator toggle `monitored`. Only monitored posts have their comments subscribed to (saves webhook noise).

Contacts list (`/admin/contacts`) shows recent interactions, click counts, email status, with a "Delete data" action that triggers admin-initiated erasure.

Stats page (`/admin/stats`) shows per-flow funnel: triggered → DM delivered → button tapped → link clicked → email captured.

---

## 7. Link tracking

When the flow engine executes a step with a URL button:

1. Generate `code = nanoid(10)` (collision-resistant alphanumeric).
2. Insert `link_codes(link_id, contact_id, code)`.
3. Render the Meta button URL as `https://<APP_DOMAIN>/r/<code>`.

`GET /r/[code]`:

1. Look up `link_codes` join `links`. 404 if absent.
2. Insert `clicks(link_code_id, ip_hash=bcrypt(ip, server_salt), user_agent, clicked_at=now())`. Bcrypted IP to avoid storing direct IPs (privacy posture).
3. If `link_codes.first_clicked_at` is null, set it to now.
4. `302` to `links.destination_url`.

Rate limit on `/r/[code]`: 60 req/min per IP via Vercel platform rate limiting or a simple in-memory bucket. Click logging best-effort — if it fails we still redirect.

Admin stats per flow → per link: sends, unique recipients, total clicks, unique clicks (recipients with `first_clicked_at not null`), CTR.

---

## 8. Email collection

The `collect_email` step compiles to a fixed sub-sequence:

1. **Consent message.** Sends a DM with text from `lib/consent/email-consent-text.<lang>.ts` plus two postback buttons: `[I agree, send my bonus]` / `[No thanks, just the link]`. Both are localized.
2. **On "No thanks":** continue flow to next step (or end).
3. **On "I agree":** insert `consent_log(consent_type='email_capture', consent_text_version=<current>)`, set `awaiting_input_type='email'`.
4. **On next inbound text:** validate with regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`. If invalid, reply with localized retry message; up to 3 retries before falling through to next step.
5. **On valid email:**
   - Insert `email_subscribers(status='pending', email, consent_at=now(), source_flow_id, consent_text_version)`.
   - Call `EmailProviderAdapter.subscribe(email, metadata)` for the flow's configured provider.
   - On success: update `status='confirmed'`, `provider_id`. Send localized confirmation DM (`"📩 Bonus sent — check your inbox"`).
   - On failure: keep `status='pending'`, log error to admin failures panel, send DM that does NOT promise email delivery (`"Thanks — we'll be in touch"`). Operator can retry from admin.
6. Continue flow.

### EmailProviderAdapter interface

```ts
// lib/email-providers/adapter.ts
export interface EmailProviderAdapter {
  readonly kind: 'none' | 'resend' | 'mailchimp';
  subscribe(input: {
    email: string;
    igUsername: string;
    flowName: string;
    language: 'tr' | 'en';
    audienceId?: string;
  }): Promise<{ id: string }>;
}
```

Implementations:

- `NoneAdapter` — returns `{id: 'none'}`, used when only DM gift is configured.
- `ResendAdapter` — posts to Resend Audiences API.
- `MailchimpAdapter` — posts to Mailchimp list members endpoint.

Adapters chosen per flow via `flows.email_provider`. API keys stored encrypted in `ig_accounts.email_provider_config`.

---

## 9. Compliance

### Privacy footer (every outbound DM)

Appended after a separator: `\n\n—\n<localized line>`.

- TR: `Gizlilik: <APP_URL>/p/tr`
- EN: `Privacy: <APP_URL>/p/en`

If total message length > 1000 chars (Meta limit), truncate the body to fit the footer.

### Public privacy pages

`/p/[lang]` (`tr`, `en`) — server-rendered static page covering:

- Data controller identity (operator name, contact email).
- Categories of data collected (IG username, IG user id, optional email, click metadata).
- Legal basis (consent for marketing; legitimate interest for the comment-trigger response under GDPR 6(1)(f) — the user initiated by commenting).
- Retention period (24 months default, configurable per IG account).
- User rights (access, rectification, erasure, objection, portability).
- Erasure instructions (DM `DELETE`/`SİL`).
- CCPA "Do Not Sell" notice (we don't sell — explicitly stated).
- KVKK-specific section: data controller (Veri Sorumlusu), KVK Kurumu rights notice.

Each page version-stamped (`<meta name="policy-version" content="2026-05-27.v1">`). The same string written to `consent_log.consent_text_version` and `email_subscribers.consent_text_version` so audit logs survive future policy edits.

### Explicit consent at email step

Already covered in section 8.

### Erasure

Reserved-keyword DM triggers the built-in erasure flow:

1. Confirmation DM with `[Yes, delete everything]` / `[Cancel]` buttons.
2. On confirm:
   - Hard-delete `contacts` row.
   - `email_subscribers` rows: set `status='deleted'`, overwrite `email` column with `bcrypt(email)` (one-way) — preserves uniqueness for the provider but removes the PII.
   - `messages_log`: set `ig_user_id` and `payload->>'text'` to NULL, keep timestamps + flow_id for analytics.
   - `consent_log`: set `contact_id=NULL`, preserve the rest (audit trail of when consent existed).
   - `deletion_requests`: insert with `status='completed'`, `processed_at=now()`.
3. Admin-initiated deletion (from contacts page) has the same effect.

GDPR-mandated 30-day response window is comfortably met by automated deletion.

---

## 10. Error handling and observability

- **Meta API errors** logged to `messages_log.error` as JSON (`{code, type, fbtrace_id, ts}`). Admin "Failures" panel lists last 100, retry button calls the engine to re-execute the side-effect (idempotent because the conversation_state still points to the same step).
- **Signature mismatch** → 401, no body, log to a rate-limited audit table (avoid log spam from random bots).
- **Unknown event types** → 200 with skip-log (so Meta stops retrying).
- **Duplicate events** by `mid` → 200 fast (no work).
- **Per-IG rate limiting**: in-memory token bucket per `ig_account_id`. On 429 from Meta, mark `messages_log.error.code='rate_limited'`, surface in admin.
- **Sentry SDK** on Vercel for uncaught exceptions. Privacy: ignore route params, no PII in breadcrumbs.

---

## 11. Testing

- **Vitest unit tests:**
  - State machine transitions for every step type.
  - HMAC signature verification (good + bad signatures).
  - Email regex (positive + negative cases).
  - Reserved-keyword pre-emption.
  - Consent log invariants (append-only, version stamped).
  - Link code uniqueness + first-click semantics.
- **Integration tests** (Vitest + ephemeral Supabase test DB):
  - Recorded Meta webhook payloads in `tests/fixtures/meta/*.json` → POST to route handler → assert DB rows and outbound `msw`-mocked Meta calls.
- **Playwright smoke E2E:** log in to admin → create flow → simulate webhook via test endpoint → see contact + click in stats.
- **No live Meta API in CI.**

---

## 12. File structure

```
app/
  (admin)/
    layout.tsx                 (auth + allowlist check)
    accounts/
    posts/
    flows/[id]/page.tsx
    contacts/
    stats/
  api/webhooks/meta/route.ts
  r/[code]/route.ts
  p/[lang]/page.tsx
lib/
  meta/
    client.ts                  (Send API, Comments Private Reply API)
    signature.ts               (HMAC verify)
    types.ts                   (event payload Zod schemas)
  flow-engine/
    machine.ts                 (state transitions)
    steps.ts                   (per-step executors)
    routing.ts                 (event → flow matching)
    reserved-keywords.ts
  email-providers/
    adapter.ts                 (interface)
    none.ts
    resend.ts
    mailchimp.ts
  links/
    shorten.ts                 (nanoid + insert)
    clicks.ts                  (record + redirect)
  consent/
    footer.ts                  (localized appender)
    email-consent-text.tr.ts
    email-consent-text.en.ts
    policy-versions.ts
  db/
    client.ts                  (Supabase server client)
    queries.ts                 (typed query helpers)
    encryption.ts              (libsodium wrap/unwrap)
supabase/
  migrations/
    20260527000000_init.sql
tests/
  unit/
  integration/
  e2e/
  fixtures/meta/
docs/
  superpowers/specs/2026-05-27-instagram-dm-automation-design.md
```

---

## 13. Environment variables

```
NEXT_PUBLIC_APP_URL=                 # https://app.example.com — used for short links and policy URLs
META_APP_ID=
META_APP_SECRET=                     # for HMAC signature verification
META_VERIFY_TOKEN=                   # for webhook subscription verification
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=                      # libsodium secretbox key (base64), for IG tokens + provider API keys
IP_HASH_SALT=                        # bcrypt salt for clicks.ip_hash
ADMIN_ALLOWLIST=                     # comma-separated emails permitted to sign in
SENTRY_DSN=                          # optional
```

`vercel.ts` configures cron-less defaults and the `/api/webhooks/meta` function with a 10-second `maxDuration` (Meta gives 20s but we want headroom; default 300s is overkill and increases cold-start tradeoffs).

---

## 14. Open questions deferred to implementation

These don't block planning but should be decided during implementation:

- Exact Meta API minimum version (assume current latest GA).
- Whether to use Vercel BotID on `/r/[code]` to filter crawler clicks from stats.
- Default retention period (assumed 24 months; can be a per-account setting).
- Whether `posts` list polls Meta on schedule (cron) or only on-demand when the admin opens the page — v1 plan: on-demand only.

---

## 15. Success criteria

- Operator can connect a Business IG account, link a post, create a flow with buttons + link + optional email step, and have it work end-to-end with a real comment.
- Privacy footer present on every outbound DM, both TR and EN.
- DM `SİL` from any user triggers confirmable erasure and removes their data within seconds.
- Admin Failures panel shows clear, actionable errors when Meta API rejects a send.
- Click-through stats accurately attribute clicks to individual contacts.
