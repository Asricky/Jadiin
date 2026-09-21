import Link from 'next/link';
import { publicEvent } from '@/lib/server';
import { hashToken, setSession } from '@/lib/session';
import { service } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
export default async function Recover({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const event = await publicEvent(slug);
  async function recover() {
    'use server';
    const { data } = await service()
      .from('participants')
      .select('id')
      .eq('event_id', event.id)
      .eq('access_token_hash', hashToken(token))
      .maybeSingle();
    if (!data) redirect(`/e/${slug}?error=access`);
    await setSession(event.id, token);
    redirect(`/e/${slug}/dashboard`);
  }
  return (
    <main className="narrow section">
      <span className="eyebrow">LINK PRIBADI KAMU</span>
      <h1>Balik ke rencana seru.</h1>
      <p>
        Gunakan link ini untuk membuka jawabanmu di {event.name}. Simpan dan jangan bagikan ke orang
        lain.
      </p>
      <form action={recover}>
        <button className="button">Buka jawaban saya</button>
      </form>
      <Link href={`/e/${slug}`}>Kembali ke acara</Link>
    </main>
  );
}
