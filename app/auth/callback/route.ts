import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { userClient } from '@/lib/db/client';

function safeRedirectUrl(current: URL, next: string | null): URL {
  const fallback = new URL('/admin/accounts', current);
  if (!next) return fallback;

  try {
    const redirectTo = new URL(next, current);
    if (redirectTo.pathname.startsWith('/auth/')) return fallback;
    return redirectTo.origin === current.origin ? redirectTo : fallback;
  } catch {
    return fallback;
  }
}

function signInErrorUrl(current: URL): URL {
  const url = new URL('/admin/sign-in', current);
  url.searchParams.set('error', 'auth-callback');
  return url;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = url.searchParams.get('next');

  const supabase = await userClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    return NextResponse.redirect(error ? signInErrorUrl(url) : safeRedirectUrl(url, next));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(error ? signInErrorUrl(url) : safeRedirectUrl(url, next));
  }

  return NextResponse.redirect(signInErrorUrl(url));
}
