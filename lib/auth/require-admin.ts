import { userClient } from '@/lib/db/client';

export const UNAUTHORIZED_MESSAGE = 'Unauthorized: sign in with an admin account.';

export class UnauthorizedError extends Error {
  constructor() {
    super(UNAUTHORIZED_MESSAGE);
    this.name = 'UnauthorizedError';
  }
}

export function adminAllowlist(): string[] {
  return (process.env.ADMIN_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Server actions are directly invokable POST endpoints; the gated layout only
// protects page rendering. Every mutating action must call one of these.
export async function isAdminRequest(): Promise<boolean> {
  const supabase = await userClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  return adminAllowlist().includes(user.email);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminRequest())) throw new UnauthorizedError();
}
