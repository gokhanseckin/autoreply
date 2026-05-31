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
      <span className="text-gray-600">Account</span>
      <select
        defaultValue={current}
        className="border rounded px-2 py-1"
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
