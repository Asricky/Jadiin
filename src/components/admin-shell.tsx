'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { api } from '@/lib/utils';
export function Logout() {
  const router = useRouter();
  const [error, setError] = useState('');
  return (
    <>
      <button
        className="button button-ghost button-icon"
        aria-label="Keluar"
        onClick={async () => {
          try {
            await api('/api/auth', { mode: 'logout' });
            router.push('/login');
            router.refresh();
          } catch {
            setError('Gagal keluar');
          }
        }}
      >
        <LogOut size={18} />
      </button>
      {error && <small role="alert">{error}</small>}
    </>
  );
}
