import { describe, expect, it } from 'vitest';
import { authCallbackUrl } from '@/app/admin/sign-in/auth-url';

describe('authCallbackUrl', () => {
  it('uses the canonical app URL when it is configured', () => {
    expect(authCallbackUrl('https://autoreply-gokhan-seckins-projects.vercel.app', 'https://autoreply-three.vercel.app')).toBe(
      'https://autoreply-three.vercel.app/auth/callback',
    );
  });

  it('falls back to the current origin for local development', () => {
    expect(authCallbackUrl('http://localhost:3000', '')).toBe('http://localhost:3000/auth/callback');
  });

  it('normalizes trailing slashes', () => {
    expect(authCallbackUrl('http://localhost:3000', 'https://autoreply-three.vercel.app/')).toBe(
      'https://autoreply-three.vercel.app/auth/callback',
    );
  });
});
