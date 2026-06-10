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
