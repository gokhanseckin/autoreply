import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';
  process.env.META_APP_SECRET ??= 'test-app-secret';
  process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString('base64');
  process.env.IP_HASH_SALT ??= '$2b$10$abcdefghijklmnopqrstuv';
});

afterAll(() => {});
