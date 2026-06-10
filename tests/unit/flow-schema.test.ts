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

  it('rejects non-http(s) destination_url schemes with a friendly message', () => {
    const step = (url: string) => [{ id: 's1', type: 'send_link', text: 'Link', label: 'Go', destination_url: url }];
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox', 'file:///etc/passwd']) {
      const result = FlowStepsSchema.safeParse(step(url));
      expect(result.success, `should reject ${url}`).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('http');
      }
    }
    expect(FlowStepsSchema.safeParse(step('https://example.com/x')).success).toBe(true);
    expect(FlowStepsSchema.safeParse(step('http://example.com/x')).success).toBe(true);
  });

  it('rejects non-http(s) url button actions', () => {
    const steps = (url: string) => [{
      id: 's1',
      type: 'send_message',
      text: 'Pick one',
      buttons: [{ label: 'Open', action: { type: 'url', url } }],
    }];
    expect(FlowStepsSchema.safeParse(steps('javascript:alert(1)')).success).toBe(false);
    expect(FlowStepsSchema.safeParse(steps('https://example.com')).success).toBe(true);
  });

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
    const parsed = FlowStepsSchema.parse(step);
    const emailStep = parsed[0];
    if (emailStep.type !== 'collect_email') throw new Error('unexpected type');
    expect(emailStep.resend_event).toBe('welcome');
  });
});
