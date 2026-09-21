/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { ArrowRight, CalendarDays, Users } from 'lucide-react';
import { notFound } from 'next/navigation';
import { publicEvent, HttpError } from '@/lib/server';
import { service } from '@/lib/supabase/server';
import { session } from '@/lib/session';
import { statusLabel } from '@/types/domain';
import { prettyDate, mediaUrl } from '@/lib/utils';
export default async function Landing({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const event = await publicEvent(slug).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const db = service();
  const [{ count }, { data: owner }, p] = await Promise.all([
    db.from('participants').select('id', { head: true, count: 'exact' }).eq('event_id', event.id),
    db.from('profiles').select('display_name').eq('id', event.owner_id).single(),
    session(event.id),
  ]);
  const open =
    event.status === 'STAGE_1_OPEN' &&
    (!event.stage1_deadline || new Date(event.stage1_deadline) > new Date());
  return (
    <main className="narrow section stack">
      {event.cover_path && (
        <img
          className="rounded-xl w-full max-h-80 object-cover"
          src={mediaUrl(event.cover_path)!}
          alt={event.name}
        />
      )}
      <div className="row">
        <span className={`badge badge-${event.status}`}>{statusLabel[event.status]}</span>
        <span className="muted" style={{ fontSize: 12 }}>
          oleh {owner?.display_name || 'Organizer'}
        </span>
      </div>
      <h1>{event.name}</h1>
      <p style={{ whiteSpace: 'pre-line' }}>{event.description}</p>
      <div className="row muted">
        <span className="row">
          <Users size={17} />
          {count || 0} teman sudah ikut
        </span>
        {event.stage1_deadline && (
          <span className="row">
            <CalendarDays size={17} />
            Isi sebelum {prettyDate(event.stage1_deadline)}
          </span>
        )}
      </div>
      {(await searchParams).error && (
        <p role="alert">Link akses tidak valid. Hubungi organizer untuk link baru.</p>
      )}
      {p ? (
        <Link className="button" href={`/e/${slug}/dashboard`}>
          Lanjutkan, {p.name}
          <ArrowRight size={18} />
        </Link>
      ) : open ? (
        <Link className="button" href={`/e/${slug}/stage-1`}>
          Ikut makrab <ArrowRight size={18} />
        </Link>
      ) : (
        <div className="notice">
          Pendaftaran telah ditutup. Sudah ikut? Buka link akses pribadimu atau hubungi organizer.
        </div>
      )}
      <small className="muted" style={{ textAlign: 'center' }}>
        Tanpa akun. Isi pilihanmu, kita rencanakan bareng.
      </small>
    </main>
  );
}
