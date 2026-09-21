import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/server';
import { sameOrigin, errorResponse, rate, HttpError } from '@/lib/server';
const schema = z.object({
  mode: z.enum(['login', 'register', 'forgot', 'reset', 'logout']),
  email: z.email().optional(),
  password: z.string().min(8).max(128).optional(),
  confirm: z.string().optional(),
  name: z.string().trim().min(2).max(80).optional(),
});
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await rate(req, 'auth', 15);
    const b = schema.parse(await req.json());
    const db = await supabase();
    let message = '';
    if (b.mode === 'logout') {
      const { error } = await db.auth.signOut();
      if (error) throw error;
    } else if (b.mode === 'reset') {
      if (!b.password || b.password !== b.confirm)
        throw new HttpError('Konfirmasi password tidak cocok');
      const { error } = await db.auth.updateUser({ password: b.password });
      if (error) throw new HttpError('Link reset tidak valid atau kedaluwarsa');
    } else if (b.mode === 'forgot') {
      if (!b.email) throw new HttpError('Email diperlukan');
      await db.auth.resetPasswordForEmail(b.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
      });
      message = 'Jika email terdaftar, link reset sudah dikirim.';
    } else if (b.mode === 'register') {
      if (!b.email || !b.password || !b.name || b.password !== b.confirm)
        throw new HttpError('Lengkapi data dan cocokkan password');
      const { data, error } = await db.auth.signUp({
        email: b.email,
        password: b.password,
        options: {
          data: { display_name: b.name },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });
      if (error) throw new HttpError(error.message);
      if (!data.session) message = 'Periksa email untuk mengonfirmasi akun, lalu login.';
    } else {
      if (!b.email || !b.password) throw new HttpError('Email dan password diperlukan');
      const { error } = await db.auth.signInWithPassword({ email: b.email, password: b.password });
      if (error)
        throw new HttpError('Email atau password salah, atau email belum dikonfirmasi', 401);
    }
    return NextResponse.json({ message });
  } catch (e) {
    return errorResponse(e);
  }
}
