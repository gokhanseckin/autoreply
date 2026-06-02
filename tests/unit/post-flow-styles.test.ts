import { describe, expect, it } from 'vitest';
import { pickerPanelClassName, pickerSummaryButtonClassName } from '@/app/admin/(gated)/posts/post-flow-styles';

describe('post flow picker styles', () => {
  it('uses explicit readable colors for the idle status button in dark mode', () => {
    const className = pickerSummaryButtonClassName(false);

    expect(className).toContain('text-neutral-700');
    expect(className).toContain('dark:text-neutral-200');
    expect(className).toContain('dark:bg-neutral-900');
  });

  it('uses explicit readable colors for attached flow status buttons in dark mode', () => {
    const className = pickerSummaryButtonClassName(true);

    expect(className).toContain('text-emerald-800');
    expect(className).toContain('dark:text-emerald-200');
    expect(className).toContain('dark:bg-emerald-950');
  });

  it('keeps the dropdown panel readable in dark mode', () => {
    expect(pickerPanelClassName).toContain('dark:bg-neutral-950');
    expect(pickerPanelClassName).toContain('dark:text-neutral-100');
  });
});
