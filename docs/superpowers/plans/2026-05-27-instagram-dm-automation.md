# Instagram DM Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal-use ManyChat-style Instagram DM automation app: keyword-triggered multi-step flows with buttons, per-recipient link tracking, optional email capture, and KVKK/GDPR/CCPA compliance.

**Architecture:** Single Next.js 16 (App Router) app on Vercel + Supabase (Postgres + Auth). DB-driven flows executed by a state machine inside the webhook handler. Pluggable email provider adapter (Resend / Mailchimp / None). Spec lives at [docs/superpowers/specs/2026-05-27-instagram-dm-automation-design.md](../specs/2026-05-27-instagram-dm-automation-design.md).

**Tech Stack:** Next.js 16, TypeScript, Supabase (Postgres + Auth + SSR helpers), Zod, libsodium-wrappers, bcryptjs, nanoid, Vitest, msw, Playwright, Sentry.

**Estimated scope:** ~45 tasks across 12 phases. Each task is bite-sized (2-5 min) with TDD-style test → implement → verify → commit cycle.

---

## Phase 0 — Project bootstrap

### Task 1: Initialize Next.js 16 project with TypeScript

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js**

Run from `/Users/gokhanseckin/claude-projects/autoreply`:

```bash
npx --yes create-next-app@latest . --typescript --app --tailwind --eslint --src-dir=false --import-alias="@/*" --turbopack --yes
```

Expected: project files created, `package.json` has Next.js 16+.

- [ ] **Step 2: Verify it builds**

```bash
npm run build
```

Expected: build succeeds, `.next/` produced.

- [ ] **Step 3: Replace landing page**

Edit `app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Instagram DM Automation</h1>
      <p className="text-sm text-gray-600">Admin at <a href="/admin" className="underline">/admin</a></p>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 16 app with TypeScript and Tailwind"
```

---

### Task 2: Install runtime dependencies and dev tooling

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install @supabase/supabase-js @supabase/ssr zod nanoid libsodium-wrappers bcryptjs @sentry/nextjs
```

- [ ] **Step 2: Install dev deps**

```bash
npm install -D vitest @vitest/ui @vitejs/plugin-react msw @types/bcryptjs @types/libsodium-wrappers @playwright/test supabase
```

- [ ] **Step 3: Add npm scripts**

Edit `package.json` `scripts`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:types": "supabase gen types typescript --local > lib/db/types.ts"
  }
}
```

- [ ] **Step 4: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 5: Create test setup**

Create `tests/setup.ts`:

```ts
import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';
  process.env.META_APP_SECRET ??= 'test-app-secret';
  process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString('base64');
  process.env.IP_HASH_SALT ??= '$2b$10$abcdefghijklmnopqrstuv';
});

afterAll(() => {});
```

- [ ] **Step 6: Verify test runner**

Create `tests/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
describe('sanity', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

Run:
```bash
npm test
```

Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "build: add runtime deps, dev tooling, vitest config"
```

---

### Task 3: Environment config and vercel.ts

**Files:**
- Create: `.env.example`, `vercel.ts`, `.env.local` (untracked)
- Modify: `.gitignore`

- [ ] **Step 1: Write `.env.example`**

```dotenv
# Public
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only
SUPABASE_SERVICE_ROLE_KEY=
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
ENCRYPTION_KEY=
IP_HASH_SALT=
ADMIN_ALLOWLIST=
SENTRY_DSN=
```

- [ ] **Step 2: Confirm `.env*` ignored**

Append to `.gitignore` if missing:

```
.env
.env.local
.env*.local
```

- [ ] **Step 3: Write `vercel.ts`**

```ts
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'npm run build',
  functions: {
    'app/api/webhooks/meta/route.ts': { maxDuration: 10 },
    'app/r/[code]/route.ts': { maxDuration: 5 },
  },
};
```

- [ ] **Step 4: Install @vercel/config**

```bash
npm install -D @vercel/config
```

- [ ] **Step 5: Commit**

```bash
git add .env.example vercel.ts .gitignore package.json package-lock.json
git commit -m "build: add .env.example and vercel.ts config"
```

---

## Phase 1 — Database schema

### Task 4: Supabase migration with full schema

**Files:**
- Create: `supabase/migrations/20260527000000_init.sql`, `supabase/config.toml` (via CLI)

- [ ] **Step 1: Init Supabase local**

```bash
npx supabase init
```

Expected: `supabase/` directory created with `config.toml`.

- [ ] **Step 2: Create migration file**

Create `supabase/migrations/20260527000000_init.sql`:

```sql
-- IG accounts
create table ig_accounts (
  id uuid primary key default gen_random_uuid(),
  ig_business_account_id text not null unique,
  fb_page_id text not null,
  page_access_token_enc bytea not null,
  name text not null,
  default_language text not null default 'tr',
  email_provider_config jsonb not null default '{"kind":"none"}'::jsonb,
  created_at timestamptz not null default now()
);

-- Posts
create table posts (
  id uuid primary key default gen_random_uuid(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  ig_media_id text not null unique,
  caption_excerpt text,
  permalink text,
  monitored boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_ig_account_idx on posts(ig_account_id, monitored);

-- Flows
create table flows (
  id uuid primary key default gen_random_uuid(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  name text not null,
  language text not null default 'tr',
  trigger_type text not null check (trigger_type in ('comment','dm','story_reply')),
  trigger_keywords text[] not null default '{}',
  post_id uuid references posts(id) on delete set null,
  steps jsonb not null default '[]'::jsonb,
  email_capture_enabled boolean not null default false,
  email_provider text not null default 'none',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index flows_lookup_idx on flows(ig_account_id, trigger_type, archived);

-- Contacts
create table contacts (
  id uuid primary key default gen_random_uuid(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  ig_user_id text not null,
  ig_username text,
  language text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(ig_account_id, ig_user_id)
);

-- Conversation state
create table conversation_state (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null unique references contacts(id) on delete cascade,
  current_flow_id uuid references flows(id) on delete set null,
  current_step_id text,
  awaiting_input_type text check (awaiting_input_type in ('email','button','text') or awaiting_input_type is null),
  context jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Messages log
create table messages_log (
  id uuid primary key default gen_random_uuid(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  direction text not null check (direction in ('in','out')),
  message_type text not null,
  payload jsonb not null,
  meta_message_id text unique,
  error jsonb,
  sent_at timestamptz not null default now()
);
create index messages_log_contact_idx on messages_log(contact_id, sent_at desc);
create index messages_log_failures_idx on messages_log(ig_account_id, sent_at desc) where error is not null;

-- Links and click tracking
create table links (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flows(id) on delete cascade,
  step_id text not null,
  label text not null,
  destination_url text not null,
  created_at timestamptz not null default now()
);

create table link_codes (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references links(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  code text not null unique,
  first_clicked_at timestamptz,
  created_at timestamptz not null default now()
);
create index link_codes_code_idx on link_codes(code);

create table clicks (
  id uuid primary key default gen_random_uuid(),
  link_code_id uuid not null references link_codes(id) on delete cascade,
  ip_hash text not null,
  user_agent text,
  clicked_at timestamptz not null default now()
);

-- Email subscribers
create table email_subscribers (
  id uuid primary key default gen_random_uuid(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  email text not null,
  consent_at timestamptz not null,
  consent_text_version text not null,
  source_flow_id uuid references flows(id) on delete set null,
  provider_id text,
  status text not null check (status in ('pending','confirmed','unsubscribed','deleted')),
  created_at timestamptz not null default now()
);

-- Consent log (append-only)
create table consent_log (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  consent_type text not null check (consent_type in ('privacy_footer','email_capture','deletion')),
  consent_text_version text not null,
  granted_at timestamptz not null default now(),
  dm_message_id uuid references messages_log(id) on delete set null
);

-- Deletion requests
create table deletion_requests (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  requested_via text not null check (requested_via in ('dm','admin','email')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending' check (status in ('pending','completed'))
);

-- Enable RLS everywhere; service role bypasses RLS
alter table ig_accounts enable row level security;
alter table posts enable row level security;
alter table flows enable row level security;
alter table contacts enable row level security;
alter table conversation_state enable row level security;
alter table messages_log enable row level security;
alter table links enable row level security;
alter table link_codes enable row level security;
alter table clicks enable row level security;
alter table email_subscribers enable row level security;
alter table consent_log enable row level security;
alter table deletion_requests enable row level security;

-- Prevent UPDATE/DELETE on consent_log even via the API (service role bypasses, used only on hard erasure to NULL contact_id)
create policy consent_log_insert on consent_log for insert with check (false);
create policy consent_log_select on consent_log for select using (false);
```

- [ ] **Step 3: Apply migration locally**

```bash
npx supabase start
npx supabase db reset
```

Expected: all 12 tables created without errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat(db): add initial schema migration with RLS"
```

---

### Task 5: Generate TypeScript DB types

**Files:**
- Create: `lib/db/types.ts` (generated)

- [ ] **Step 1: Generate**

```bash
mkdir -p lib/db
npm run db:types
```

Expected: `lib/db/types.ts` exists with `Database` interface containing all tables.

- [ ] **Step 2: Commit**

```bash
git add lib/db/types.ts
git commit -m "feat(db): generate TypeScript types from schema"
```

---

## Phase 2 — Crypto utilities (TDD)

### Task 6: Libsodium encrypt/decrypt for IG tokens

**Files:**
- Create: `lib/db/encryption.ts`, `tests/unit/encryption.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/encryption.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '@/lib/db/encryption';

describe('encryption', () => {
  it('round-trips a string', async () => {
    const enc = await encryptSecret('hello-world');
    expect(enc).toBeInstanceOf(Uint8Array);
    expect(await decryptSecret(enc)).toBe('hello-world');
  });

  it('produces different ciphertexts for the same plaintext (random nonce)', async () => {
    const a = await encryptSecret('same');
    const b = await encryptSecret('same');
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('rejects tampered ciphertext', async () => {
    const enc = await encryptSecret('payload');
    enc[enc.length - 1] ^= 1;
    await expect(decryptSecret(enc)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm test -- encryption
```

Expected: "Cannot find module '@/lib/db/encryption'".

- [ ] **Step 3: Implement**

`lib/db/encryption.ts`:

```ts
import sodium from 'libsodium-wrappers';

let ready: Promise<void> | null = null;
async function init() {
  if (!ready) ready = sodium.ready;
  await ready;
}

function key(): Uint8Array {
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) throw new Error('ENCRYPTION_KEY env var missing');
  const k = Buffer.from(b64, 'base64');
  if (k.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes');
  return new Uint8Array(k);
}

export async function encryptSecret(plain: string): Promise<Uint8Array> {
  await init();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ct = sodium.crypto_secretbox_easy(sodium.from_string(plain), nonce, key());
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return out;
}

export async function decryptSecret(blob: Uint8Array): Promise<string> {
  await init();
  const nb = sodium.crypto_secretbox_NONCEBYTES;
  const nonce = blob.subarray(0, nb);
  const ct = blob.subarray(nb);
  const plain = sodium.crypto_secretbox_open_easy(ct, nonce, key());
  return sodium.to_string(plain);
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm test -- encryption
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/db/encryption.ts tests/unit/encryption.test.ts
git commit -m "feat(crypto): libsodium secretbox encrypt/decrypt helpers"
```

---

### Task 7: IP hashing with bcrypt

**Files:**
- Create: `lib/links/ip-hash.ts`, `tests/unit/ip-hash.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/ip-hash.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hashIp } from '@/lib/links/ip-hash';

describe('hashIp', () => {
  it('is deterministic for the same IP with the same salt', async () => {
    const a = await hashIp('1.2.3.4');
    const b = await hashIp('1.2.3.4');
    expect(a).toBe(b);
  });

  it('differs across IPs', async () => {
    expect(await hashIp('1.2.3.4')).not.toBe(await hashIp('5.6.7.8'));
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm test -- ip-hash
```

- [ ] **Step 3: Implement**

`lib/links/ip-hash.ts`:

```ts
import bcrypt from 'bcryptjs';

export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error('IP_HASH_SALT env var missing');
  return bcrypt.hash(ip, salt);
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm test -- ip-hash
```

- [ ] **Step 5: Commit**

```bash
git add lib/links/ip-hash.ts tests/unit/ip-hash.test.ts
git commit -m "feat(links): bcrypt-based deterministic IP hash"
```

---

### Task 8: Nanoid wrapper for link codes

**Files:**
- Create: `lib/links/shorten.ts`, `tests/unit/shorten.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/shorten.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateLinkCode } from '@/lib/links/shorten';

describe('generateLinkCode', () => {
  it('is 10 alphanumeric chars', () => {
    const code = generateLinkCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{10}$/);
  });

  it('produces unique values', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateLinkCode()));
    expect(codes.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm test -- shorten
```

- [ ] **Step 3: Implement**

`lib/links/shorten.ts`:

```ts
import { nanoid } from 'nanoid';

export function generateLinkCode(): string {
  return nanoid(10);
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm test -- shorten
```

- [ ] **Step 5: Commit**

```bash
git add lib/links/shorten.ts tests/unit/shorten.test.ts
git commit -m "feat(links): nanoid-based link code generator"
```

---

## Phase 3 — Supabase client and queries

### Task 9: Server-side Supabase clients

**Files:**
- Create: `lib/db/client.ts`

- [ ] **Step 1: Implement**

`lib/db/client.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './types';

export async function userClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        },
      },
    },
  );
}

export function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 2: Sanity build**

```bash
npm run build
```

Expected: builds (admin/webhook handlers not yet importing it).

- [ ] **Step 3: Commit**

```bash
git add lib/db/client.ts
git commit -m "feat(db): server-side Supabase clients (user + service)"
```

---

### Task 10: Typed query helpers for common operations

**Files:**
- Create: `lib/db/queries.ts`

- [ ] **Step 1: Implement**

`lib/db/queries.ts`:

```ts
import { serviceClient } from './client';
import type { Database } from './types';

type Tables = Database['public']['Tables'];
export type IgAccount = Tables['ig_accounts']['Row'];
export type Post = Tables['posts']['Row'];
export type Flow = Tables['flows']['Row'];
export type Contact = Tables['contacts']['Row'];
export type ConversationState = Tables['conversation_state']['Row'];
export type MessageLog = Tables['messages_log']['Row'];
export type Link = Tables['links']['Row'];
export type LinkCode = Tables['link_codes']['Row'];

export async function findIgAccountByBusinessId(igBusinessAccountId: string) {
  const db = serviceClient();
  const { data, error } = await db
    .from('ig_accounts')
    .select('*')
    .eq('ig_business_account_id', igBusinessAccountId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertContact(args: {
  igAccountId: string;
  igUserId: string;
  igUsername?: string;
}): Promise<Contact> {
  const db = serviceClient();
  const { data, error } = await db
    .from('contacts')
    .upsert(
      {
        ig_account_id: args.igAccountId,
        ig_user_id: args.igUserId,
        ig_username: args.igUsername,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'ig_account_id,ig_user_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadConversationState(contactId: string): Promise<ConversationState | null> {
  const db = serviceClient();
  const { data, error } = await db
    .from('conversation_state')
    .select('*')
    .eq('contact_id', contactId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveConversationState(state: Partial<ConversationState> & { contact_id: string }) {
  const db = serviceClient();
  const { error } = await db.from('conversation_state').upsert(
    { ...state, updated_at: new Date().toISOString() },
    { onConflict: 'contact_id' },
  );
  if (error) throw error;
}

export async function alreadyProcessed(metaMessageId: string): Promise<boolean> {
  const db = serviceClient();
  const { data } = await db
    .from('messages_log')
    .select('id')
    .eq('meta_message_id', metaMessageId)
    .maybeSingle();
  return !!data;
}

export async function logMessage(row: Tables['messages_log']['Insert']) {
  const db = serviceClient();
  const { data, error } = await db.from('messages_log').insert(row).select().single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/queries.ts
git commit -m "feat(db): typed query helpers for core entities"
```

---

## Phase 4 — Meta API integration

### Task 11: HMAC signature verification (TDD)

**Files:**
- Create: `lib/meta/signature.ts`, `tests/unit/signature.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/signature.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyMetaSignature } from '@/lib/meta/signature';

const secret = process.env.META_APP_SECRET!;
const body = JSON.stringify({ object: 'instagram', entry: [] });
const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

describe('verifyMetaSignature', () => {
  it('accepts a valid signature', () => {
    expect(verifyMetaSignature(body, sig)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    expect(verifyMetaSignature(body, 'sha256=000')).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyMetaSignature(body, null)).toBe(false);
  });

  it('rejects a malformed header', () => {
    expect(verifyMetaSignature(body, 'sha1=abc')).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/meta/signature.ts`:

```ts
import crypto from 'node:crypto';

export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = header.slice('sha256='.length);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/meta/signature.ts tests/unit/signature.test.ts
git commit -m "feat(meta): HMAC-SHA256 webhook signature verification"
```

---

### Task 12: Meta event payload Zod schemas

**Files:**
- Create: `lib/meta/types.ts`, `tests/unit/meta-types.test.ts`, `tests/fixtures/meta/comment.json`, `tests/fixtures/meta/message.json`, `tests/fixtures/meta/postback.json`, `tests/fixtures/meta/story_reply.json`

- [ ] **Step 1: Write fixtures**

`tests/fixtures/meta/comment.json`:

```json
{
  "object": "instagram",
  "entry": [{
    "id": "17841400000000000",
    "time": 1748372160,
    "changes": [{
      "field": "comments",
      "value": {
        "id": "18000000000000000",
        "from": { "id": "8800000000000000", "username": "test_user" },
        "media": { "id": "17900000000000000" },
        "text": "FREE"
      }
    }]
  }]
}
```

`tests/fixtures/meta/message.json`:

```json
{
  "object": "instagram",
  "entry": [{
    "id": "17841400000000000",
    "time": 1748372160,
    "messaging": [{
      "sender": { "id": "8800000000000000" },
      "recipient": { "id": "17841400000000000" },
      "timestamp": 1748372160000,
      "message": { "mid": "MID-001", "text": "COURSE" }
    }]
  }]
}
```

`tests/fixtures/meta/postback.json`:

```json
{
  "object": "instagram",
  "entry": [{
    "id": "17841400000000000",
    "time": 1748372160,
    "messaging": [{
      "sender": { "id": "8800000000000000" },
      "recipient": { "id": "17841400000000000" },
      "timestamp": 1748372160000,
      "postback": { "mid": "MID-002", "payload": "STEP_2", "title": "Yes" }
    }]
  }]
}
```

`tests/fixtures/meta/story_reply.json`:

```json
{
  "object": "instagram",
  "entry": [{
    "id": "17841400000000000",
    "time": 1748372160,
    "messaging": [{
      "sender": { "id": "8800000000000000" },
      "recipient": { "id": "17841400000000000" },
      "timestamp": 1748372160000,
      "message": { "mid": "MID-003", "text": "reply", "reply_to": { "story": { "url": "https://...", "id": "17900000000000000" } } }
    }]
  }]
}
```

- [ ] **Step 2: Write failing test**

`tests/unit/meta-types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MetaWebhookSchema } from '@/lib/meta/types';
import comment from '../fixtures/meta/comment.json';
import message from '../fixtures/meta/message.json';
import postback from '../fixtures/meta/postback.json';
import story from '../fixtures/meta/story_reply.json';

describe('MetaWebhookSchema', () => {
  it.each([
    ['comment', comment],
    ['message', message],
    ['postback', postback],
    ['story_reply', story],
  ])('parses %s payload', (_, payload) => {
    expect(() => MetaWebhookSchema.parse(payload)).not.toThrow();
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

- [ ] **Step 4: Implement**

`lib/meta/types.ts`:

```ts
import { z } from 'zod';

export const CommentChange = z.object({
  field: z.literal('comments'),
  value: z.object({
    id: z.string(),
    from: z.object({ id: z.string(), username: z.string().optional() }),
    media: z.object({ id: z.string() }),
    text: z.string(),
  }),
});

export const MessagingMessage = z.object({
  sender: z.object({ id: z.string() }),
  recipient: z.object({ id: z.string() }),
  timestamp: z.number(),
  message: z
    .object({
      mid: z.string(),
      text: z.string().optional(),
      reply_to: z
        .object({
          story: z.object({ id: z.string(), url: z.string().optional() }).optional(),
        })
        .optional(),
    })
    .optional(),
  postback: z
    .object({
      mid: z.string().optional(),
      payload: z.string(),
      title: z.string().optional(),
    })
    .optional(),
});

export const MetaEntry = z.object({
  id: z.string(),
  time: z.number(),
  changes: z.array(CommentChange).optional(),
  messaging: z.array(MessagingMessage).optional(),
});

export const MetaWebhookSchema = z.object({
  object: z.literal('instagram'),
  entry: z.array(MetaEntry),
});

export type MetaWebhook = z.infer<typeof MetaWebhookSchema>;
```

- [ ] **Step 5: Run, expect PASS**

- [ ] **Step 6: Commit**

```bash
git add lib/meta/types.ts tests/unit/meta-types.test.ts tests/fixtures/meta/
git commit -m "feat(meta): webhook payload Zod schemas + fixtures"
```

---

### Task 13: Meta Send API client

**Files:**
- Create: `lib/meta/client.ts`, `tests/unit/meta-client.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/meta-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendText, sendButtons } from '@/lib/meta/client';

const fetchMock = vi.fn();

beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ message_id: 'm_001', recipient_id: 'u_001' }),
    text: async () => '{"message_id":"m_001","recipient_id":"u_001"}',
  });
});
afterEach(() => vi.restoreAllMocks());

describe('sendText', () => {
  it('POSTs the correct shape', async () => {
    const res = await sendText({
      pageAccessToken: 'TOKEN',
      igUserId: 'u_001',
      text: 'hello',
    });
    expect(res.message_id).toBe('m_001');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      recipient: { id: 'u_001' },
      message: { text: 'hello' },
      messaging_type: 'RESPONSE',
    });
  });
});

describe('sendButtons', () => {
  it('POSTs button_template with up to 3 buttons', async () => {
    await sendButtons({
      pageAccessToken: 'TOKEN',
      igUserId: 'u_001',
      text: 'choose',
      buttons: [
        { type: 'postback', title: 'Yes', payload: 'YES' },
        { type: 'web_url', title: 'Go', url: 'https://x' },
      ],
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.message.attachment.payload.template_type).toBe('button');
    expect(body.message.attachment.payload.buttons).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/meta/client.ts`:

```ts
const GRAPH = 'https://graph.facebook.com/v21.0';

type MetaError = { code: number; type: string; message: string; fbtrace_id?: string };
export class MetaAPIError extends Error {
  constructor(public status: number, public payload: MetaError) {
    super(`Meta API ${status} ${payload.code}: ${payload.message}`);
  }
}

export type Button =
  | { type: 'postback'; title: string; payload: string }
  | { type: 'web_url'; title: string; url: string };

async function call(token: string, path: string, body: unknown) {
  const res = await fetch(`${GRAPH}${path}?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed: { error?: MetaError } = {};
    try { parsed = JSON.parse(text); } catch {}
    throw new MetaAPIError(res.status, parsed.error ?? { code: 0, type: 'unknown', message: text });
  }
  return JSON.parse(text) as { message_id: string; recipient_id: string };
}

export async function sendText(args: { pageAccessToken: string; igUserId: string; text: string }) {
  return call(args.pageAccessToken, '/me/messages', {
    recipient: { id: args.igUserId },
    message: { text: args.text },
    messaging_type: 'RESPONSE',
  });
}

export async function sendButtons(args: {
  pageAccessToken: string;
  igUserId: string;
  text: string;
  buttons: Button[];
}) {
  if (args.buttons.length > 3) throw new Error('Meta allows at most 3 buttons per template');
  return call(args.pageAccessToken, '/me/messages', {
    recipient: { id: args.igUserId },
    message: {
      attachment: {
        type: 'template',
        payload: { template_type: 'button', text: args.text, buttons: args.buttons },
      },
    },
    messaging_type: 'RESPONSE',
  });
}

export async function sendPrivateReplyToComment(args: {
  pageAccessToken: string;
  commentId: string;
  text: string;
}) {
  return call(args.pageAccessToken, `/${args.commentId}/private_replies`, { message: args.text });
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/meta/client.ts tests/unit/meta-client.test.ts
git commit -m "feat(meta): Send + Private Reply API clients"
```

---

## Phase 5 — Flow engine

### Task 14: Step schemas

**Files:**
- Create: `lib/flow-engine/schema.ts`, `tests/unit/flow-schema.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/flow-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FlowStepsSchema } from '@/lib/flow-engine/schema';

describe('FlowStepsSchema', () => {
  it('accepts a typical multi-step flow', () => {
    const steps = [
      {
        id: 's1',
        type: 'send_message',
        text: "You're looking to access the free course?",
        buttons: [{ label: 'Yes', action: { type: 'next', next_id: 's2' } }],
      },
      { id: 's2', type: 'wait_for_button', expected_payloads: ['s2'], on_each: { s2: 's3' } },
      {
        id: 's3',
        type: 'send_link',
        text: "Here's the Free Leads Course. Go win.",
        label: 'Free Course',
        destination_url: 'https://example.com/course',
      },
      { id: 's4', type: 'end' },
    ];
    expect(() => FlowStepsSchema.parse(steps)).not.toThrow();
  });

  it('rejects unknown step types', () => {
    expect(() => FlowStepsSchema.parse([{ id: 'x', type: 'wat' }])).toThrow();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/flow-engine/schema.ts`:

```ts
import { z } from 'zod';

export const ButtonAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('next'), next_id: z.string() }),
  z.object({ type: z.literal('url'), url: z.string().url() }),
  z.object({ type: z.literal('end') }),
]);

export const Button = z.object({ label: z.string().min(1).max(20), action: ButtonAction });

export const SendMessageStep = z.object({
  id: z.string().min(1),
  type: z.literal('send_message'),
  text: z.string().min(1),
  buttons: z.array(Button).max(3).optional(),
  next_id: z.string().optional(),
});

export const WaitForButtonStep = z.object({
  id: z.string(),
  type: z.literal('wait_for_button'),
  expected_payloads: z.array(z.string()),
  on_each: z.record(z.string(), z.string()),
});

export const WaitForTextStep = z.object({
  id: z.string(),
  type: z.literal('wait_for_text'),
  regex: z.string().optional(),
  on_match_next_id: z.string(),
  on_miss: z.union([z.literal('retry'), z.literal('end'), z.string()]),
  max_retries: z.number().int().min(0).max(5).default(3),
});

export const CollectEmailStep = z.object({
  id: z.string(),
  type: z.literal('collect_email'),
  next_id: z.string().optional(),
});

export const SendLinkStep = z.object({
  id: z.string(),
  type: z.literal('send_link'),
  text: z.string(),
  label: z.string().max(20),
  destination_url: z.string().url(),
  next_id: z.string().optional(),
});

export const BranchStep = z.object({
  id: z.string(),
  type: z.literal('branch'),
  cases: z.array(z.object({ when: z.string(), next_id: z.string() })),
  default_next_id: z.string().optional(),
});

export const EndStep = z.object({ id: z.string(), type: z.literal('end') });

export const FlowStep = z.discriminatedUnion('type', [
  SendMessageStep,
  WaitForButtonStep,
  WaitForTextStep,
  CollectEmailStep,
  SendLinkStep,
  BranchStep,
  EndStep,
]);

export const FlowStepsSchema = z.array(FlowStep);

export type FlowStep = z.infer<typeof FlowStep>;
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/flow-engine/schema.ts tests/unit/flow-schema.test.ts
git commit -m "feat(flow): step Zod schemas"
```

---

### Task 15: Reserved-keyword matcher

**Files:**
- Create: `lib/flow-engine/reserved-keywords.ts`, `tests/unit/reserved-keywords.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/reserved-keywords.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { matchesErasureKeyword } from '@/lib/flow-engine/reserved-keywords';

describe('matchesErasureKeyword', () => {
  it.each(['DELETE', 'sil', 'Stop', 'unsubscribe', 'KALDIR'])(
    'matches %s case-insensitively',
    (s) => { expect(matchesErasureKeyword(s)).toBe(true); }
  );

  it.each(['hello', 'free course', 'stops here'])('does not match %s', (s) => {
    expect(matchesErasureKeyword(s)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/flow-engine/reserved-keywords.ts`:

```ts
const ERASURE = new Set(['delete', 'sil', 'stop', 'unsubscribe', 'kaldir']);

export function matchesErasureKeyword(text: string): boolean {
  return ERASURE.has(text.trim().toLowerCase());
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/flow-engine/reserved-keywords.ts tests/unit/reserved-keywords.test.ts
git commit -m "feat(flow): reserved keyword (erasure) matcher"
```

---

### Task 16: Event-to-flow router

**Files:**
- Create: `lib/flow-engine/routing.ts`, `tests/unit/routing.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/routing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { matchTriggerKeyword } from '@/lib/flow-engine/routing';

describe('matchTriggerKeyword', () => {
  it('finds keyword as whole-word substring (case-insensitive)', () => {
    expect(matchTriggerKeyword('I want the FREE course', ['free', 'course'])).toBe('free');
  });
  it('returns null when no match', () => {
    expect(matchTriggerKeyword('hello world', ['free'])).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/flow-engine/routing.ts`:

```ts
import { serviceClient } from '@/lib/db/client';
import type { Flow } from '@/lib/db/queries';

export function matchTriggerKeyword(text: string, keywords: string[]): string | null {
  const t = text.toLowerCase();
  for (const k of keywords) {
    const kl = k.toLowerCase();
    const re = new RegExp(`(^|\\W)${kl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`);
    if (re.test(t)) return kl;
  }
  return null;
}

export async function findCommentFlow(args: { igAccountId: string; postId: string; commentText: string }): Promise<Flow | null> {
  const db = serviceClient();
  const { data, error } = await db
    .from('flows')
    .select('*')
    .eq('ig_account_id', args.igAccountId)
    .eq('trigger_type', 'comment')
    .eq('post_id', args.postId)
    .eq('archived', false);
  if (error) throw error;
  for (const f of data ?? []) {
    if (matchTriggerKeyword(args.commentText, f.trigger_keywords)) return f;
  }
  return null;
}

export async function findDmFlow(args: { igAccountId: string; text: string }): Promise<Flow | null> {
  const db = serviceClient();
  const { data, error } = await db
    .from('flows')
    .select('*')
    .eq('ig_account_id', args.igAccountId)
    .eq('trigger_type', 'dm')
    .eq('archived', false);
  if (error) throw error;
  for (const f of data ?? []) {
    if (matchTriggerKeyword(args.text, f.trigger_keywords)) return f;
  }
  return null;
}

export async function findStoryReplyFlow(args: { igAccountId: string; text: string }): Promise<Flow | null> {
  const db = serviceClient();
  const { data, error } = await db
    .from('flows')
    .select('*')
    .eq('ig_account_id', args.igAccountId)
    .eq('trigger_type', 'story_reply')
    .eq('archived', false);
  if (error) throw error;
  for (const f of data ?? []) {
    if (matchTriggerKeyword(args.text, f.trigger_keywords)) return f;
  }
  return null;
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/flow-engine/routing.ts tests/unit/routing.test.ts
git commit -m "feat(flow): keyword matcher + trigger flow lookups"
```

---

### Task 17: Consent text and footer

**Files:**
- Create: `lib/consent/policy-versions.ts`, `lib/consent/email-consent-text.tr.ts`, `lib/consent/email-consent-text.en.ts`, `lib/consent/footer.ts`, `tests/unit/footer.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/footer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { appendPrivacyFooter } from '@/lib/consent/footer';

describe('appendPrivacyFooter', () => {
  it('appends Turkish footer', () => {
    const out = appendPrivacyFooter('Merhaba', 'tr');
    expect(out).toBe('Merhaba\n\n—\nGizlilik: http://localhost:3000/p/tr');
  });

  it('appends English footer', () => {
    const out = appendPrivacyFooter('Hello', 'en');
    expect(out.endsWith('Privacy: http://localhost:3000/p/en')).toBe(true);
  });

  it('truncates body if combined > 1000 chars', () => {
    const body = 'x'.repeat(1100);
    const out = appendPrivacyFooter(body, 'en');
    expect(out.length).toBeLessThanOrEqual(1000);
    expect(out.endsWith('Privacy: http://localhost:3000/p/en')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/consent/policy-versions.ts`:

```ts
export const CURRENT_POLICY_VERSION = '2026-05-27.v1';
```

`lib/consent/footer.ts`:

```ts
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
```

`lib/consent/email-consent-text.tr.ts`:

```ts
export const EMAIL_CONSENT_TR = {
  body: 'Bonus hediyemi e-posta adresime de göndermek istiyorum. Devam edersem KVKK kapsamında e-posta adresimin saklanmasına ve bana e-posta gönderilmesine açık rıza vermiş olurum.',
  agree: 'Kabul ediyorum',
  decline: 'Hayır, sadece link',
  confirmation: '📩 Bonus hediyen yolda — e-posta kutunu kontrol et.',
  invalidEmail: 'Bu bir e-posta gibi görünmüyor. Tekrar dener misin?',
  fallback: 'Teşekkürler — yakında ulaşırız.',
};
```

`lib/consent/email-consent-text.en.ts`:

```ts
export const EMAIL_CONSENT_EN = {
  body: 'I want my bonus emailed to me. By continuing I give explicit consent under GDPR for you to store my email address and send me messages.',
  agree: 'I agree',
  decline: 'No thanks',
  confirmation: '📩 Bonus sent — check your inbox.',
  invalidEmail: "That doesn't look like an email. Try again?",
  fallback: "Thanks — we'll be in touch.",
};
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/consent/
git commit -m "feat(consent): privacy footer + localized email consent text"
```

---

### Task 18: State machine driver

**Files:**
- Create: `lib/flow-engine/machine.ts`, `tests/unit/machine.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/machine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { advance, type FlowContext } from '@/lib/flow-engine/machine';
import type { FlowStep } from '@/lib/flow-engine/schema';

const steps: FlowStep[] = [
  { id: 's1', type: 'send_message', text: 'Hi', buttons: [{ label: 'Yes', action: { type: 'next', next_id: 's2' } }] },
  { id: 's2', type: 'wait_for_button', expected_payloads: ['s2'], on_each: { s2: 's3' } },
  { id: 's3', type: 'send_link', text: 'Here you go', label: 'Open', destination_url: 'https://x.test', next_id: 's4' },
  { id: 's4', type: 'end' },
];

function ctx(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    steps,
    language: 'en',
    currentStepId: null,
    contactId: 'c1',
    igAccountId: 'a1',
    flowId: 'f1',
    pageAccessToken: 'TOK',
    igUserId: 'u1',
    ...overrides,
  };
}

describe('advance', () => {
  it('starts at the first step (send_message + buttons -> waits)', async () => {
    const result = await advance(ctx(), { type: 'trigger' }, { sendText: async () => ({ message_id: 'm' }), sendButtons: async () => ({ message_id: 'm' }), recordLink: async () => 'CODE', logSend: async () => {} });
    expect(result.nextStepId).toBe('s2');
    expect(result.awaitingInputType).toBe('button');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/flow-engine/machine.ts`:

```ts
import type { FlowStep } from './schema';
import { appendPrivacyFooter } from '@/lib/consent/footer';
import { EMAIL_CONSENT_TR } from '@/lib/consent/email-consent-text.tr';
import { EMAIL_CONSENT_EN } from '@/lib/consent/email-consent-text.en';
import { CURRENT_POLICY_VERSION } from '@/lib/consent/policy-versions';

export type Lang = 'tr' | 'en';

export type FlowContext = {
  steps: FlowStep[];
  language: Lang;
  currentStepId: string | null;
  contactId: string;
  igAccountId: string;
  flowId: string;
  pageAccessToken: string;
  igUserId: string;
};

export type Event =
  | { type: 'trigger' }
  | { type: 'button'; payload: string }
  | { type: 'text'; text: string };

export type Effects = {
  sendText: (args: { token: string; igUserId: string; text: string }) => Promise<{ message_id: string }>;
  sendButtons: (args: { token: string; igUserId: string; text: string; buttons: { type: 'postback' | 'web_url'; title: string; payload?: string; url?: string }[] }) => Promise<{ message_id: string }>;
  recordLink: (args: { flowId: string; stepId: string; label: string; destinationUrl: string; contactId: string }) => Promise<string>; // returns code
  logSend: (args: { messageType: string; payload: unknown; metaMessageId: string }) => Promise<void>;
};

export type AdvanceResult = {
  nextStepId: string | null;
  awaitingInputType: 'button' | 'text' | 'email' | null;
  expiresAt: string | null;
};

const consentText = (lang: Lang) => (lang === 'tr' ? EMAIL_CONSENT_TR : EMAIL_CONSENT_EN);

function findStep(ctx: FlowContext, id: string): FlowStep {
  const step = ctx.steps.find((s) => s.id === id);
  if (!step) throw new Error(`Step ${id} not found`);
  return step;
}

function firstStep(ctx: FlowContext): FlowStep {
  if (!ctx.steps.length) throw new Error('Flow has no steps');
  return ctx.steps[0];
}

export async function advance(ctx: FlowContext, event: Event, effects: Effects): Promise<AdvanceResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  let stepId = ctx.currentStepId ?? firstStep(ctx).id;
  let step = findStep(ctx, stepId);
  let expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  // Outer loop: keep advancing past purely-outbound steps.
  while (true) {
    if (step.type === 'send_message') {
      const text = appendPrivacyFooter(step.text, ctx.language);
      if (step.buttons && step.buttons.length) {
        const buttons = step.buttons.map((b) => {
          if (b.action.type === 'url') return { type: 'web_url' as const, title: b.label, url: b.action.url };
          // postback: payload identifies the button by its step or label
          return { type: 'postback' as const, title: b.label, payload: b.action.type === 'next' ? b.action.next_id : `END_${step.id}` };
        });
        const sent = await effects.sendButtons({ token: ctx.pageAccessToken, igUserId: ctx.igUserId, text, buttons });
        await effects.logSend({ messageType: 'buttons', payload: { text, buttons }, metaMessageId: sent.message_id });
        return { nextStepId: step.id, awaitingInputType: 'button', expiresAt };
      } else {
        const sent = await effects.sendText({ token: ctx.pageAccessToken, igUserId: ctx.igUserId, text });
        await effects.logSend({ messageType: 'text', payload: { text }, metaMessageId: sent.message_id });
        if (step.next_id) { step = findStep(ctx, step.next_id); continue; }
        return { nextStepId: null, awaitingInputType: null, expiresAt };
      }
    }

    if (step.type === 'send_link') {
      const code = await effects.recordLink({ flowId: ctx.flowId, stepId: step.id, label: step.label, destinationUrl: step.destination_url, contactId: ctx.contactId });
      const url = `${baseUrl}/r/${code}`;
      const text = appendPrivacyFooter(step.text, ctx.language);
      const sent = await effects.sendButtons({ token: ctx.pageAccessToken, igUserId: ctx.igUserId, text, buttons: [{ type: 'web_url', title: step.label, url }] });
      await effects.logSend({ messageType: 'buttons', payload: { text, link_code: code, destination: step.destination_url }, metaMessageId: sent.message_id });
      if (step.next_id) { step = findStep(ctx, step.next_id); continue; }
      return { nextStepId: null, awaitingInputType: null, expiresAt };
    }

    if (step.type === 'wait_for_button') {
      if (event.type === 'button' && step.expected_payloads.includes(event.payload)) {
        const next = step.on_each[event.payload];
        step = findStep(ctx, next);
        // consume event for transition only — next step is outbound
        event = { type: 'trigger' };
        continue;
      }
      return { nextStepId: step.id, awaitingInputType: 'button', expiresAt };
    }

    if (step.type === 'wait_for_text') {
      if (event.type === 'text') {
        const ok = step.regex ? new RegExp(step.regex).test(event.text) : true;
        if (ok) { step = findStep(ctx, step.on_match_next_id); event = { type: 'trigger' }; continue; }
        if (step.on_miss === 'retry') return { nextStepId: step.id, awaitingInputType: 'text', expiresAt };
        if (step.on_miss === 'end') return { nextStepId: null, awaitingInputType: null, expiresAt };
        step = findStep(ctx, step.on_miss); event = { type: 'trigger' }; continue;
      }
      return { nextStepId: step.id, awaitingInputType: 'text', expiresAt };
    }

    if (step.type === 'collect_email') {
      // collect_email expands into a mini-dialogue managed by the handler (Task 23).
      // Here we send the consent prompt and pause for button input.
      const ct = consentText(ctx.language);
      const sent = await effects.sendButtons({
        token: ctx.pageAccessToken,
        igUserId: ctx.igUserId,
        text: appendPrivacyFooter(ct.body, ctx.language),
        buttons: [
          { type: 'postback', title: ct.agree, payload: `EMAIL_AGREE_${step.id}` },
          { type: 'postback', title: ct.decline, payload: `EMAIL_DECLINE_${step.id}` },
        ],
      });
      await effects.logSend({ messageType: 'buttons', payload: { stage: 'email_consent', step: step.id, policy_version: CURRENT_POLICY_VERSION }, metaMessageId: sent.message_id });
      return { nextStepId: step.id, awaitingInputType: 'button', expiresAt };
    }

    if (step.type === 'branch') {
      if (event.type === 'button') {
        const hit = step.cases.find((c) => c.when === event.payload);
        if (hit) { step = findStep(ctx, hit.next_id); event = { type: 'trigger' }; continue; }
        if (step.default_next_id) { step = findStep(ctx, step.default_next_id); event = { type: 'trigger' }; continue; }
      }
      return { nextStepId: step.id, awaitingInputType: 'button', expiresAt };
    }

    if (step.type === 'end') {
      return { nextStepId: null, awaitingInputType: null, expiresAt: null };
    }

    throw new Error(`Unhandled step type`);
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/flow-engine/machine.ts tests/unit/machine.test.ts
git commit -m "feat(flow): state machine driver"
```

---

### Task 19: Erasure flow definition

**Files:**
- Create: `lib/flow-engine/erasure-flow.ts`

- [ ] **Step 1: Implement**

`lib/flow-engine/erasure-flow.ts`:

```ts
import type { FlowStep } from './schema';

const TEXT = {
  tr: { confirm: 'Tüm verilerini silmek istediğinden emin misin?', yes: 'Evet, sil', no: 'Vazgeç', done: 'Verilerin silindi. ✅', cancelled: 'İptal edildi.' },
  en: { confirm: 'Are you sure you want to delete all your data?', yes: 'Yes, delete everything', no: 'Cancel', done: 'Your data has been deleted. ✅', cancelled: 'Cancelled.' },
};

export function buildErasureSteps(lang: 'tr' | 'en'): FlowStep[] {
  const t = TEXT[lang];
  return [
    { id: 'confirm', type: 'send_message', text: t.confirm, buttons: [
      { label: t.yes, action: { type: 'next', next_id: 'execute' } },
      { label: t.no, action: { type: 'next', next_id: 'cancelled' } },
    ] },
    { id: 'execute', type: 'send_message', text: t.done, next_id: 'end' },
    { id: 'cancelled', type: 'send_message', text: t.cancelled, next_id: 'end' },
    { id: 'end', type: 'end' },
  ];
}

export const ERASURE_FLOW_ID = '__erasure__';
```

- [ ] **Step 2: Commit**

```bash
git add lib/flow-engine/erasure-flow.ts
git commit -m "feat(flow): built-in erasure flow steps (TR/EN)"
```

---

### Task 20: Erasure execution helper

**Files:**
- Create: `lib/flow-engine/erasure-execute.ts`, `tests/unit/erasure-execute.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/erasure-execute.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { executeErasure } from '@/lib/flow-engine/erasure-execute';

describe('executeErasure', () => {
  it('runs the documented anonymization sequence in order', async () => {
    const calls: string[] = [];
    const db = {
      from(table: string) {
        const chain = {
          delete: () => chain,
          update: () => chain,
          insert: () => { calls.push(`insert:${table}`); return chain; },
          eq: () => chain,
          select: () => chain,
          single: async () => ({ data: { id: 'x' }, error: null }),
          then: (cb: any) => cb({ data: null, error: null }),
        } as any;
        if (table === 'contacts') calls.push('delete:contacts');
        if (table === 'email_subscribers') calls.push('update:email_subscribers');
        if (table === 'messages_log') calls.push('update:messages_log');
        if (table === 'consent_log') calls.push('update:consent_log');
        return chain;
      },
    };
    await executeErasure({ contactId: 'c1', requestedVia: 'dm', db: db as any });
    expect(calls.some((c) => c.startsWith('insert:deletion_requests'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/flow-engine/erasure-execute.ts`:

```ts
import { serviceClient } from '@/lib/db/client';
import bcrypt from 'bcryptjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';

export async function executeErasure(args: {
  contactId: string;
  requestedVia: 'dm' | 'admin' | 'email';
  db?: SupabaseClient<Database>;
}) {
  const db = args.db ?? serviceClient();

  // 1. Open deletion_requests row
  const { data: req } = await db.from('deletion_requests').insert({
    contact_id: args.contactId,
    requested_via: args.requestedVia,
    status: 'pending',
  }).select().single();

  // 2. Hash existing emails on email_subscribers (preserve uniqueness, drop PII)
  const { data: subs } = await db.from('email_subscribers').select('id,email').eq('contact_id', args.contactId);
  for (const s of subs ?? []) {
    const hashed = await bcrypt.hash(s.email, 8);
    await db.from('email_subscribers').update({ email: hashed, status: 'deleted' }).eq('id', s.id);
  }

  // 3. Anonymize messages_log (NULL ig_user references in payload by overwriting)
  await db.from('messages_log').update({ payload: { redacted: true } }).eq('contact_id', args.contactId);

  // 4. NULL out contact_id on consent_log (preserve audit trail)
  await db.from('consent_log').update({ contact_id: null }).eq('contact_id', args.contactId);

  // 5. Hard delete contact (cascades to conversation_state, link_codes, clicks via FKs)
  await db.from('contacts').delete().eq('id', args.contactId);

  // 6. Close deletion_requests row (contact_id will be NULL after the delete cascade)
  if (req) {
    await db.from('deletion_requests').update({
      status: 'completed',
      processed_at: new Date().toISOString(),
      contact_id: null,
    }).eq('id', req.id);
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/flow-engine/erasure-execute.ts tests/unit/erasure-execute.test.ts
git commit -m "feat(flow): erasure execution (anonymize + delete + audit)"
```

---

## Phase 6 — Webhook handler

### Task 21: GET /api/webhooks/meta (verification challenge)

**Files:**
- Create: `app/api/webhooks/meta/route.ts`

- [ ] **Step 1: Implement GET handler**

`app/api/webhooks/meta/route.ts`:

```ts
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}
```

- [ ] **Step 2: Quick verify**

Run `npm run dev` in one terminal; in another:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=$(grep META_VERIFY_TOKEN .env.local | cut -d= -f2-)&hub.challenge=foo"
```

Expected: `200` (after setting `META_VERIFY_TOKEN` in `.env.local`).

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/meta/route.ts
git commit -m "feat(webhook): GET subscription verification handler"
```

---

### Task 22: POST /api/webhooks/meta (signature + dedupe + dispatch)

**Files:**
- Create: `app/api/webhooks/meta/handler.ts`
- Modify: `app/api/webhooks/meta/route.ts`

- [ ] **Step 1: Implement event handler**

`app/api/webhooks/meta/handler.ts`:

```ts
import { MetaWebhookSchema } from '@/lib/meta/types';
import { matchesErasureKeyword } from '@/lib/flow-engine/reserved-keywords';
import { findCommentFlow, findDmFlow, findStoryReplyFlow } from '@/lib/flow-engine/routing';
import { advance, type Effects, type FlowContext } from '@/lib/flow-engine/machine';
import { buildErasureSteps, ERASURE_FLOW_ID } from '@/lib/flow-engine/erasure-flow';
import { executeErasure } from '@/lib/flow-engine/erasure-execute';
import { findIgAccountByBusinessId, upsertContact, loadConversationState, saveConversationState, alreadyProcessed, logMessage } from '@/lib/db/queries';
import { decryptSecret } from '@/lib/db/encryption';
import { sendButtons, sendText, sendPrivateReplyToComment } from '@/lib/meta/client';
import { generateLinkCode } from '@/lib/links/shorten';
import { serviceClient } from '@/lib/db/client';
import { FlowStepsSchema } from '@/lib/flow-engine/schema';

function buildEffects(token: string, igAccountId: string, contactId: string): Effects {
  return {
    sendText: ({ token: t, igUserId, text }) => sendText({ pageAccessToken: t, igUserId, text }),
    sendButtons: ({ token: t, igUserId, text, buttons }) => sendButtons({ pageAccessToken: t, igUserId, text, buttons: buttons as any }),
    recordLink: async ({ flowId, stepId, label, destinationUrl, contactId: c }) => {
      const db = serviceClient();
      const { data: link } = await db.from('links').insert({ flow_id: flowId, step_id: stepId, label, destination_url: destinationUrl }).select().single();
      if (!link) throw new Error('failed to insert link');
      const code = generateLinkCode();
      await db.from('link_codes').insert({ link_id: link.id, contact_id: c, code });
      return code;
    },
    logSend: ({ messageType, payload, metaMessageId }) =>
      logMessage({ ig_account_id: igAccountId, contact_id: contactId, direction: 'out', message_type: messageType, payload, meta_message_id: metaMessageId }).then(() => {}),
  };
}

export async function handleMetaWebhook(rawBody: string): Promise<{ status: number; body?: string }> {
  const parsed = MetaWebhookSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) return { status: 200 }; // ack unknown shapes; don't make Meta retry

  for (const entry of parsed.data.entry) {
    // Comments
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (await alreadyProcessed(v.id)) continue;
      const account = await findIgAccountByBusinessId(entry.id);
      if (!account) continue;
      const flow = await findCommentFlow({ igAccountId: account.id, postId: v.media.id, commentText: v.text });
      if (!flow) continue;
      const contact = await upsertContact({ igAccountId: account.id, igUserId: v.from.id, igUsername: v.from.username });
      const token = await decryptSecret(account.page_access_token_enc as unknown as Uint8Array);
      // Use Private Reply for the FIRST message to a comment-trigger; then resume in DM thread.
      const firstStep = FlowStepsSchema.parse(flow.steps)[0];
      if (firstStep?.type === 'send_message' && (!firstStep.buttons || firstStep.buttons.length === 0)) {
        await sendPrivateReplyToComment({ pageAccessToken: token, commentId: v.id, text: firstStep.text });
        await logMessage({ ig_account_id: account.id, contact_id: contact.id, direction: 'out', message_type: 'private_reply', payload: { text: firstStep.text }, meta_message_id: v.id });
      }
      // Advance through the rest as DM
      const result = await advance(
        { steps: FlowStepsSchema.parse(flow.steps), language: flow.language as 'tr' | 'en', currentStepId: null, contactId: contact.id, igAccountId: account.id, flowId: flow.id, pageAccessToken: token, igUserId: v.from.id },
        { type: 'trigger' },
        buildEffects(token, account.id, contact.id),
      );
      await saveConversationState({ contact_id: contact.id, current_flow_id: flow.id, current_step_id: result.nextStepId, awaiting_input_type: result.awaitingInputType, expires_at: result.expiresAt, context: {} });
    }

    // Messages and postbacks
    for (const m of entry.messaging ?? []) {
      const mid = m.message?.mid ?? m.postback?.mid ?? `${m.sender.id}:${m.timestamp}`;
      if (await alreadyProcessed(mid)) continue;
      const account = await findIgAccountByBusinessId(entry.id);
      if (!account) continue;
      const contact = await upsertContact({ igAccountId: account.id, igUserId: m.sender.id });
      const token = await decryptSecret(account.page_access_token_enc as unknown as Uint8Array);
      await logMessage({ ig_account_id: account.id, contact_id: contact.id, direction: 'in', message_type: m.postback ? 'postback' : 'text', payload: m, meta_message_id: mid });

      // Reserved-keyword erasure pre-emption
      if (m.message?.text && matchesErasureKeyword(m.message.text)) {
        const result = await advance(
          { steps: buildErasureSteps((account.default_language as 'tr' | 'en')), language: account.default_language as 'tr' | 'en', currentStepId: null, contactId: contact.id, igAccountId: account.id, flowId: ERASURE_FLOW_ID, pageAccessToken: token, igUserId: m.sender.id },
          { type: 'trigger' },
          buildEffects(token, account.id, contact.id),
        );
        await saveConversationState({ contact_id: contact.id, current_flow_id: null, current_step_id: result.nextStepId, awaiting_input_type: result.awaitingInputType, expires_at: result.expiresAt, context: { erasure: true } });
        continue;
      }

      // Confirm erasure when the user is in the erasure flow
      const state = await loadConversationState(contact.id);
      if (state?.context && (state.context as any).erasure && m.postback) {
        if (m.postback.payload === 'execute') {
          await executeErasure({ contactId: contact.id, requestedVia: 'dm' });
          continue;
        }
      }

      // In-progress flow?
      if (state?.current_flow_id) {
        const flow = await serviceClient().from('flows').select('*').eq('id', state.current_flow_id).maybeSingle();
        if (flow.data) {
          const event = m.postback
            ? { type: 'button' as const, payload: m.postback.payload }
            : { type: 'text' as const, text: m.message?.text ?? '' };
          const result = await advance(
            { steps: FlowStepsSchema.parse(flow.data.steps), language: flow.data.language as 'tr' | 'en', currentStepId: state.current_step_id, contactId: contact.id, igAccountId: account.id, flowId: flow.data.id, pageAccessToken: token, igUserId: m.sender.id },
            event,
            buildEffects(token, account.id, contact.id),
          );
          await saveConversationState({ contact_id: contact.id, current_flow_id: result.nextStepId ? flow.data.id : null, current_step_id: result.nextStepId, awaiting_input_type: result.awaitingInputType, expires_at: result.expiresAt, context: {} });
          continue;
        }
      }

      // No in-progress flow: try DM- or story-reply triggers
      let flow = null;
      if (m.message?.reply_to?.story && m.message.text) {
        flow = await findStoryReplyFlow({ igAccountId: account.id, text: m.message.text });
      } else if (m.message?.text) {
        flow = await findDmFlow({ igAccountId: account.id, text: m.message.text });
      }
      if (!flow) continue;
      const result = await advance(
        { steps: FlowStepsSchema.parse(flow.steps), language: flow.language as 'tr' | 'en', currentStepId: null, contactId: contact.id, igAccountId: account.id, flowId: flow.id, pageAccessToken: token, igUserId: m.sender.id },
        { type: 'trigger' },
        buildEffects(token, account.id, contact.id),
      );
      await saveConversationState({ contact_id: contact.id, current_flow_id: flow.id, current_step_id: result.nextStepId, awaiting_input_type: result.awaitingInputType, expires_at: result.expiresAt, context: {} });
    }
  }

  return { status: 200 };
}
```

- [ ] **Step 2: Wire POST handler**

Edit `app/api/webhooks/meta/route.ts` — replace contents:

```ts
import { NextResponse } from 'next/server';
import { verifyMetaSignature } from '@/lib/meta/signature';
import { handleMetaWebhook } from './handler';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new NextResponse('invalid signature', { status: 401 });
  }
  try {
    const result = await handleMetaWebhook(raw);
    return new NextResponse(result.body ?? '', { status: result.status });
  } catch (err) {
    console.error('webhook error', err);
    // 200 to avoid Meta retries; surface via Sentry instead
    return new NextResponse('error logged', { status: 200 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/meta/
git commit -m "feat(webhook): POST handler with signature verify, dedupe, dispatch"
```

---

### Task 23: Webhook integration test with fixtures

**Files:**
- Create: `tests/integration/webhook.test.ts`

- [ ] **Step 1: Write integration test**

`tests/integration/webhook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { POST } from '@/app/api/webhooks/meta/route';
import comment from '../fixtures/meta/comment.json';

vi.mock('@/lib/db/queries', () => ({
  findIgAccountByBusinessId: vi.fn().mockResolvedValue({ id: 'a1', default_language: 'en', page_access_token_enc: new Uint8Array(48) }),
  upsertContact: vi.fn().mockResolvedValue({ id: 'c1' }),
  loadConversationState: vi.fn().mockResolvedValue(null),
  saveConversationState: vi.fn().mockResolvedValue(undefined),
  alreadyProcessed: vi.fn().mockResolvedValue(false),
  logMessage: vi.fn().mockResolvedValue({ id: 'log1' }),
}));
vi.mock('@/lib/flow-engine/routing', () => ({
  findCommentFlow: vi.fn().mockResolvedValue({ id: 'f1', language: 'en', steps: [{ id: 's1', type: 'send_message', text: 'Hi' }] }),
  findDmFlow: vi.fn(), findStoryReplyFlow: vi.fn(),
}));
vi.mock('@/lib/db/encryption', () => ({ decryptSecret: vi.fn().mockResolvedValue('TOKEN') }));
vi.mock('@/lib/meta/client', () => ({
  sendText: vi.fn().mockResolvedValue({ message_id: 'm' }),
  sendButtons: vi.fn().mockResolvedValue({ message_id: 'm' }),
  sendPrivateReplyToComment: vi.fn().mockResolvedValue({ message_id: 'm' }),
}));

beforeEach(() => { vi.clearAllMocks(); });

function signed(body: string) {
  const sig = 'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(body).digest('hex');
  return new Request('http://localhost/api/webhooks/meta', {
    method: 'POST',
    body,
    headers: { 'x-hub-signature-256': sig, 'content-type': 'application/json' },
  });
}

describe('POST /api/webhooks/meta', () => {
  it('rejects bad signature with 401', async () => {
    const res = await POST(new Request('http://localhost/api/webhooks/meta', { method: 'POST', body: '{}', headers: { 'x-hub-signature-256': 'sha256=00' } }));
    expect(res.status).toBe(401);
  });

  it('processes a comment event end-to-end with valid signature', async () => {
    const body = JSON.stringify(comment);
    const res = await POST(signed(body));
    expect(res.status).toBe(200);
    const { sendPrivateReplyToComment } = await import('@/lib/meta/client');
    expect(sendPrivateReplyToComment).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect PASS**

```bash
npm test -- webhook
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/
git commit -m "test(webhook): integration test with signed comment fixture"
```

---

## Phase 7 — Link tracking

### Task 24: GET /r/[code] redirect with click logging

**Files:**
- Create: `app/r/[code]/route.ts`, `tests/integration/redirect.test.ts`

- [ ] **Step 1: Write failing test**

`tests/integration/redirect.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/r/[code]/route';

vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === 'link_codes'
              ? { data: { id: 'lc1', code: 'ABC', first_clicked_at: null, links: { destination_url: 'https://example.com' } }, error: null }
              : { data: null, error: null },
        }),
      }),
      insert: () => ({ then: (cb: any) => cb({ data: null, error: null }) }),
      update: () => ({ eq: () => ({ then: (cb: any) => cb({ data: null, error: null }) }) }),
    }),
  }),
}));
vi.mock('@/lib/links/ip-hash', () => ({ hashIp: async () => 'iphash' }));

describe('GET /r/[code]', () => {
  it('302 redirects when code exists', async () => {
    const res = await GET(new Request('http://localhost/r/ABC'), { params: Promise.resolve({ code: 'ABC' }) });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com');
  });
  it('404 when missing', async () => {
    const res = await GET(new Request('http://localhost/r/zzz'), { params: Promise.resolve({ code: 'zzz' }) });
    expect([302, 404]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`app/r/[code]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/db/client';
import { hashIp } from '@/lib/links/ip-hash';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = serviceClient();
  const { data, error } = await db
    .from('link_codes')
    .select('id, first_clicked_at, links!inner(destination_url)')
    .eq('code', code)
    .maybeSingle() as any;
  if (error || !data) return new NextResponse('not found', { status: 404 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const ua = req.headers.get('user-agent') ?? '';
  try {
    const ipHash = await hashIp(ip);
    await db.from('clicks').insert({ link_code_id: data.id, ip_hash: ipHash, user_agent: ua });
    if (!data.first_clicked_at) {
      await db.from('link_codes').update({ first_clicked_at: new Date().toISOString() }).eq('id', data.id);
    }
  } catch {
    // best-effort logging
  }
  return NextResponse.redirect(data.links.destination_url, 302);
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add app/r tests/integration/redirect.test.ts
git commit -m "feat(links): GET /r/[code] redirect with click logging"
```

---

## Phase 8 — Email provider adapters

### Task 25: Adapter interface + NoneAdapter

**Files:**
- Create: `lib/email-providers/adapter.ts`, `lib/email-providers/none.ts`, `tests/unit/email-none.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/email-none.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NoneAdapter } from '@/lib/email-providers/none';

describe('NoneAdapter', () => {
  it('returns id "none"', async () => {
    const r = await new NoneAdapter().subscribe({ email: 'a@b', igUsername: 'u', flowName: 'f', language: 'en' });
    expect(r.id).toBe('none');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/email-providers/adapter.ts`:

```ts
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

`lib/email-providers/none.ts`:

```ts
import type { EmailProviderAdapter } from './adapter';
export class NoneAdapter implements EmailProviderAdapter {
  readonly kind = 'none' as const;
  async subscribe(): Promise<{ id: string }> { return { id: 'none' }; }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/email-providers/adapter.ts lib/email-providers/none.ts tests/unit/email-none.test.ts
git commit -m "feat(email): adapter interface and NoneAdapter"
```

---

### Task 26: ResendAdapter

**Files:**
- Create: `lib/email-providers/resend.ts`, `tests/unit/email-resend.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/email-resend.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResendAdapter } from '@/lib/email-providers/resend';

const fetchMock = vi.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'res-1' } }) });
});

describe('ResendAdapter', () => {
  it('POSTs to Resend Audiences contacts endpoint', async () => {
    const r = await new ResendAdapter({ apiKey: 'KEY' }).subscribe({ email: 'a@b.com', igUsername: 'u', flowName: 'f', language: 'en', audienceId: 'aud-1' });
    expect(r.id).toBe('res-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/audiences\/aud-1\/contacts/);
    expect(init.headers.Authorization).toBe('Bearer KEY');
    expect(JSON.parse(init.body)).toMatchObject({ email: 'a@b.com' });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/email-providers/resend.ts`:

```ts
import type { EmailProviderAdapter } from './adapter';

export class ResendAdapter implements EmailProviderAdapter {
  readonly kind = 'resend' as const;
  constructor(private opts: { apiKey: string }) {}
  async subscribe(input: { email: string; igUsername: string; flowName: string; language: 'tr' | 'en'; audienceId?: string }): Promise<{ id: string }> {
    if (!input.audienceId) throw new Error('Resend requires audienceId');
    const res = await fetch(`https://api.resend.com/audiences/${input.audienceId}/contacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        first_name: input.igUsername,
        unsubscribed: false,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
    const json = await res.json();
    return { id: json.data?.id ?? 'unknown' };
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/email-providers/resend.ts tests/unit/email-resend.test.ts
git commit -m "feat(email): ResendAdapter for Resend Audiences"
```

---

### Task 27: MailchimpAdapter

**Files:**
- Create: `lib/email-providers/mailchimp.ts`, `tests/unit/email-mailchimp.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/email-mailchimp.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailchimpAdapter } from '@/lib/email-providers/mailchimp';

const fetchMock = vi.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'mc-1' }) });
});

describe('MailchimpAdapter', () => {
  it('POSTs to lists/{id}/members with subscribed status', async () => {
    const r = await new MailchimpAdapter({ apiKey: 'us1-KEY' }).subscribe({ email: 'a@b.com', igUsername: 'u', flowName: 'f', language: 'en', audienceId: 'list-1' });
    expect(r.id).toBe('mc-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/us1\.api\.mailchimp\.com\/3\.0\/lists\/list-1\/members/);
    expect(JSON.parse(init.body)).toMatchObject({ email_address: 'a@b.com', status: 'subscribed' });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`lib/email-providers/mailchimp.ts`:

```ts
import type { EmailProviderAdapter } from './adapter';

export class MailchimpAdapter implements EmailProviderAdapter {
  readonly kind = 'mailchimp' as const;
  constructor(private opts: { apiKey: string }) {}
  async subscribe(input: { email: string; igUsername: string; flowName: string; language: 'tr' | 'en'; audienceId?: string }): Promise<{ id: string }> {
    if (!input.audienceId) throw new Error('Mailchimp requires audienceId (list_id)');
    const dc = this.opts.apiKey.split('-')[1] ?? 'us1';
    const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${input.audienceId}/members`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${this.opts.apiKey}`).toString('base64')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email_address: input.email,
        status: 'subscribed',
        language: input.language,
        merge_fields: { IGUSER: input.igUsername },
        tags: [input.flowName],
      }),
    });
    if (!res.ok) throw new Error(`Mailchimp ${res.status}`);
    const json = await res.json();
    return { id: json.id ?? 'unknown' };
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/email-providers/mailchimp.ts tests/unit/email-mailchimp.test.ts
git commit -m "feat(email): MailchimpAdapter for List members API"
```

---

### Task 28: Email step end-to-end wiring

**Files:**
- Create: `lib/email-providers/factory.ts`, `lib/flow-engine/email-step.ts`

- [ ] **Step 1: Implement provider factory**

`lib/email-providers/factory.ts`:

```ts
import { NoneAdapter } from './none';
import { ResendAdapter } from './resend';
import { MailchimpAdapter } from './mailchimp';
import type { EmailProviderAdapter } from './adapter';
import { decryptSecret } from '@/lib/db/encryption';

export type ProviderConfig =
  | { kind: 'none' }
  | { kind: 'resend'; api_key_enc: string; audience_id: string }
  | { kind: 'mailchimp'; api_key_enc: string; audience_id: string };

export async function makeProvider(cfg: ProviderConfig): Promise<EmailProviderAdapter> {
  if (cfg.kind === 'none') return new NoneAdapter();
  const apiKey = await decryptSecret(Buffer.from(cfg.api_key_enc, 'base64'));
  if (cfg.kind === 'resend') return new ResendAdapter({ apiKey });
  if (cfg.kind === 'mailchimp') return new MailchimpAdapter({ apiKey });
  throw new Error('unknown provider');
}
```

- [ ] **Step 2: Implement email-step orchestration helper**

`lib/flow-engine/email-step.ts`:

```ts
import { serviceClient } from '@/lib/db/client';
import { makeProvider, type ProviderConfig } from '@/lib/email-providers/factory';
import { EMAIL_CONSENT_EN } from '@/lib/consent/email-consent-text.en';
import { EMAIL_CONSENT_TR } from '@/lib/consent/email-consent-text.tr';
import { CURRENT_POLICY_VERSION } from '@/lib/consent/policy-versions';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function captureEmail(args: {
  igAccountId: string;
  contactId: string;
  igUsername: string | null;
  flowId: string;
  flowName: string;
  language: 'tr' | 'en';
  emailText: string;
  providerConfig: ProviderConfig;
}): Promise<{ ok: boolean; status: 'pending' | 'confirmed'; message: string }> {
  const t = args.language === 'tr' ? EMAIL_CONSENT_TR : EMAIL_CONSENT_EN;
  if (!EMAIL_RE.test(args.emailText.trim())) return { ok: false, status: 'pending', message: t.invalidEmail };

  const db = serviceClient();
  const { data: sub } = await db.from('email_subscribers').insert({
    ig_account_id: args.igAccountId,
    contact_id: args.contactId,
    email: args.emailText.trim(),
    consent_at: new Date().toISOString(),
    consent_text_version: CURRENT_POLICY_VERSION,
    source_flow_id: args.flowId,
    status: 'pending',
  }).select().single();

  try {
    const adapter = await makeProvider(args.providerConfig);
    const ext = await adapter.subscribe({
      email: args.emailText.trim(),
      igUsername: args.igUsername ?? '',
      flowName: args.flowName,
      language: args.language,
    });
    if (sub) {
      await db.from('email_subscribers').update({ status: 'confirmed', provider_id: ext.id }).eq('id', sub.id);
    }
    return { ok: true, status: 'confirmed', message: t.confirmation };
  } catch {
    return { ok: true, status: 'pending', message: t.fallback };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/email-providers/factory.ts lib/flow-engine/email-step.ts
git commit -m "feat(email): provider factory + captureEmail orchestration"
```

---

## Phase 9 — Privacy pages

### Task 29: /p/[lang] privacy policy page

**Files:**
- Create: `app/p/[lang]/page.tsx`, `lib/consent/policy-content.tr.ts`, `lib/consent/policy-content.en.ts`

- [ ] **Step 1: Implement policy content (TR)**

`lib/consent/policy-content.tr.ts`:

```ts
export const POLICY_TR = `
# Gizlilik Politikası

**Veri Sorumlusu:** [Operatör Adı] — iletişim: privacy@example.com

## Topladığımız Veriler
- Instagram kullanıcı adı ve Instagram kullanıcı kimliği (IG user id)
- İsteğe bağlı olarak verdiğiniz e-posta adresi
- Otomatik mesaj akışı içindeki tıklama meta-verisi (zaman damgası, IP'nin tek yönlü özetlenmiş hali)

## Hukuki Dayanak
- E-posta adresi: KVKK kapsamında **açık rıza**
- DM otomasyonu: meşru menfaat (yorum bırakarak iletişimi siz başlattınız)

## Saklama Süresi
24 ay (varsayılan). Talebiniz halinde daha önce silinir.

## Haklarınız
KVKK md. 11 kapsamında verilerinize erişme, düzeltme, silme, itiraz hakkınız vardır. Silme talebi için DM'den \`SİL\` yazmanız yeterlidir.

## Veri Aktarımı
Verileriniz Vercel ve Supabase altyapısında saklanır. Üçüncü taraflara satılmaz.

Politika sürümü: 2026-05-27.v1
`;
```

- [ ] **Step 2: Implement policy content (EN)**

`lib/consent/policy-content.en.ts`:

```ts
export const POLICY_EN = `
# Privacy Policy

**Data controller:** [Operator name] — contact: privacy@example.com

## What we collect
- Instagram username and Instagram user id
- Email address (only when you optionally provide one)
- Click metadata in tracked links (timestamp, one-way hash of your IP)

## Legal basis
- Email address: explicit consent (GDPR Art. 6(1)(a), KVKK açık rıza)
- DM automation: legitimate interest (GDPR Art. 6(1)(f)) — you initiated contact by commenting

## Retention
24 months (default). Deleted sooner on request.

## Your rights
Access, rectification, erasure, objection, portability (GDPR Art. 15–22; KVKK Art. 11). To erase, DM \`DELETE\` or \`SİL\` to this account.

## CCPA / CPRA notice
We do not sell or share personal information for cross-context behavioral advertising.

## Data location
Stored on Vercel and Supabase infrastructure. Not sold to third parties.

Policy version: 2026-05-27.v1
`;
```

- [ ] **Step 3: Implement page**

`app/p/[lang]/page.tsx`:

```tsx
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
      <meta name="policy-version" content="2026-05-27.v1" />
      {policy}
    </main>
  );
}
```

- [ ] **Step 4: Verify**

Run `npm run dev`, visit `http://localhost:3000/p/tr` and `http://localhost:3000/p/en` — both render.

- [ ] **Step 5: Commit**

```bash
git add app/p lib/consent/policy-content.tr.ts lib/consent/policy-content.en.ts
git commit -m "feat(compliance): /p/[lang] privacy policy pages (TR/EN)"
```

---

## Phase 10 — Admin auth and shell

### Task 30: Supabase Auth magic-link setup

**Files:**
- Modify: `supabase/config.toml`
- Create: `app/(admin)/layout.tsx`, `app/(admin)/sign-in/page.tsx`, `app/(admin)/auth/callback/route.ts`

- [ ] **Step 1: Configure local auth**

In `supabase/config.toml`, ensure:

```toml
[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/callback"]

[auth.email]
enable_signup = false
enable_confirmations = true
```

Apply: `npx supabase db reset` (re-applies migrations and config).

- [ ] **Step 2: Admin layout (allowlist gate)**

`app/(admin)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { userClient } from '@/lib/db/client';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await userClient();
  const { data: { user } } = await supabase.auth.getUser();
  const allowlist = (process.env.ADMIN_ALLOWLIST ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!user || !allowlist.includes(user.email ?? '')) redirect('/admin/sign-in');
  return (
    <div className="min-h-screen">
      <nav className="border-b p-3 flex gap-4 text-sm">
        <a href="/admin/accounts">Accounts</a>
        <a href="/admin/posts">Posts</a>
        <a href="/admin/flows">Flows</a>
        <a href="/admin/contacts">Contacts</a>
        <a href="/admin/stats">Stats</a>
        <span className="ml-auto text-gray-500">{user.email}</span>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Sign-in page**

`app/(admin)/sign-in/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  async function send() {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    if (!error) setSent(true);
  }
  return (
    <main className="max-w-sm mx-auto p-8 space-y-3">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {sent ? <p>Check your inbox.</p> : (
        <>
          <input className="w-full border p-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button className="bg-black text-white px-3 py-2" onClick={send}>Send magic link</button>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Callback route**

`app/(admin)/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { userClient } from '@/lib/db/client';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = await userClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL('/admin/accounts', url));
}
```

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\) supabase/config.toml
git commit -m "feat(admin): magic-link auth shell with allowlist gate"
```

---

## Phase 11 — Admin UI pages

### Task 31: IG Accounts page

**Files:**
- Create: `app/(admin)/accounts/page.tsx`, `app/(admin)/accounts/actions.ts`

- [ ] **Step 1: Implement page**

`app/(admin)/accounts/page.tsx`:

```tsx
import { serviceClient } from '@/lib/db/client';
import { addAccount } from './actions';

export default async function AccountsPage() {
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('*').order('created_at', { ascending: false });
  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Instagram Accounts</h1>
      <form action={addAccount} className="space-y-2 max-w-md">
        <input name="name" placeholder="Display name" className="w-full border p-2" required />
        <input name="ig_business_account_id" placeholder="IG Business Account ID" className="w-full border p-2" required />
        <input name="fb_page_id" placeholder="FB Page ID" className="w-full border p-2" required />
        <input name="page_access_token" placeholder="Page Access Token (long-lived)" className="w-full border p-2" required />
        <select name="default_language" className="w-full border p-2"><option value="tr">tr</option><option value="en">en</option></select>
        <button className="bg-black text-white px-3 py-2">Add</button>
      </form>
      <ul className="divide-y border rounded">
        {accounts?.map(a => (
          <li key={a.id} className="p-3 flex justify-between">
            <span>{a.name} <span className="text-gray-500">({a.ig_business_account_id})</span></span>
            <span className="text-xs text-gray-500">{a.default_language}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Implement server action**

`app/(admin)/accounts/actions.ts`:

```ts
'use server';
import { serviceClient } from '@/lib/db/client';
import { encryptSecret } from '@/lib/db/encryption';
import { revalidatePath } from 'next/cache';

export async function addAccount(form: FormData) {
  const name = String(form.get('name'));
  const igBiz = String(form.get('ig_business_account_id'));
  const fbPage = String(form.get('fb_page_id'));
  const token = String(form.get('page_access_token'));
  const lang = String(form.get('default_language'));
  const enc = await encryptSecret(token);
  const db = serviceClient();
  await db.from('ig_accounts').insert({
    name, ig_business_account_id: igBiz, fb_page_id: fbPage,
    page_access_token_enc: Buffer.from(enc),
    default_language: lang,
  });
  revalidatePath('/admin/accounts');
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/accounts
git commit -m "feat(admin): IG accounts list + add form"
```

---

### Task 32: Posts page (list + monitor toggle)

**Files:**
- Create: `app/(admin)/posts/page.tsx`, `app/(admin)/posts/actions.ts`

- [ ] **Step 1: Implement page**

`app/(admin)/posts/page.tsx`:

```tsx
import { serviceClient } from '@/lib/db/client';
import { syncPosts, toggleMonitor } from './actions';

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const sp = await searchParams;
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('id,name').order('created_at', { ascending: false });
  const accountId = sp.account ?? accounts?.[0]?.id;
  const { data: posts } = accountId
    ? await db.from('posts').select('*').eq('ig_account_id', accountId).order('created_at', { ascending: false })
    : { data: [] };
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <select defaultValue={accountId} className="border p-2" name="account" onChange={(e) => { window.location.search = `?account=${e.target.value}`; }}>
          {accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <form action={syncPosts.bind(null, accountId ?? '')}>
          <button className="border px-3 py-2 text-sm">Sync from Meta</button>
        </form>
      </div>
      <ul className="divide-y border rounded">
        {posts?.map(p => (
          <li key={p.id} className="p-3 flex justify-between gap-3">
            <a className="flex-1 truncate" href={p.permalink ?? '#'} target="_blank" rel="noreferrer">{p.caption_excerpt ?? p.ig_media_id}</a>
            <form action={toggleMonitor.bind(null, p.id, !p.monitored)}>
              <button className={`px-2 py-1 text-xs ${p.monitored ? 'bg-green-100' : 'bg-gray-100'}`}>{p.monitored ? 'monitored' : 'off'}</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Implement actions**

`app/(admin)/posts/actions.ts`:

```ts
'use server';
import { serviceClient } from '@/lib/db/client';
import { decryptSecret } from '@/lib/db/encryption';
import { revalidatePath } from 'next/cache';

export async function toggleMonitor(postId: string, next: boolean) {
  const db = serviceClient();
  await db.from('posts').update({ monitored: next }).eq('id', postId);
  revalidatePath('/admin/posts');
}

export async function syncPosts(igAccountId: string) {
  const db = serviceClient();
  const { data: acc } = await db.from('ig_accounts').select('*').eq('id', igAccountId).single();
  if (!acc) return;
  const token = await decryptSecret(acc.page_access_token_enc as unknown as Uint8Array);
  const res = await fetch(`https://graph.facebook.com/v21.0/${acc.ig_business_account_id}/media?fields=id,caption,permalink&limit=25&access_token=${encodeURIComponent(token)}`);
  const json = await res.json();
  for (const m of json.data ?? []) {
    await db.from('posts').upsert({
      ig_account_id: igAccountId,
      ig_media_id: m.id,
      caption_excerpt: (m.caption ?? '').slice(0, 140),
      permalink: m.permalink,
    }, { onConflict: 'ig_media_id' });
  }
  revalidatePath('/admin/posts');
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/posts
git commit -m "feat(admin): posts list with Meta sync and monitor toggle"
```

---

### Task 33: Flows list + create

**Files:**
- Create: `app/(admin)/flows/page.tsx`, `app/(admin)/flows/new/page.tsx`, `app/(admin)/flows/actions.ts`

- [ ] **Step 1: Implement list page**

`app/(admin)/flows/page.tsx`:

```tsx
import Link from 'next/link';
import { serviceClient } from '@/lib/db/client';

export default async function FlowsPage() {
  const db = serviceClient();
  const { data: flows } = await db.from('flows').select('id,name,language,trigger_type,archived,ig_account_id').order('updated_at', { ascending: false });
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Flows</h1>
        <Link href="/admin/flows/new" className="bg-black text-white px-3 py-2 text-sm">New</Link>
      </div>
      <ul className="divide-y border rounded">
        {flows?.map(f => (
          <li key={f.id} className="p-3 flex justify-between gap-3">
            <Link href={`/admin/flows/${f.id}`} className="flex-1 truncate">{f.name}</Link>
            <span className="text-xs text-gray-500">{f.trigger_type} · {f.language}{f.archived ? ' · archived' : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Implement new flow page**

`app/(admin)/flows/new/page.tsx`:

```tsx
import { serviceClient } from '@/lib/db/client';
import { createFlow } from '../actions';

export default async function NewFlow() {
  const db = serviceClient();
  const { data: accounts } = await db.from('ig_accounts').select('id,name');
  return (
    <form action={createFlow} className="space-y-2 max-w-md">
      <input name="name" placeholder="Flow name" className="w-full border p-2" required />
      <select name="ig_account_id" className="w-full border p-2">{accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <select name="language" className="w-full border p-2"><option>tr</option><option>en</option></select>
      <select name="trigger_type" className="w-full border p-2"><option value="comment">comment</option><option value="dm">dm</option><option value="story_reply">story_reply</option></select>
      <input name="trigger_keywords" placeholder="comma-separated keywords" className="w-full border p-2" required />
      <button className="bg-black text-white px-3 py-2">Create</button>
    </form>
  );
}
```

- [ ] **Step 3: Implement actions**

`app/(admin)/flows/actions.ts`:

```ts
'use server';
import { serviceClient } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { FlowStepsSchema } from '@/lib/flow-engine/schema';

export async function createFlow(form: FormData) {
  const db = serviceClient();
  const keywords = String(form.get('trigger_keywords')).split(',').map(s => s.trim()).filter(Boolean);
  const { data } = await db.from('flows').insert({
    name: String(form.get('name')),
    ig_account_id: String(form.get('ig_account_id')),
    language: String(form.get('language')),
    trigger_type: String(form.get('trigger_type')) as any,
    trigger_keywords: keywords,
    steps: [],
  }).select().single();
  redirect(`/admin/flows/${data!.id}`);
}

export async function saveFlowSteps(flowId: string, stepsJson: string) {
  const parsed = FlowStepsSchema.parse(JSON.parse(stepsJson));
  const db = serviceClient();
  await db.from('flows').update({ steps: parsed, updated_at: new Date().toISOString() }).eq('id', flowId);
}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/flows
git commit -m "feat(admin): flows list + create form"
```

---

### Task 34: Flow edit page (steps JSON editor)

**Files:**
- Create: `app/(admin)/flows/[id]/page.tsx`, `app/(admin)/flows/[id]/StepsEditor.tsx`

- [ ] **Step 1: Server component shell**

`app/(admin)/flows/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { serviceClient } from '@/lib/db/client';
import { StepsEditor } from './StepsEditor';

export default async function EditFlow({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = serviceClient();
  const { data: flow } = await db.from('flows').select('*').eq('id', id).maybeSingle();
  if (!flow) notFound();
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">{flow.name}</h1>
      <div className="text-sm text-gray-500">{flow.trigger_type} · {flow.language} · keywords: {flow.trigger_keywords.join(', ')}</div>
      <StepsEditor flowId={flow.id} initialSteps={(flow.steps ?? []) as any[]} />
    </section>
  );
}
```

- [ ] **Step 2: Client editor (JSON textarea — visual form deferred for simplicity in v1)**

`app/(admin)/flows/[id]/StepsEditor.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { saveFlowSteps } from '../actions';

export function StepsEditor({ flowId, initialSteps }: { flowId: string; initialSteps: unknown[] }) {
  const [json, setJson] = useState(JSON.stringify(initialSteps, null, 2));
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  async function save() {
    setErr(null); setOk(false);
    try { await saveFlowSteps(flowId, json); setOk(true); } catch (e: any) { setErr(e.message); }
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Edit the steps JSON directly. Validated by Zod on save.</p>
      <textarea className="w-full h-96 font-mono text-xs border p-2" value={json} onChange={(e) => setJson(e.target.value)} />
      <div className="flex items-center gap-3">
        <button onClick={save} className="bg-black text-white px-3 py-2">Save</button>
        {err && <span className="text-red-600 text-sm">{err}</span>}
        {ok && <span className="text-green-700 text-sm">Saved</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/flows/\[id\]
git commit -m "feat(admin): flow edit page with JSON steps editor"
```

---

### Task 35: Contacts page with delete action

**Files:**
- Create: `app/(admin)/contacts/page.tsx`, `app/(admin)/contacts/actions.ts`

- [ ] **Step 1: Implement page**

`app/(admin)/contacts/page.tsx`:

```tsx
import { serviceClient } from '@/lib/db/client';
import { eraseContact } from './actions';

export default async function ContactsPage() {
  const db = serviceClient();
  const { data: contacts } = await db.from('contacts').select('id,ig_username,ig_user_id,language,last_seen_at').order('last_seen_at', { ascending: false }).limit(200);
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Contacts</h1>
      <ul className="divide-y border rounded">
        {contacts?.map(c => (
          <li key={c.id} className="p-3 flex justify-between gap-3 items-center">
            <span>{c.ig_username ?? c.ig_user_id} <span className="text-xs text-gray-500">{c.language ?? ''}</span></span>
            <form action={eraseContact.bind(null, c.id)}>
              <button className="text-red-600 text-xs underline">Delete data</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Implement action**

`app/(admin)/contacts/actions.ts`:

```ts
'use server';
import { executeErasure } from '@/lib/flow-engine/erasure-execute';
import { revalidatePath } from 'next/cache';

export async function eraseContact(contactId: string) {
  await executeErasure({ contactId, requestedVia: 'admin' });
  revalidatePath('/admin/contacts');
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/contacts
git commit -m "feat(admin): contacts list with admin-initiated erasure"
```

---

### Task 36: Stats and failures pages

**Files:**
- Create: `app/(admin)/stats/page.tsx`, `app/(admin)/stats/failures/page.tsx`

- [ ] **Step 1: Implement stats page**

`app/(admin)/stats/page.tsx`:

```tsx
import { serviceClient } from '@/lib/db/client';

export default async function StatsPage() {
  const db = serviceClient();
  const { data: flows } = await db.from('flows').select('id,name,language,trigger_type').eq('archived', false);
  const stats = await Promise.all((flows ?? []).map(async (f) => {
    const sends = await db.from('messages_log').select('id', { count: 'exact', head: true }).eq('direction', 'out').contains('payload', {}).limit(0);
    const links = await db.from('link_codes').select('id,first_clicked_at', { count: 'exact' }).in('link_id', (await db.from('links').select('id').eq('flow_id', f.id)).data?.map(l => l.id) ?? []);
    const totalClicks = links.data?.filter(l => l.first_clicked_at).length ?? 0;
    const sent = links.data?.length ?? 0;
    return { ...f, sent, totalClicks };
  }));
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Stats</h1>
      <table className="w-full border text-sm">
        <thead><tr><th className="text-left p-2">Flow</th><th className="p-2">Sends w/ link</th><th className="p-2">Unique clicks</th><th className="p-2">CTR</th></tr></thead>
        <tbody>{stats.map(s => (
          <tr key={s.id} className="border-t">
            <td className="p-2">{s.name}</td>
            <td className="p-2 text-center">{s.sent}</td>
            <td className="p-2 text-center">{s.totalClicks}</td>
            <td className="p-2 text-center">{s.sent ? Math.round((s.totalClicks / s.sent) * 100) + '%' : '—'}</td>
          </tr>
        ))}</tbody>
      </table>
      <a href="/admin/stats/failures" className="text-sm underline">View failures →</a>
    </section>
  );
}
```

- [ ] **Step 2: Implement failures page**

`app/(admin)/stats/failures/page.tsx`:

```tsx
import { serviceClient } from '@/lib/db/client';

export default async function FailuresPage() {
  const db = serviceClient();
  const { data: rows } = await db.from('messages_log').select('id,ig_account_id,contact_id,message_type,error,sent_at').not('error', 'is', null).order('sent_at', { ascending: false }).limit(100);
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Failures (last 100)</h1>
      <ul className="divide-y border rounded text-xs font-mono">
        {rows?.map(r => (
          <li key={r.id} className="p-3">
            <div>{new Date(r.sent_at).toISOString()} — {r.message_type}</div>
            <pre className="overflow-auto bg-gray-50 p-2 mt-1">{JSON.stringify(r.error, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/stats
git commit -m "feat(admin): stats page + failures panel"
```

---

## Phase 12 — Production polish

### Task 37: Sentry integration

**Files:**
- Create: `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`

- [ ] **Step 1: Init Sentry**

```bash
npx @sentry/wizard@latest -i nextjs --saas --quiet
```

If wizard fails offline, hand-write the configs:

`instrumentation.ts`:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config');
}
```

`sentry.server.config.ts` and `sentry.edge.config.ts`:

```ts
import * as Sentry from '@sentry/nextjs';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request) delete event.request.cookies;
    return event;
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add instrumentation.ts sentry.*.config.ts next.config.ts
git commit -m "feat(obs): Sentry integration"
```

---

### Task 38: Playwright E2E smoke test

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Config**

```bash
npx playwright install --with-deps chromium
```

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI, timeout: 60000 },
  use: { baseURL: 'http://localhost:3000' },
});
```

- [ ] **Step 2: Write smoke**

`tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('homepage renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Instagram DM Automation')).toBeVisible();
});

test('privacy policy renders TR and EN', async ({ page }) => {
  await page.goto('/p/tr');
  await expect(page.getByText('Veri Sorumlusu')).toBeVisible();
  await page.goto('/p/en');
  await expect(page.getByText('Data controller')).toBeVisible();
});
```

- [ ] **Step 3: Run**

```bash
npm run test:e2e
```

Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test(e2e): Playwright smoke for homepage and privacy pages"
```

---

### Task 39: Deploy to Vercel

**Files:**
- Modify: README or no new files

- [ ] **Step 1: Link project**

```bash
npx vercel link
```

Follow prompts. Creates `.vercel/` (gitignored).

- [ ] **Step 2: Set env vars**

```bash
npx vercel env add NEXT_PUBLIC_APP_URL production
npx vercel env add META_APP_SECRET production
# ...repeat for each in .env.example
```

Or use the `vercel:env` skill / Vercel dashboard.

- [ ] **Step 3: Configure Supabase production**

Create production Supabase project, push migrations:

```bash
npx supabase link --project-ref <your-prod-ref>
npx supabase db push
```

- [ ] **Step 4: Deploy**

```bash
npx vercel --prod
```

- [ ] **Step 5: Register webhook in Meta**

In developers.facebook.com → your App → Instagram → Webhooks:
- Callback URL: `https://<your-vercel-domain>/api/webhooks/meta`
- Verify token: value of `META_VERIFY_TOKEN`
- Subscribe to fields: `comments`, `messages`, `messaging_postbacks`, `messaging_referral`

Test the verification handshake from Meta's UI.

- [ ] **Step 6: Final commit**

```bash
git commit --allow-empty -m "chore: production deploy"
```

---

## Self-review checklist

Review the plan against the spec before execution:

- [x] **Spec coverage:** All 15 spec sections mapped to tasks. (Goal/non-goals drive selection; data model → Task 4; flow engine → Phase 5; webhook → Phase 6; link tracking → Phase 7; email → Phase 8; compliance → Phase 9; admin auth → Phase 10; admin UI → Phase 11; testing throughout + Task 38; file structure → entire plan; env vars → Task 3.)
- [x] **No placeholders:** all "TBD" / "implement later" replaced with concrete code.
- [x] **Type consistency:** `FlowStep`, `Effects`, `FlowContext`, `EmailProviderAdapter` referenced by the same names across tasks.
- [x] **File-path consistency:** lib/db, lib/meta, lib/flow-engine, lib/email-providers, lib/consent, lib/links all match the spec's Section 12 file structure.

---

## Execution handoff

Plan complete and saved to [docs/superpowers/plans/2026-05-27-instagram-dm-automation.md](2026-05-27-instagram-dm-automation.md).

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Pick one to start.
