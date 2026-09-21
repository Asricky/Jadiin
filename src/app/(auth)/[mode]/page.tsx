import { notFound } from 'next/navigation';
import { Brand, Notice } from '@/components/common';
import { AuthForm } from '@/components/auth-form';
import { configured } from '@/lib/supabase/server';
export default async function AuthPage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  const modes = {
    login: 'login',
    register: 'register',
    'forgot-password': 'forgot',
    'reset-password': 'reset',
  } as const;
  if (!(mode in modes)) notFound();
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Brand />
        </div>
      </header>
      <main className="container auth-shell">
        <section className="card auth-card">
          {configured() ? (
            <AuthForm mode={modes[mode as keyof typeof modes]} />
          ) : (
            <Notice error>
              Aplikasi sedang disiapkan. Pendaftaran dan login akan tersedia setelah
              konfigurasi layanan selesai.
            </Notice>
          )}
        </section>
      </main>
    </>
  );
}
