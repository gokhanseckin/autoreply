import { describe, expect, it } from 'vitest';
import { signInButtonClassName, signInInputClassName } from '@/app/admin/sign-in/sign-in-styles';

describe('sign-in styles', () => {
  it('makes the magic-link button readable in dark mode', () => {
    expect(signInButtonClassName).toContain('bg-neutral-900');
    expect(signInButtonClassName).toContain('text-white');
    expect(signInButtonClassName).toContain('dark:bg-neutral-100');
    expect(signInButtonClassName).toContain('dark:text-neutral-950');
  });

  it('keeps the email input readable in dark mode', () => {
    expect(signInInputClassName).toContain('bg-white');
    expect(signInInputClassName).toContain('text-neutral-900');
    expect(signInInputClassName).toContain('dark:bg-neutral-950');
    expect(signInInputClassName).toContain('dark:text-neutral-100');
  });
});
