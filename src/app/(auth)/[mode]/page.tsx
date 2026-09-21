import { notFound } from 'next/navigation';
import { Trees } from 'lucide-react';
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
        <aside className="stack">
          <span className="eyebrow">GOOD COMPANY, GREAT MEMORIES</span>
          <h1>Momen seru dimulai dari rencana kecil.</h1>
          <div className="hero-art">
            <Trees size={120} strokeWidth={1} />
            <span className="hero-sticker sticker-two">Sampai ketemu di makrab ✨</span>
          </div>
        </aside>
        <section className="card auth-card">
          {configured() ? (
            <AuthForm mode={modes[mode as keyof typeof modes]} />
          ) : (
            <Notice error>
              Supabase belum dikonfigurasi. Lengkapi .env.local mengikuti README untuk mulai
              menggunakan aplikasi.
            </Notice>
          )}
        </section>
      </main>
    </>
  );
}
