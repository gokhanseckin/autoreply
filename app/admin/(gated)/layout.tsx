import { redirect } from 'next/navigation';
import { userClient } from '@/lib/db/client';
import { adminAllowlist } from '@/lib/auth/require-admin';
import { signOutAdmin } from './auth-actions';

export default async function GatedAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await userClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !adminAllowlist().includes(user.email ?? '')) redirect('/admin/sign-in');
  return (
    <div className="admin-shell min-h-screen">
      <nav className="border-b p-3 flex gap-4 text-sm">
        <a href="/admin/accounts">Accounts</a>
        <a href="/admin/posts">Posts</a>
        <a href="/admin/flows">Flows</a>
        <a href="/admin/contacts">Contacts</a>
        <a href="/admin/stats">Stats</a>
        <details className="group relative ml-auto">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded px-2 py-1 text-gray-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-100">
            <span>{user.email}</span>
            <span aria-hidden="true" className="text-[10px] transition group-open:rotate-180">v</span>
          </summary>
          <div className="absolute right-0 top-full z-10 mt-2 min-w-full rounded border bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <form action={signOutAdmin}>
              <button
                type="submit"
                className="w-full whitespace-nowrap rounded px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                Log out
              </button>
            </form>
          </div>
        </details>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
