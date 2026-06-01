'use client';
import { type FormEvent, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { authCallbackUrl } from './auth-url';
import { signInButtonClassName, signInInputClassName } from './sign-in-styles';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    setSending(true);
    setError('');

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: authCallbackUrl(location.origin) },
      });

      if (error) {
        setError(error.message || 'Could not send the magic link. Check the email and try again.');
        return;
      }

      setSent(true);
    } catch {
      setError('Could not send the magic link. Check the email and try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {sent ? (
        <p className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Check your inbox for the magic link.
        </p>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Email</span>
            <input
              className={signInInputClassName}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          {error && (
            <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          )}
          <button className={signInButtonClassName} disabled={sending} type="submit">
            {sending ? 'Sending...' : 'Send magic link'}
          </button>
        </form>
      )}
    </main>
  );
}
