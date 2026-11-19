import { describe, expect, it } from 'vitest';
import { choosePublicReply, parsePublicReplyForm, readPublicReplyOptions } from '@/lib/flow-engine/public-replies';

describe('public comment replies', () => {
  it('prefills one editable reply at 100% for an existing flow', () => {
    expect(readPublicReplyOptions(undefined)).toEqual([{ text: 'Teşekkürler. Mesaj gönderildi', probability: 100 }]);
    const form = new FormData();
    form.append('public_reply_text', 'Edited reply');
    expect(parsePublicReplyForm(form)).toEqual({ ok: true, options: [{ text: 'Edited reply', probability: 100 }] });
  });

  it.each([
    [0, 'First'],
    [0.2899, 'First'],
    [0.29, 'Last'],
    [1 - Number.EPSILON, 'Last'],
  ])('draws at each boundary and skips zero-weight options (%s)', (draw, expected) => {
    const options = [
      { text: 'Zero before', probability: 0 },
      { text: 'First', probability: 29 },
      { text: 'Zero between', probability: 0 },
      { text: 'Last', probability: 71 },
      { text: 'Zero after', probability: 0 },
    ];
    expect(choosePublicReply(options, () => draw)).toBe(expected);
    expect(choosePublicReply([{ text: 'Only', probability: 100 }], () => draw)).toBe('Only');
  });
});
