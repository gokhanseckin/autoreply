# Editable Collect Email Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `collect_email` flow's disclaimer, two button labels, email-request prompt, and decline goodbye admin-editable per flow; make Decline end the flow; and trigger a selected Resend Automation (via its custom event) when an email is captured.

**Architecture:** Per-flow config lives inside the `collect_email` step object in `flows.steps` (jsonb) — no DB migration. The Resend API key (encrypted) and audience_id stay at the account level in `ig_accounts.email_provider_config`. On capture we upsert the email into the Resend Audience (existing behavior), then best-effort fire the selected Resend custom event (`POST /events/send`). The admin step editor gains a panel with five text fields plus a dropdown populated from Resend's List Events API (`GET /events`) via a new admin-gated server action.

**Tech Stack:** Next.js (App Router, this fork — read `node_modules/next/dist/docs/` before touching framework APIs), TypeScript, Zod, Supabase (service client), Vitest, Resend REST API.

**Spec:** `docs/superpowers/specs/2026-06-10-collect-email-flow-editable-design.md`

**Commands:**
- Run one test file: `npm test -- tests/unit/<file>.test.ts`
- Run all tests: `npm test`
- Typecheck: `npx tsc --noEmit`

---

## File Structure

**New files:**
- `lib/consent/collect-email-step-text.ts` — localized defaults + resolver for the five editable fields. One responsibility: turn a `collect_email` step + language into concrete strings.
- `tests/unit/collect-email-step-text.test.ts` — unit tests for the resolver.

**Modified files:**
- `lib/flow-engine/schema.ts` — expand `CollectEmailStep` with six optional fields.
- `lib/email-providers/adapter.ts` — add optional `triggerEvent` to the interface.
- `lib/email-providers/resend.ts` — implement `triggerEvent` (Resend `POST /events/send`).
- `lib/flow-engine/email-step.ts` — `captureEmail` accepts `resendEvent` and fires it best-effort after a successful subscribe.
- `lib/flow-engine/machine.ts` — `collect_email` renders the resolved disclaimer + button labels.
- `app/api/webhooks/meta/handler.ts` — Agree sends the resolved request message; Decline sends the resolved goodbye then ends; capture forwards `resend_event`.
- `app/admin/(gated)/flows/actions.ts` — new `listResendEvents` server action.
- `app/admin/(gated)/flows/[id]/flow-builder-model.ts` — `createEmailStep` seeds language defaults.
- `app/admin/(gated)/flows/[id]/StepsEditor.tsx` — `EmailFields` editing panel + event dropdown; thread `language`, `accountId`, `providerKind` props.
- `app/admin/(gated)/flows/[id]/page.tsx` — load `email_provider_config`, pass new props to `StepsEditor`.

**Modified tests:**
- `tests/unit/flow-schema.test.ts`, `tests/unit/email-resend.test.ts`, `tests/unit/email-step.test.ts`, `tests/unit/machine.test.ts`, `tests/unit/action-auth.test.ts`, `tests/integration/webhook.test.ts`.
- `tests/unit/list-resend-events.test.ts` (new).

---

## Task 1: Expand the CollectEmailStep schema

**Files:**
- Modify: `lib/flow-engine/schema.ts:46-50`
- Test: `tests/unit/flow-schema.test.ts`

- [ ] **Step 1: Write the failing test** — append these cases inside the existing `describe('FlowStepsSchema', ...)` block in `tests/unit/flow-schema.test.ts` (before the closing `});` on line 53):

```typescript
  it('accepts a minimal collect_email step (back-compat)', () => {
    expect(FlowStepsSchema.safeParse([{ id: 'e1', type: 'collect_email' }]).success).toBe(true);
  });

  it('accepts a collect_email step with editable text fields and a resend event', () => {
    const step = [{
      id: 'e1',
      type: 'collect_email',
      next_id: 's2',
      disclaimer_message: 'Confirm to get your bonus by email.',
      accept_label: 'Kabul Et',
      decline_label: 'Reddet',
      request_message: 'Lütfen email adresinizi girin',
      decline_message: 'Tamam, sorun değil.',
      resend_event: 'welcome',
    }];
    expect(FlowStepsSchema.safeParse(step).success).toBe(true);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/flow-schema.test.ts`
Expected: FAIL — the editable-fields case fails because zod's object schema is strict on the discriminated union and these keys are unknown… actually zod strips unknown keys by default, so this may PASS for the wrong reason. To make the test meaningful, the implementation must persist the fields. The real verification is Task 8/integration; for now confirm the file runs. If both new cases PASS, continue (the fields are being stripped, which Step 3 fixes by declaring them).

- [ ] **Step 3: Add the fields to the schema** — replace `lib/flow-engine/schema.ts:46-50` (the `CollectEmailStep` definition) with:

```typescript
export const CollectEmailStep = z.object({
  id: z.string(),
  type: z.literal('collect_email'),
  next_id: z.string().optional(),
  // Editable per-flow consent copy. All optional so existing flows (which
  // store only id/type/next_id) keep validating; the flow engine and admin UI
  // fall back to localized defaults when a field is absent.
  disclaimer_message: z.string().optional(),
  accept_label: z.string().optional(),
  decline_label: z.string().optional(),
  request_message: z.string().optional(),
  decline_message: z.string().optional(),
  // Resend custom-event name fired on capture to start an Automation.
  resend_event: z.string().optional(),
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/flow-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/flow-engine/schema.ts tests/unit/flow-schema.test.ts
git commit -m "feat(flow): add editable text + resend_event fields to collect_email schema"
```

---

## Task 2: Localized defaults + resolver helper

**Files:**
- Create: `lib/consent/collect-email-step-text.ts`
- Test: `tests/unit/collect-email-step-text.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/unit/collect-email-step-text.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { collectEmailDefaults, resolveCollectEmailText } from '@/lib/consent/collect-email-step-text';

describe('collectEmailDefaults', () => {
  it('returns Turkish defaults', () => {
    const d = collectEmailDefaults('tr');
    expect(d.accept).toBe('Kabul Et');
    expect(d.decline).toBe('Reddet');
    expect(d.request).toBe('Lütfen email adresinizi girin');
    expect(d.declineGoodbye).toBe('Tamam, sorun değil.');
    expect(d.disclaimer.length).toBeGreaterThan(0);
  });

  it('returns English defaults', () => {
    const d = collectEmailDefaults('en');
    expect(d.accept).toBe('Accept');
    expect(d.decline).toBe('Decline');
    expect(d.request).toBe('Please enter your email');
    expect(d.declineGoodbye).toBe('No problem.');
  });
});

describe('resolveCollectEmailText', () => {
  it('prefers step values over defaults', () => {
    const r = resolveCollectEmailText(
      { id: 'e1', type: 'collect_email', accept_label: 'Evet', request_message: 'Mailini yaz' },
      'tr',
    );
    expect(r.accept).toBe('Evet');
    expect(r.request).toBe('Mailini yaz');
    expect(r.decline).toBe('Reddet'); // unset field falls back to the default
  });

  it('ignores blank/whitespace step values', () => {
    const r = resolveCollectEmailText({ id: 'e1', type: 'collect_email', accept_label: '   ' }, 'en');
    expect(r.accept).toBe('Accept');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/collect-email-step-text.test.ts`
Expected: FAIL with "Cannot find module '@/lib/consent/collect-email-step-text'"

- [ ] **Step 3: Create the helper** — create `lib/consent/collect-email-step-text.ts`:

```typescript
import { EMAIL_CONSENT_TR } from './email-consent-text.tr';
import { EMAIL_CONSENT_EN } from './email-consent-text.en';
import type { FlowStep } from '@/lib/flow-engine/schema';

type Lang = 'tr' | 'en';
type CollectEmailStep = Extract<FlowStep, { type: 'collect_email' }>;

export type CollectEmailText = {
  disclaimer: string;
  accept: string;
  decline: string;
  request: string;
  declineGoodbye: string;
};

export function collectEmailDefaults(lang: Lang): CollectEmailText {
  const consent = lang === 'tr' ? EMAIL_CONSENT_TR : EMAIL_CONSENT_EN;
  return {
    disclaimer: consent.body,
    accept: lang === 'tr' ? 'Kabul Et' : 'Accept',
    decline: lang === 'tr' ? 'Reddet' : 'Decline',
    request: lang === 'tr' ? 'Lütfen email adresinizi girin' : 'Please enter your email',
    declineGoodbye: lang === 'tr' ? 'Tamam, sorun değil.' : 'No problem.',
  };
}

// A blank/whitespace field counts as "unset" and falls back to the default,
// so an admin clearing a box never sends an empty message to a user.
function pick(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function resolveCollectEmailText(step: CollectEmailStep, lang: Lang): CollectEmailText {
  const d = collectEmailDefaults(lang);
  return {
    disclaimer: pick(step.disclaimer_message, d.disclaimer),
    accept: pick(step.accept_label, d.accept),
    decline: pick(step.decline_label, d.decline),
    request: pick(step.request_message, d.request),
    declineGoodbye: pick(step.decline_message, d.declineGoodbye),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/collect-email-step-text.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/consent/collect-email-step-text.ts tests/unit/collect-email-step-text.test.ts
git commit -m "feat(consent): localized defaults + resolver for collect_email copy"
```

---

## Task 3: Resend adapter triggerEvent

**Files:**
- Modify: `lib/email-providers/adapter.ts`
- Modify: `lib/email-providers/resend.ts`
- Test: `tests/unit/email-resend.test.ts`

- [ ] **Step 1: Write the failing test** — append a new describe block to `tests/unit/email-resend.test.ts` (after the existing `describe('ResendAdapter', ...)` block, before EOF):

```typescript
describe('ResendAdapter.triggerEvent', () => {
  it('POSTs to the Resend events/send endpoint with event + email + payload', async () => {
    await new ResendAdapter({ apiKey: 'KEY' }).triggerEvent({ email: 'a@b.com', event: 'welcome', payload: { plan: 'pro' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/events/send');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer KEY');
    expect(JSON.parse(init.body)).toEqual({ event: 'welcome', email: 'a@b.com', payload: { plan: 'pro' } });
  });

  it('throws on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422 });
    await expect(
      new ResendAdapter({ apiKey: 'KEY' }).triggerEvent({ email: 'a@b.com', event: 'welcome' }),
    ).rejects.toThrow(/422/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/email-resend.test.ts`
Expected: FAIL — `triggerEvent` is not a function.

- [ ] **Step 3a: Add the optional method to the interface** — replace the whole contents of `lib/email-providers/adapter.ts` with:

```typescript
export interface EmailProviderAdapter {
  readonly kind: 'none' | 'resend' | 'mailchimp';
  subscribe(input: {
    email: string;
    igUsername: string;
    flowName: string;
    language: 'tr' | 'en';
    audienceId?: string;
  }): Promise<{ id: string }>;
  // Optional: fire a provider event to start an automation. Only Resend
  // implements this today; other providers omit it and capture skips the call.
  triggerEvent?(input: {
    email: string;
    event: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
}
```

- [ ] **Step 3b: Implement it on ResendAdapter** — in `lib/email-providers/resend.ts`, add this method inside the `ResendAdapter` class, immediately after the `subscribe` method's closing brace (after line 20, before the class's closing `}`):

```typescript
  async triggerEvent(input: { email: string; event: string; payload?: Record<string, unknown> }): Promise<void> {
    const res = await fetch('https://api.resend.com/events/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ event: input.event, email: input.email, payload: input.payload ?? {} }),
    });
    if (!res.ok) throw new Error(`Resend events/send ${res.status}`);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/email-resend.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/email-providers/adapter.ts lib/email-providers/resend.ts tests/unit/email-resend.test.ts
git commit -m "feat(email): add Resend triggerEvent for events/send automation trigger"
```

---

## Task 4: captureEmail fires the automation event

**Files:**
- Modify: `lib/flow-engine/email-step.ts`
- Test: `tests/unit/email-step.test.ts`

- [ ] **Step 1: Write the failing test** — append these cases inside the existing `describe('captureEmail', ...)` block in `tests/unit/email-step.test.ts` (before its closing `});`):

```typescript
  it('fires the Resend automation event after a successful subscribe', async () => {
    const triggerEvent = vi.fn().mockResolvedValue(undefined);
    vi.mocked(makeProvider).mockResolvedValue({ subscribe: vi.fn().mockResolvedValue({ id: 'ext1' }), triggerEvent } as any);

    const result = await captureEmail({ ...baseArgs, resendEvent: 'welcome' });

    expect(result.status).toBe('confirmed');
    expect(triggerEvent).toHaveBeenCalledWith({
      email: 'person@example.com',
      event: 'welcome',
      payload: { igUsername: 'test_user', flowName: 'Lead flow' },
    });
  });

  it('does not fire an event when no resendEvent is configured', async () => {
    const triggerEvent = vi.fn();
    vi.mocked(makeProvider).mockResolvedValue({ subscribe: vi.fn().mockResolvedValue({ id: 'ext1' }), triggerEvent } as any);

    await captureEmail(baseArgs);

    expect(triggerEvent).not.toHaveBeenCalled();
  });

  it('keeps the capture confirmed even if the automation trigger fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const triggerEvent = vi.fn().mockRejectedValue(new Error('events/send 500'));
    vi.mocked(makeProvider).mockResolvedValue({ subscribe: vi.fn().mockResolvedValue({ id: 'ext1' }), triggerEvent } as any);

    const result = await captureEmail({ ...baseArgs, resendEvent: 'welcome' });

    expect(result).toEqual({ ok: true, status: 'confirmed', message: expect.stringContaining('Bonus sent') });
    const log = errorSpy.mock.calls.map(([, payload]) => String(payload)).join('\n');
    expect(log).toContain('events/send 500');
    errorSpy.mockRestore();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/email-step.test.ts`
Expected: FAIL — `triggerEvent` is never called (the new arg is ignored).

- [ ] **Step 3: Implement** — in `lib/flow-engine/email-step.ts`:

3a. Add `resendEvent` to the args type. Replace line 17 (`  providerConfig: ProviderConfig;`) with:

```typescript
  providerConfig: ProviderConfig;
  resendEvent?: string;
```

3b. Fire the event best-effort after the subscriber is marked confirmed. Replace lines 42-45 (the `if (sub) { ... } return { ok: true, ... };` block inside the `try`) with:

```typescript
    if (sub) {
      await db.from('email_subscribers').update({ status: 'confirmed', provider_id: ext.id }).eq('id', sub.id);
    }
    // The email is already captured (in the audience). Triggering the
    // automation is best-effort: a failure here must NOT mark the row failed
    // or re-prompt the user, so swallow + log it separately.
    if (args.resendEvent && typeof adapter.triggerEvent === 'function') {
      try {
        await adapter.triggerEvent({
          email: args.emailText.trim(),
          event: args.resendEvent,
          payload: { igUsername: args.igUsername ?? '', flowName: args.flowName },
        });
      } catch (err) {
        console.error('[email-step]', JSON.stringify({
          event: 'trigger_event_failed',
          subscriberId: sub?.id ?? null,
          resendEvent: args.resendEvent,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    }
    return { ok: true, status: 'confirmed', message: t.confirmation };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/email-step.test.ts`
Expected: PASS (all five cases, including the three pre-existing ones)

- [ ] **Step 5: Commit**

```bash
git add lib/flow-engine/email-step.ts tests/unit/email-step.test.ts
git commit -m "feat(email): fire Resend automation event on capture (best-effort)"
```

---

## Task 5: Machine renders editable disclaimer + labels

**Files:**
- Modify: `lib/flow-engine/machine.ts`
- Test: `tests/unit/machine.test.ts`

- [ ] **Step 1: Write the failing test** — append this describe block to the end of `tests/unit/machine.test.ts` (after the last `});`, at EOF):

```typescript
describe('advance collect_email', () => {
  function capturingButtons() {
    const calls: { text: string; buttons: { title: string; payload?: string }[] }[] = [];
    const fx: Effects = {
      sendText: async () => ({ message_id: 'm' }),
      sendButtons: async ({ text, buttons }) => { calls.push({ text, buttons }); return { message_id: 'm' }; },
      recordLink: async () => 'CODE',
      logSend: async () => {},
    };
    return { calls, fx };
  }

  it('renders the editable disclaimer and button labels and waits for a button', async () => {
    const { calls, fx } = capturingButtons();
    const emailSteps: FlowStep[] = [{
      id: 'e1', type: 'collect_email',
      disclaimer_message: 'Custom disclaimer', accept_label: 'Kabul Et', decline_label: 'Reddet',
    }];

    const result = await advance(ctx({ steps: emailSteps, currentStepId: 'e1', language: 'tr' }), { type: 'trigger' }, fx);

    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain('Custom disclaimer');
    expect(calls[0].buttons.map((b) => b.title)).toEqual(['Kabul Et', 'Reddet']);
    expect(calls[0].buttons.map((b) => b.payload)).toEqual(['EMAIL_AGREE_e1', 'EMAIL_DECLINE_e1']);
    expect(result.awaitingInputType).toBe('button');
    expect(result.nextStepId).toBe('e1');
  });

  it('falls back to localized defaults when the fields are absent', async () => {
    const { calls, fx } = capturingButtons();
    const emailSteps: FlowStep[] = [{ id: 'e1', type: 'collect_email' }];

    await advance(ctx({ steps: emailSteps, currentStepId: 'e1', language: 'tr' }), { type: 'trigger' }, fx);

    expect(calls[0].buttons.map((b) => b.title)).toEqual(['Kabul Et', 'Reddet']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/machine.test.ts`
Expected: FAIL — titles are the old hardcoded `'Kabul ediyorum'` / `'Hayır, sadece link'`, not `'Kabul Et'` / `'Reddet'`.

- [ ] **Step 3: Implement** — in `lib/flow-engine/machine.ts`:

3a. Replace the imports block on lines 3-5:

```typescript
import { EMAIL_CONSENT_TR } from '@/lib/consent/email-consent-text.tr';
import { EMAIL_CONSENT_EN } from '@/lib/consent/email-consent-text.en';
import { CURRENT_POLICY_VERSION } from '@/lib/consent/policy-versions';
```

with:

```typescript
import { resolveCollectEmailText } from '@/lib/consent/collect-email-step-text';
import { CURRENT_POLICY_VERSION } from '@/lib/consent/policy-versions';
```

3b. Delete the now-unused `consentText` helper on line 46:

```typescript
const consentText = (lang: Lang) => (lang === 'tr' ? EMAIL_CONSENT_TR : EMAIL_CONSENT_EN);
```

(remove that entire line).

3c. Replace the `collect_email` block (lines 154-168) with:

```typescript
    if (step.type === 'collect_email') {
      const ct = resolveCollectEmailText(step, ctx.language);
      const sent = await effects.sendButtons({
        token: ctx.pageAccessToken,
        igUserId: ctx.igUserId,
        // The consent disclaimer always carries the privacy/KVKK footer.
        text: appendPrivacyFooter(ct.disclaimer, ctx.language),
        buttons: [
          { type: 'postback', title: ct.accept, payload: `EMAIL_AGREE_${step.id}` },
          { type: 'postback', title: ct.decline, payload: `EMAIL_DECLINE_${step.id}` },
        ],
        commentId: consumeCommentId(),
      });
      await effects.logSend({ messageType: 'buttons', payload: { stage: 'email_consent', step: step.id, policy_version: CURRENT_POLICY_VERSION }, metaMessageId: sent.message_id });
      return { nextStepId: step.id, awaitingInputType: 'button', expiresAt };
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/machine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/flow-engine/machine.ts tests/unit/machine.test.ts
git commit -m "feat(flow): render editable disclaimer + button labels in collect_email"
```

---

## Task 6: Handler — request message, decline-ends, forward resend_event

**Files:**
- Modify: `app/api/webhooks/meta/handler.ts`
- Test: `tests/integration/webhook.test.ts`

- [ ] **Step 1a: Update the existing prompt assertion** — in `tests/integration/webhook.test.ts`, the test `'records email consent and waits for the next email text'` currently asserts the old prompt. Replace lines 264-267:

```typescript
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({
      igUserId: '8800000000000000',
      text: 'Please type your email address in this chat.',
    }));
```

with:

```typescript
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({
      igUserId: '8800000000000000',
      text: 'Please enter your email',
    }));
```

- [ ] **Step 1b: Add new tests** — append these three tests inside the `describe('POST /api/webhooks/meta', ...)` block in `tests/integration/webhook.test.ts` (before its closing `});` on line 649):

```typescript
  it('sends the custom request message after the user agrees', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1', current_flow_id: 'email-flow', current_step_id: 'email1',
      awaiting_input_type: 'button', context: {},
    } as any);
    dbState.flow = { id: 'email-flow', name: 'Lead flow', language: 'en', steps: [{ id: 'email1', type: 'collect_email', request_message: 'Drop your best email below' }] };
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{ id: '17841400000000000', time: 1748372160, messaging: [{
        sender: { id: '8800000000000000' }, recipient: { id: '17841400000000000' }, timestamp: 1748372160000,
        postback: { mid: 'MID-AGREE-CUSTOM', payload: 'EMAIL_AGREE_email1', title: 'Accept' },
      }] }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ text: 'Drop your best email below' }));
  });

  it('ends the flow with the goodbye message when the user declines', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1', current_flow_id: 'email-flow', current_step_id: 'email1',
      awaiting_input_type: 'button', context: {},
    } as any);
    // next_id is set so the OLD behavior would advance to s2; the new behavior must end instead.
    dbState.flow = { id: 'email-flow', name: 'Lead flow', language: 'en', steps: [
      { id: 'email1', type: 'collect_email', next_id: 's2' },
      { id: 's2', type: 'send_message', text: 'should not run' },
    ] };
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{ id: '17841400000000000', time: 1748372160, messaging: [{
        sender: { id: '8800000000000000' }, recipient: { id: '17841400000000000' }, timestamp: 1748372160000,
        postback: { mid: 'MID-DECLINE', payload: 'EMAIL_DECLINE_email1', title: 'Decline' },
      }] }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    const { sendText } = await import('@/lib/meta/client');
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('No problem') }));
    expect(sendText).not.toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('should not run') }));
    expect(saveConversationState).toHaveBeenCalledWith(expect.objectContaining({
      current_flow_id: null, current_step_id: null, awaiting_input_type: null,
    }));
  });

  it('forwards the configured Resend event to captureEmail', async () => {
    vi.mocked(loadConversationState).mockResolvedValue({
      contact_id: 'c1', current_flow_id: 'email-flow', current_step_id: 'email1',
      awaiting_input_type: 'email', context: { email: { stepId: 'email1', retries: 0 } },
    } as any);
    dbState.flow = { id: 'email-flow', name: 'Lead flow', language: 'en', steps: [{ id: 'email1', type: 'collect_email', resend_event: 'welcome' }] };
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{ id: '17841400000000000', time: 1748372160, messaging: [{
        sender: { id: '8800000000000000' }, recipient: { id: '17841400000000000' }, timestamp: 1748372160000,
        message: { mid: 'MID-EMAIL-WITH-EVENT', text: 'person@example.com' },
      }] }],
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    expect(captureEmail).toHaveBeenCalledWith(expect.objectContaining({ resendEvent: 'welcome' }));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/integration/webhook.test.ts`
Expected: FAIL — prompt is still the old text; decline still advances to `s2`; `captureEmail` is called without `resendEvent`.

- [ ] **Step 3: Implement** — in `app/api/webhooks/meta/handler.ts`:

3a. Replace the imports on lines 17-18:

```typescript
import { EMAIL_CONSENT_EN } from '@/lib/consent/email-consent-text.en';
import { EMAIL_CONSENT_TR } from '@/lib/consent/email-consent-text.tr';
```

with:

```typescript
import { resolveCollectEmailText } from '@/lib/consent/collect-email-step-text';
```

3b. Delete the now-unused `emailConsentText` helper (lines 149-151):

```typescript
function emailConsentText(lang: Lang) {
  return lang === 'tr' ? EMAIL_CONSENT_TR : EMAIL_CONSENT_EN;
}
```

(remove all three lines).

3c. In the Agree branch, replace the prompt text on line 241 (`      text: emailConsentText(language).prompt,`) with:

```typescript
      text: resolveCollectEmailText(step, language).request,
```

3d. Replace the entire Decline branch (lines 247-261) with a send-goodbye-then-end:

```typescript
  if (args.event.postback?.payload === `EMAIL_DECLINE_${step.id}`) {
    // Decline ends the flow: send the editable goodbye, then clear state.
    // (No advance to next_id — declining is a terminal choice.)
    await sendTextWithLog({
      token: args.token,
      igUserId: args.igUserId,
      igAccountId: args.account.id,
      contactId: args.contact.id,
      language,
      text: resolveCollectEmailText(step, language).declineGoodbye,
      appendFooter: false,
    });
    await saveFlowResult(args.contact.id, args.flow.id, completed());
    return true;
  }
```

3e. Forward `resend_event` to capture. In the `captureEmail({ ... })` call (lines 276-285), add a `resendEvent` field. Replace line 284 (`    providerConfig: providerConfigFrom(args.account.email_provider_config),`) with:

```typescript
    providerConfig: providerConfigFrom(args.account.email_provider_config),
    resendEvent: step.resend_event,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/integration/webhook.test.ts`
Expected: PASS (all webhook tests, including the updated prompt and three new cases)

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/meta/handler.ts tests/integration/webhook.test.ts
git commit -m "feat(webhook): editable request/decline messages; decline ends; forward resend_event"
```

---

## Task 7: listResendEvents server action

**Files:**
- Modify: `app/admin/(gated)/flows/actions.ts`
- Test: `tests/unit/list-resend-events.test.ts` (new), `tests/unit/action-auth.test.ts`

- [ ] **Step 1: Write the failing unit test** — create `tests/unit/list-resend-events.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  account: null as null | { email_provider_config: unknown },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

vi.mock('@/lib/auth/require-admin', () => ({
  isAdminRequest: vi.fn().mockResolvedValue(true),
  requireAdmin: vi.fn().mockResolvedValue(undefined),
  UNAUTHORIZED_MESSAGE: 'Unauthorized',
}));

vi.mock('@/lib/db/encryption', () => ({
  decryptSecret: vi.fn().mockResolvedValue('RESEND_KEY'),
}));

vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.account, error: null }),
        }),
      }),
    }),
  }),
}));

import { listResendEvents } from '@/app/admin/(gated)/flows/actions';

beforeEach(() => {
  vi.clearAllMocks();
  state.account = { email_provider_config: { kind: 'resend', api_key_enc: Buffer.from('enc').toString('base64'), audience_id: 'aud-1' } };
});

describe('listResendEvents', () => {
  it('returns event names from the Resend List Events API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ object: 'list', data: [
        { id: 'evt-1', name: 'welcome' },
        { id: 'evt-2', name: 'user.upgraded' },
      ] }),
    });
    global.fetch = fetchMock as any;

    const result = await listResendEvents('account-1');

    expect(result).toEqual({ ok: true, events: [
      { id: 'evt-1', name: 'welcome' },
      { id: 'evt-2', name: 'user.upgraded' },
    ] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/events');
    expect(init.headers.Authorization).toBe('Bearer RESEND_KEY');
  });

  it('returns an empty list when the account is not on Resend', async () => {
    state.account = { email_provider_config: { kind: 'none' } };
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    const result = await listResendEvents('account-1');

    expect(result).toEqual({ ok: true, events: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/list-resend-events.test.ts`
Expected: FAIL — `listResendEvents` is not exported.

- [ ] **Step 3: Implement** — in `app/admin/(gated)/flows/actions.ts`:

3a. Add `decryptSecret` to the imports. After line 6 (`import { isAdminRequest, requireAdmin, UNAUTHORIZED_MESSAGE } from '@/lib/auth/require-admin';`), add:

```typescript
import { decryptSecret } from '@/lib/db/encryption';
```

3b. Append this exported action at the end of the file:

```typescript
type ResendEvent = { id: string; name: string };
type ListEventsResult = { ok: true; events: ResendEvent[] } | { ok: false; error: string };

// Populates the admin "Resend automation event" dropdown. Reads the account's
// encrypted Resend key, then calls Resend's List Events API. Returns an empty
// list (not an error) when the account isn't configured for Resend.
export async function listResendEvents(accountId: string): Promise<ListEventsResult> {
  if (!(await isAdminRequest())) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  const db = serviceClient();
  const { data: account, error } = await db
    .from('ig_accounts')
    .select('email_provider_config')
    .eq('id', accountId)
    .maybeSingle();
  if (error) return { ok: false, error: `DB error: ${error.message}` };

  const cfg = account?.email_provider_config as { kind?: string; api_key_enc?: string } | null;
  if (!cfg || cfg.kind !== 'resend' || typeof cfg.api_key_enc !== 'string') {
    return { ok: true, events: [] };
  }

  try {
    const apiKey = await decryptSecret(new Uint8Array(Buffer.from(cfg.api_key_enc, 'base64')));
    const res = await fetch('https://api.resend.com/events', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    const json = await res.json();
    const events: ResendEvent[] = Array.isArray(json?.data)
      ? json.data.map((e: { id: unknown; name: unknown }) => ({ id: String(e.id), name: String(e.name) }))
      : [];
    return { ok: true, events };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/list-resend-events.test.ts`
Expected: PASS

- [ ] **Step 5: Add the auth-wiring case** — in `tests/unit/action-auth.test.ts`:

5a. Add `listResendEvents` to the flows import on line 58:

```typescript
import { createFlow, listResendEvents, saveFlowBuilderSteps, saveFlowSettings, saveFlowSteps, setFlowArchived } from '@/app/admin/(gated)/flows/actions';
```

5b. Add this test inside `describe('admin server actions reject unauthenticated callers', ...)` (before its closing `});` on line 135):

```typescript
  it('listResendEvents returns an error and never calls Resend', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await listResendEvents('account-1');
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/unauthorized/i) });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
```

- [ ] **Step 6: Run the auth test to verify it passes**

Run: `npm test -- tests/unit/action-auth.test.ts`
Expected: PASS (the new case plus all existing wiring cases)

- [ ] **Step 7: Commit**

```bash
git add app/admin/\(gated\)/flows/actions.ts tests/unit/list-resend-events.test.ts tests/unit/action-auth.test.ts
git commit -m "feat(admin): listResendEvents action to populate the automation dropdown"
```

---

## Task 8: Seed defaults when adding an email step

**Files:**
- Modify: `app/admin/(gated)/flows/[id]/flow-builder-model.ts:103-108`

- [ ] **Step 1: Implement** — replace `createEmailStep` (lines 103-108) with a version that seeds localized defaults:

```typescript
export function createEmailStep(index: number, language: 'tr' | 'en' = 'tr'): GuidedFlowStep {
  const d = collectEmailDefaults(language);
  return {
    id: `s${index}`,
    type: 'collect_email',
    disclaimer_message: d.disclaimer,
    accept_label: d.accept,
    decline_label: d.decline,
    request_message: d.request,
    decline_message: d.declineGoodbye,
  };
}
```

- [ ] **Step 2: Add the import** — at the top of `flow-builder-model.ts`, after line 1 (`import { FlowStepsSchema, type FlowStep } from '@/lib/flow-engine/schema';`), add:

```typescript
import { collectEmailDefaults } from '@/lib/consent/collect-email-step-text';
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`resend_event` is intentionally left unset on creation — the admin picks it from the dropdown.)

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(gated\)/flows/\[id\]/flow-builder-model.ts
git commit -m "feat(admin): seed localized defaults when adding a collect_email step"
```

---

## Task 9: Admin editing panel + event dropdown

**Files:**
- Modify: `app/admin/(gated)/flows/[id]/page.tsx`
- Modify: `app/admin/(gated)/flows/[id]/StepsEditor.tsx`

- [ ] **Step 1: Pass provider context from the page** — in `app/admin/(gated)/flows/[id]/page.tsx`:

1a. Widen the embedded select. Replace line 23 (`    .select('*, ig_accounts(name)')`) with:

```typescript
    .select('*, ig_accounts(name, email_provider_config)')
```

1b. Add a provider-kind reader next to `accountName` (after the `accountName` function, before `export default`):

```typescript
function accountProviderKind(value: unknown): string {
  const rel = Array.isArray(value) ? value[0] : value;
  const cfg = rel && typeof rel === 'object' ? (rel as { email_provider_config?: unknown }).email_provider_config : null;
  if (cfg && typeof cfg === 'object' && 'kind' in cfg) {
    const kind = (cfg as { kind?: unknown }).kind;
    return typeof kind === 'string' ? kind : 'none';
  }
  return 'none';
}
```

1c. Compute it next to `const account = ...` (after line 27):

```typescript
  const providerKind = accountProviderKind((flow as { ig_accounts?: unknown }).ig_accounts);
```

1d. Pass the new props to `StepsEditor`. Replace line 84 (`      <StepsEditor flowId={flow.id} initialSteps={(flow.steps ?? []) as any[]} />`) with:

```typescript
      <StepsEditor
        flowId={flow.id}
        initialSteps={(flow.steps ?? []) as any[]}
        language={(flow.language === 'en' ? 'en' : 'tr')}
        accountId={flow.ig_account_id}
        providerKind={providerKind}
      />
```

- [ ] **Step 2: Thread the props + render the panel** — in `app/admin/(gated)/flows/[id]/StepsEditor.tsx`:

2a. Add the import for defaults + the new server action. Replace the import block on lines 4-16 with:

```typescript
import { saveFlowBuilderSteps, saveFlowSteps, listResendEvents } from '../actions';
import { collectEmailDefaults } from '@/lib/consent/collect-email-step-text';
import { useEffect } from 'react';
import type { FlowStep } from '@/lib/flow-engine/schema';
import {
  createChoiceStep,
  createEmailStep,
  createEndStep,
  createLinkStep,
  createMessageStep,
  createPlainMessageStep,
  nextStepId,
  toGuidedSteps,
  type GuidedFlowStep,
} from './flow-builder-model';
```

(Note: `useState` is already imported on line 3 — keep that line as is.)

2b. Widen the component signature + thread props. Replace line 50 (`export function StepsEditor({ flowId, initialSteps }: { flowId: string; initialSteps: unknown[] }) {`) with:

```typescript
export function StepsEditor({
  flowId,
  initialSteps,
  language,
  accountId,
  providerKind,
}: {
  flowId: string;
  initialSteps: unknown[];
  language: 'tr' | 'en';
  accountId: string;
  providerKind: string;
}) {
```

2c. Seed defaults with the flow language when adding an email step. In `addStep`, replace line 77-78:

```typescript
                : kind === 'email'
                  ? createEmailStep(index)
```

with:

```typescript
                : kind === 'email'
                  ? createEmailStep(index, language)
```

2d. Replace the `collect_email` render (lines 258-260) with the new panel:

```typescript
                    {step.type === 'collect_email' && (
                      <EmailFields
                        step={step}
                        steps={steps}
                        index={index}
                        patchStep={patchStep}
                        setNext={setNext}
                        language={language}
                        accountId={accountId}
                        providerKind={providerKind}
                      />
                    )}
```

2e. Add the `EmailFields` component. Append it at the end of the file (after the `LinkFields` component, at EOF):

```typescript
function EmailFields({
  step,
  steps,
  index,
  patchStep,
  setNext,
  language,
  accountId,
  providerKind,
}: {
  step: EmailStep;
  steps: GuidedFlowStep[];
  index: number;
  patchStep: (index: number, patch: Partial<GuidedFlowStep>) => void;
  setNext: (index: number, nextId: string) => void;
  language: 'tr' | 'en';
  accountId: string;
  providerKind: string;
}) {
  const d = collectEmailDefaults(language);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (providerKind !== 'resend') return;
    let active = true;
    setLoadingEvents(true);
    setEventsError(null);
    listResendEvents(accountId)
      .then((r) => {
        if (!active) return;
        if (r.ok) setEvents(r.events);
        else setEventsError(r.error);
      })
      .catch((e) => { if (active) setEventsError((e as Error).message); })
      .finally(() => { if (active) setLoadingEvents(false); });
    return () => { active = false; };
  }, [accountId, providerKind]);

  const selectedKnown = !step.resend_event || events.some((e) => e.name === step.resend_event);

  return (
    <>
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Disclaimer / consent message</span>
        <textarea
          value={step.disclaimer_message ?? d.disclaimer}
          onChange={(e) => patchStep(index, { disclaimer_message: e.target.value })}
          className="min-h-24 border p-2"
        />
        <span className="text-xs text-gray-400">The privacy/KVKK footer is always appended below this automatically.</span>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Accept button</span>
          <input
            value={step.accept_label ?? d.accept}
            onChange={(e) => patchStep(index, { accept_label: e.target.value })}
            className="border px-2 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Decline button</span>
          <input
            value={step.decline_label ?? d.decline}
            onChange={(e) => patchStep(index, { decline_label: e.target.value })}
            className="border px-2 py-2"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Email request message (sent after Accept)</span>
        <input
          value={step.request_message ?? d.request}
          onChange={(e) => patchStep(index, { request_message: e.target.value })}
          className="border px-2 py-2"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-gray-500">Decline message (sent before the flow ends)</span>
        <input
          value={step.decline_message ?? d.declineGoodbye}
          onChange={(e) => patchStep(index, { decline_message: e.target.value })}
          className="border px-2 py-2"
        />
      </label>

      {providerKind === 'resend' && (
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-gray-500">Resend automation event</span>
          <select
            value={step.resend_event ?? ''}
            onChange={(e) => patchStep(index, { resend_event: e.target.value || undefined })}
            className="border px-2 py-2"
          >
            <option value="">No automation</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.name}>{ev.name}</option>
            ))}
            {!selectedKnown && step.resend_event && (
              <option value={step.resend_event}>{step.resend_event}</option>
            )}
          </select>
          {loadingEvents && <span className="text-xs text-gray-400">Loading events…</span>}
          {eventsError && <span className="text-xs text-red-600">Could not load events: {eventsError}</span>}
        </label>
      )}

      <NextSelector step={step} steps={steps} index={index} setNext={setNext} />
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`EmailStep` is already declared at line 21 as `Extract<FlowStep, { type: 'collect_email' }>` and now carries the new optional fields.)

- [ ] **Step 4: Build to confirm the client/server boundary is intact**

Run: `npm run build`
Expected: build succeeds. (`listResendEvents` is a server action imported into the client `StepsEditor` — same pattern as the existing `saveFlowBuilderSteps` import, so this is allowed.)

- [ ] **Step 5: Commit**

```bash
git add app/admin/\(gated\)/flows/\[id\]/page.tsx app/admin/\(gated\)/flows/\[id\]/StepsEditor.tsx
git commit -m "feat(admin): editable collect_email panel with Resend event dropdown"
```

---

## Task 10: Full verification

- [ ] **Step 1: Run the whole unit + integration suite**

Run: `npm test`
Expected: all test files pass (the suite was 33 files / 159 tests before this work; expect that plus the new `collect-email-step-text` and `list-resend-events` files and the added cases).

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Manual smoke checklist (record results, do not skip)**

Confirm by reading the diff / running the app:
1. Adding a "Collect email" step in the guided builder shows five pre-filled text fields (in the flow's language) and — when the account uses Resend — an "Resend automation event" dropdown.
2. Saving persists the fields into `flows.steps` (verify the Advanced JSON view shows them).
3. A flow whose account is not on Resend hides the dropdown.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test: verify editable collect_email flow end-to-end"
```

---

## Self-Review

**Spec coverage:**
- Editable disclaimer → Task 1 (field), Task 5 (render), Task 9 (UI). ✓
- Two fixed-function, editable-label buttons; no add/remove → Task 1 + Task 5 (labels resolved, payloads fixed); UI exposes only label inputs (Task 9). ✓
- Accept → editable request message → Task 1 + Task 6 (Agree branch) + Task 9. ✓
- Decline → editable goodbye, then ends → Task 6 (Decline branch rewritten to send goodbye + `completed()`). ✓
- Store email with GDPR timestamps → unchanged; `captureEmail` still writes `consent_at`/`consent_text_version` and `consent_log` (Task 4 leaves these intact). ✓
- Resend automation dropdown + trigger via API key → Task 3 (`triggerEvent`), Task 4 (fire on capture), Task 7 (`listResendEvents`), Task 9 (dropdown). ✓
- Privacy footer still auto-appended → Task 5 keeps `appendPrivacyFooter(ct.disclaimer, …)`. ✓
- Audience-then-event order → Task 4 fires the event only after `subscribe` (audience upsert) succeeds. ✓

**Placeholder scan:** No TBDs; every code step shows full code. ✓

**Type consistency:**
- `resolveCollectEmailText(step, lang)` / `collectEmailDefaults(lang)` returning `{ disclaimer, accept, decline, request, declineGoodbye }` — used identically in Tasks 2, 5, 6, 8, 9. ✓
- `triggerEvent({ email, event, payload? })` — defined in Task 3 interface, called with the same shape in Task 4. ✓
- `listResendEvents(accountId)` returns `{ ok: true; events: {id,name}[] } | { ok: false; error }` — consumed in Task 9 with `.ok`/`.events`. ✓
- Step field names (`disclaimer_message`, `accept_label`, `decline_label`, `request_message`, `decline_message`, `resend_event`) are spelled identically across schema, resolver, handler, builder, and UI. ✓

**Scope:** Single, self-contained plan — one feature, no unrelated refactors. ✓
