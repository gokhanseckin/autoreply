import type { EmailProviderAdapter } from './adapter';
export class NoneAdapter implements EmailProviderAdapter {
  readonly kind = 'none' as const;
  async subscribe(): Promise<{ id: string }> { return { id: 'none' }; }
}
