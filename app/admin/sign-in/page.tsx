'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  async function send() {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    if (!error) setSent(true);
  }
  return (
    <main className="max-w-sm mx-auto p-8 space-y-3">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {sent ? <p>Check your inbox.</p> : (
        <>
          <input className="w-full border p-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button className="bg-black text-white px-3 py-2" onClick={send}>Send magic link</button>
        </>
      )}
    </main>
  );
}
