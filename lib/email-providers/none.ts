import type { EmailProviderAdapter } from './adapter';
export class NoneAdapter implements EmailProviderAdapter {
  readonly kind = 'none' as const;
  async subscribe(_input?: { email: string; igUsername: string; flowName: string; language: 'tr' | 'en'; audienceId?: string }): Promise<{ id: string }> { return { id: 'none' }; }
}
