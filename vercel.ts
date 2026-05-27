import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'npm run build',
  functions: {
    'app/api/webhooks/meta/route.ts': { maxDuration: 10 },
    'app/r/[code]/route.ts': { maxDuration: 5 },
  },
};
