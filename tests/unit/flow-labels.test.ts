import { describe, it, expect } from 'vitest';
import { languageLabel, triggerLabel } from '@/app/admin/(gated)/flows/flow-labels';

describe('languageLabel', () => {
  it('maps stored codes to readable names', () => {
    expect(languageLabel('tr')).toBe('Turkish');
    expect(languageLabel('en')).toBe('English');
  });
  it('falls back to the raw code for unknown values', () => {
    expect(languageLabel('de')).toBe('de');
  });
});

describe('triggerLabel', () => {
  it('maps trigger types to readable names', () => {
    expect(triggerLabel('comment')).toBe('Post comment');
    expect(triggerLabel('dm')).toBe('DM keyword');
    expect(triggerLabel('story_reply')).toBe('Story reply / comment');
  });
  it('falls back to the raw code for unknown values', () => {
    expect(triggerLabel('weird')).toBe('weird');
  });
});
