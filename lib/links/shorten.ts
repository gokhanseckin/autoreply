import { nanoid } from 'nanoid';

export function generateLinkCode(): string {
  return nanoid(10);
}
