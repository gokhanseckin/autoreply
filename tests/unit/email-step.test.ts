import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureEmail } from '@/lib/flow-engine/email-step';
import { makeProvider } from '@/lib/email-providers/factory';

const dbCalls = vi.hoisted(() => ({
  updates: [] as { table: string; values: unknown }[],
}));

vi.mock('@/lib/db/client', () => ({
  serviceClient: () => ({
    from: (table: string) => ({
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: 'sub1' }, error: null }),
        }),
      }),
      update: (values: unknown) => {
        dbCalls.updates.push({ table, values });
        return { eq: async () => ({ data: null, error: null }) };
      },
    }),
  }),
}));

vi.mock('@/lib/email-providers/factory', () => ({
  makeProvider: vi.fn(),
}));

const baseArgs = {
  igAccountId: 'a1',
  contactId: 'c1',
  igUsername: 'test_user',
  flowId: 'f1',
  flowName: 'Lead flow',
  language: 'en' as const,
  emailText: 'person@example.com',
  providerConfig: { kind: 'resend', api_key_enc: 'enc', audience_id: 'aud' } as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  dbCalls.updates = [];
});

describe('captureEmail', () => {
  it('returns confirmed on provider success and marks the row confirmed', async () => {
    vi.mocked(makeProvider).mockResolvedValue({ subscribe: vi.fn().mockResolvedValue({ id: 'ext1' }) } as any);

    const result = await captureEmail(baseArgs);

    expect(result).toEqual({ ok: true, status: 'confirmed', message: expect.stringContaining('Bonus sent') });
    expect(dbCalls.updates).toContainEqual({
      table: 'email_subscribers',
      values: expect.objectContaining({ status: 'confirmed', provider_id: 'ext1' }),
    });
  });

  it('rejects an invalid email without touching the provider', async () => {
    const result = await captureEmail({ ...baseArgs, emailText: 'not-an-email' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('pending');
    expect(makeProvider).not.toHaveBeenCalled();
  });

  it('surfaces a provider failure as status failed, logs it, and marks the row failed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(makeProvider).mockResolvedValue({ subscribe: vi.fn().mockRejectedValue(new Error('resend 500')) } as any);

    const result = await captureEmail(baseArgs);

    // Not ok (the email was NOT recorded at the provider), but distinct from
    // an invalid email so the handler does not re-prompt the user.
    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    // The user still gets the friendly fallback message.
    expect(result.message).toBe("Thanks — we'll be in touch.");
    const log = errorSpy.mock.calls.map(([, payload]) => String(payload)).join('\n');
    expect(log).toContain('resend 500');
    expect(dbCalls.updates).toContainEqual({
      table: 'email_subscribers',
      values: expect.objectContaining({ status: 'failed' }),
    });
    errorSpy.mockRestore();
  });

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
    expect(dbCalls.updates).toContainEqual({
      table: 'email_subscribers',
      values: expect.objectContaining({ status: 'confirmed', provider_id: 'ext1' }),
    });
    const log = errorSpy.mock.calls.map(([, payload]) => String(payload)).join('\n');
    expect(log).toContain('events/send 500');
    errorSpy.mockRestore();
  });
});
