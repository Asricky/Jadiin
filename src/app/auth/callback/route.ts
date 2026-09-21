import { appOrigin } from '@/lib/app-origin';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (code) {
    const { error } = await (await supabase()).auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get('next') === '/reset-password' ? '/reset-password' : '/admin/events',
          appOrigin(),
        ),
      );
  }
  return NextResponse.redirect(new URL('/login?error=Link+tidak+valid', url.origin));
}
