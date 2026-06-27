'use server';

import { redirect } from 'next/navigation';
import { userClient } from '@/lib/db/client';

export async function signOutAdmin() {
  const supabase = await userClient();
  await supabase.auth.signOut();
  redirect('/admin/sign-in');
}
