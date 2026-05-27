import { describe, it, expect } from 'vitest';
import { matchesErasureKeyword } from '@/lib/flow-engine/reserved-keywords';

describe('matchesErasureKeyword', () => {
  it.each(['DELETE', 'sil', 'Stop', 'unsubscribe', 'KALDIR'])(
    'matches %s case-insensitively',
    (s) => { expect(matchesErasureKeyword(s)).toBe(true); }
  );

  it.each(['hello', 'free course', 'stops here'])('does not match %s', (s) => {
    expect(matchesErasureKeyword(s)).toBe(false);
  });
});
