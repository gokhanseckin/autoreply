import { redirect } from 'next/navigation';
import { userClient } from '@/lib/db/client';

export default async function GatedAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await userClient();
  const { data: { user } } = await supabase.auth.getUser();
  const allowlist = (process.env.ADMIN_ALLOWLIST ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!user || !allowlist.includes(user.email ?? '')) redirect('/admin/sign-in');
  return (
    <div className="min-h-screen">
      <nav className="border-b p-3 flex gap-4 text-sm">
        <a href="/admin/accounts">Accounts</a>
        <a href="/admin/posts">Posts</a>
        <a href="/admin/flows">Flows</a>
        <a href="/admin/contacts">Contacts</a>
        <a href="/admin/stats">Stats</a>
        <span className="ml-auto text-gray-500">{user.email}</span>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
