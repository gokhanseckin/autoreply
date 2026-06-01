'use client';
import { useRouter } from 'next/navigation';

export function AccountSwitcher({
  accounts,
  current,
}: {
  accounts: { id: string; name: string }[];
  current: string | undefined;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-neutral-600 dark:text-neutral-400">Account</span>
      <select
        defaultValue={current}
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        onChange={e => router.push(`/admin/posts?account=${e.target.value}`)}
      >
        {accounts.map(a => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
