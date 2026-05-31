import { describe, it, expect } from 'vitest';
import { matchTriggerKeyword } from '@/lib/flow-engine/routing';

describe('matchTriggerKeyword', () => {
  it('finds keyword as whole-word substring (case-insensitive)', () => {
    expect(matchTriggerKeyword('I want the FREE course', ['free', 'course'])).toBe('free');
  });
  it('returns null when no match', () => {
    expect(matchTriggerKeyword('hello world', ['free'])).toBeNull();
  });
});
