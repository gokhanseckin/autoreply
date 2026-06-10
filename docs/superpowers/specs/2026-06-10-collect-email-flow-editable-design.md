# Editable Collect Email Flow — Design

**Date:** 2026-06-10
**Status:** Approved design, pending implementation plan

## Problem

The `collect_email` flow is rigid. The consent/disclaimer message, the two
button labels, and the email-request prompt are all hardcoded in
`lib/consent/email-consent-text.{tr,en}.ts`. Admins cannot tailor wording per
flow. Declining currently advances to the next step rather than ending. Email
capture adds the contact to a Resend Audience but does not trigger any Resend
Automation.

This redesign makes the flow's text admin-editable per flow, makes Decline end
the flow, and triggers a selected Resend Automation (via its custom event) on
capture.

## Goals

1. Disclaimer/consent message is editable by the admin in the dashboard.
2. Exactly two options — **Accept** and **Decline** (default labels "Kabul Et" /
   "Reddet"). Functions are fixed; labels are editable. No adding/removing
   options.
3. On **Accept**, send an editable "request message" (default
   "Lütfen email adresinizi girin" / "Please enter your email").
4. On **Decline**, send an editable goodbye message, then **end the flow**.
5. Store the captured email with GDPR timestamps (already in place — retained).
6. The step has a **Resend event** dropdown so capture triggers the chosen
   Resend Automation, using the account's Resend API key.

## Non-Goals

- Adding more than two options, or making the buttons' functions configurable.
- Per-flow Resend API key or per-flow audience (audience stays account-level).
- Changing the Mailchimp / `none` provider behavior (only Resend gains event
  triggering; others no-op).

## Key External Fact — Resend Automations

Resend Automations (launched 2026-04) are **event-driven**. You do not "start an
automation by id"; you fire a named **custom event** identifying the contact by
email (or contact_id), with an optional payload. Every enabled automation whose
trigger matches that event name runs.

- List custom events: Resend **List Events API** → used to populate the dropdown.
- Fire an event: Resend **Send Event API** (identify by `email`, optional
  `payload`). *(Exact endpoint path to be pinned during implementation.)*
- `resend.automations.list()` returns `{id, name, status}` — not used for the
  dropdown; we select the **event** the admin's automation listens on.

**Decision:** the dropdown lists **custom events**; the admin selects the event
name that starts their desired automation. On capture we POST that event.

## Architecture Decision — Config Location

Per-flow editable config lives **inside the `collect_email` step object** in
`flows.steps` (jsonb). The Resend API key (encrypted) and `audience_id` stay at
the account level in `ig_accounts.email_provider_config` (already there).

Rejected alternatives: flow-level columns (assumes one collect_email step per
flow; splits config across two places); account-level text (cannot vary per
flow).

## Data Model

`CollectEmailStep` in `lib/flow-engine/schema.ts` expands. All new fields are
**optional** so existing flows keep validating; defaults are applied at
render/runtime from `flow.language`.

```
collect_email {
  id: string
  type: 'collect_email'
  next_id?: string
  disclaimer_message?: string   // consent body; privacy footer auto-appended below
  accept_label?: string         // default "Kabul Et" / "Accept"
  decline_label?: string        // default "Reddet" / "Decline"
  request_message?: string      // default "Lütfen email adresinizi girin" / "Please enter your email"
  decline_message?: string      // editable goodbye sent on Decline, then flow ends
  resend_event?: string         // selected Resend custom-event name
}
```

- **No DB migration** — all jsonb.
- Button payloads unchanged: `EMAIL_AGREE_{id}` / `EMAIL_DECLINE_{id}`.
- `email_subscribers` (`consent_at`, `consent_text_version`, `status`) and
  `consent_log` unchanged — GDPR capture is already correct.

Localized defaults (a shared helper keyed by `flow.language`):

| Field            | tr                                   | en                          |
|------------------|--------------------------------------|-----------------------------|
| disclaimer       | (existing `EMAIL_CONSENT_TR.body`)   | (existing `EMAIL_CONSENT_EN.body`) |
| accept_label     | Kabul Et                             | Accept                      |
| decline_label    | Reddet                               | Decline                     |
| request_message  | Lütfen email adresinizi girin        | Please enter your email     |
| decline_message  | Tamam, sorun değil.                  | No problem.                 |

## Flow Execution (webhook)

### Consent prompt — `lib/flow-engine/machine.ts`
Send the button template with body = `step.disclaimer_message` (or localized
default). The standard privacy/KVKK footer is **still auto-appended**
(`appendPrivacyFooter`). Button titles = `step.accept_label` / `step.decline_label`
(or defaults). Payloads unchanged. Awaiting state = `button`.

### Accept — `app/api/webhooks/meta/handler.ts` (`maybeHandleEmailStep`)
On `EMAIL_AGREE_{id}`: insert `consent_log` row (unchanged), set
`awaiting_input_type: 'email'` with `context.email = { stepId, retries: 0 }`,
then send `step.request_message` (or default).

### Decline — behavior change
On `EMAIL_DECLINE_{id}`: send `step.decline_message` (or default), then **end the
flow** — clear conversation state. Do **not** call `advanceFromNext`.

### Email text received — `lib/flow-engine/email-step.ts` (`captureEmail`)
1. Validate with existing regex; on failure return `invalidEmail` (retry).
2. Insert `email_subscribers` row: `consent_at`, `consent_text_version`,
   `source_flow_id`, `status: 'pending'` (unchanged).
3. **Resend path (when provider is `resend`):**
   a. Upsert email into the account's Resend Audience (existing `subscribe`).
   b. **Fire the selected custom event** `step.resend_event` via the Send Event
      API, identifying the contact by email, payload `{ igUsername, flowName }`.
      If `resend_event` is empty, skip step (b).
   c. Update `status: 'confirmed'` + store `provider_id`. On provider error,
      log, set `status: 'failed'`, return friendly fallback message.
4. **Mailchimp / none:** unchanged (`subscribe` or no-op); event trigger is a
   no-op.
5. Send confirmation message. After capture, advance to `next_id` as today (end
   if none).

The provider adapter interface (`lib/email-providers/adapter.ts`) gains an
optional `triggerEvent({ email, event, payload })`. `ResendAdapter` implements it
(Send Event API); `MailchimpAdapter` / `NoneAdapter` no-op.

## Admin UI + Resend Wiring

### StepsEditor — `app/admin/(gated)/flows/[id]/StepsEditor.tsx`
The `collect_email` step renders an editable panel:
- Textarea: disclaimer message
- Inputs: accept label, decline label
- Inputs/textarea: request message, decline message
- Select: **Resend event** (shown only when account provider is `resend`)

All text fields pre-filled with the language defaults. The values save into the
step jsonb via the existing flow-save server actions (already `requireAdmin()`
guarded — no auth change).

### Resend event dropdown data — new admin-gated server action
`listResendEvents(accountId)`:
- `requireAdmin()`.
- Load account, decrypt Resend API key.
- Call Resend **List Events API**; return event names.
- Empty/disabled with a hint when no key or no events; control hidden when the
  account provider is not `resend`.

### createEmailStep — `app/admin/(gated)/flows/[id]/flow-builder-model.ts`
Seed the five text defaults from `flow.language` when the step is created (so the
admin sees editable pre-filled values rather than blanks).

## Assumptions

- **Audience is account-level** (one audience per account); only the *event* is
  per-flow. To confirm during review if a per-flow audience is later wanted.
- After successful capture the flow advances to `next_id` (unchanged); only
  Decline ends the flow.
- The exact Resend Send Event endpoint path is pinned during implementation
  against current Resend docs.

## Testing

- **schema.test** — `CollectEmailStep` accepts new optional fields; existing
  minimal steps still validate.
- **email-step.test** — capture inserts subscriber, upserts audience, fires the
  selected event with email + payload; empty `resend_event` skips the event;
  provider error sets `status: 'failed'`; mailchimp/none do not fire events.
- **handler/machine tests** — Accept sends `request_message` and awaits email;
  Decline sends `decline_message` and clears state (does not advance); buttons
  render with custom labels + appended footer.
- **listResendEvents** — admin-gated; returns event names; handles missing key.

## Files Touched (anticipated)

- `lib/flow-engine/schema.ts` — expand `CollectEmailStep`.
- `lib/flow-engine/machine.ts` — use editable disclaimer + labels.
- `lib/flow-engine/email-step.ts` — fire event after audience upsert.
- `app/api/webhooks/meta/handler.ts` — request/decline messages, Decline ends.
- `lib/email-providers/adapter.ts` + `resend.ts` (+ mailchimp/none no-ops) —
  `triggerEvent`.
- `lib/consent/` — shared localized defaults helper for the five fields.
- `app/admin/(gated)/flows/[id]/StepsEditor.tsx` — editable panel + dropdown.
- `app/admin/(gated)/flows/[id]/flow-builder-model.ts` — seed defaults.
- New server action `listResendEvents` (admin-gated).
