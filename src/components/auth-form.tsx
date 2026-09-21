'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/utils';
import { Notice } from './common';
import { Button } from './ui/button';
export function AuthForm({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const { register, handleSubmit } = useForm<{
    name: string;
    email: string;
    password: string;
    confirm: string;
  }>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="stack"
      onSubmit={handleSubmit(async (values) => {
        setBusy(true);
        setError('');
        try {
          const data = await api('/api/auth', { mode, ...values });
          if (data.message) setMessage(data.message);
          else {
            router.push('/admin/events');
            router.refresh();
          }
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      })}
    >
      <div>
        <span className="eyebrow">MULAI CERITA BARU</span>
        <h2 style={{ marginTop: 10 }}>
          {mode === 'register'
            ? 'Kenalan dulu, yuk.'
            : mode === 'login'
              ? 'Selamat datang kembali.'
              : mode === 'forgot'
                ? 'Lupa password?'
                : 'Password baru'}
        </h2>
        <p style={{ fontSize: 13, marginTop: 10 }}>Satu akun untuk semua rencana serumu.</p>
      </div>
      {mode === 'register' && (
        <label className="field">
          Nama lengkap
          <input autoComplete="name" required {...register('name')} />
        </label>
      )}
      {mode !== 'reset' && (
        <label className="field">
          Email
          <input type="email" autoComplete="email" required {...register('email')} />
        </label>
      )}
      {mode !== 'forgot' && (
        <label className="field">
          Password
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
            {...register('password')}
          />
        </label>
      )}
      {(mode === 'register' || mode === 'reset') && (
        <label className="field">
          Konfirmasi password
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            {...register('confirm')}
          />
        </label>
      )}
      <Notice error>{error}</Notice>
      <Notice>{message}</Notice>
      <Button disabled={busy}>
        {busy
          ? 'Sebentar…'
          : mode === 'register'
            ? 'Buat akun'
            : mode === 'login'
              ? 'Masuk'
              : mode === 'forgot'
                ? 'Kirim link reset'
                : 'Simpan password'}
      </Button>
      <div className="row between">
        <Link className="text-link" href={mode === 'login' ? '/register' : '/login'}>
          {mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
        </Link>
        {mode === 'login' && <Link href="/forgot-password">Lupa password?</Link>}
      </div>
    </form>
  );
}
