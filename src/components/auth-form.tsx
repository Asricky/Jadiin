'use client';
import { Input } from './ui/input';
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
        <h2 style={{ marginTop: 10 }}>
          {mode === 'register'
            ? 'Buat akun organizer'
            : mode === 'login'
              ? 'Masuk ke workspace'
              : mode === 'forgot'
                ? 'Lupa password?'
                : 'Password baru'}
        </h2>
        <p style={{ fontSize: 13, marginTop: 10 }}>
          Kelola acara dan jawaban peserta dari satu tempat.
        </p>
      </div>
      {mode === 'register' && (
        <label className="field">
          Nama lengkap
          <Input autoComplete="name" required {...register('name')} />
        </label>
      )}
      {mode !== 'reset' && (
        <label className="field">
          Email
          <Input type="email" autoComplete="email" required {...register('email')} />
        </label>
      )}
      {mode !== 'forgot' && (
        <label className="field">
          Password
          <Input
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
          <Input
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
