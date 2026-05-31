const ERASURE = new Set(['delete', 'sil', 'stop', 'unsubscribe', 'kaldir']);

export function matchesErasureKeyword(text: string): boolean {
  return ERASURE.has(text.trim().toLowerCase());
}
