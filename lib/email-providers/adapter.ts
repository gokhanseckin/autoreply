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
