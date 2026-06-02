import { describe, expect, it } from 'vitest';
import { isPostAttachableFlow } from '@/app/admin/(gated)/posts/flow-candidates';

describe('isPostAttachableFlow', () => {
  it('allows only active comment flows in the post picker', () => {
    expect(isPostAttachableFlow({ trigger_type: 'comment', archived: false })).toBe(true);
    expect(isPostAttachableFlow({ trigger_type: 'dm', archived: false })).toBe(false);
    expect(isPostAttachableFlow({ trigger_type: 'story_reply', archived: false })).toBe(false);
    expect(isPostAttachableFlow({ trigger_type: 'comment', archived: true })).toBe(false);
  });
});
