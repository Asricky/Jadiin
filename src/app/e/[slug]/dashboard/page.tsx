import Link from 'next/link';
import { redirect } from 'next/navigation';
import { publicEvent, bundle } from '@/lib/server';
import { session } from '@/lib/session';
import { CopyButton } from '@/components/common';
import { PlanningAnalytics } from '@/components/analytics';
export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await publicEvent(slug);
  const p = await session(event.id);
  if (!p) redirect(`/e/${slug}`);
  if (['STAGE_2_OPEN', 'COMPLETED'].includes(event.status)) redirect(`/e/${slug}/stage-2`);
  const data = await bundle(event);
  return (
    <main className="narrow section stack">
      <span className="eyebrow">JAWABANMU SUDAH TERSIMPAN</span>
      <h1>
        Makasih, {p.name}!<br />
        Rencana mulai terbentuk.
      </h1>
      <p>Hasil ini masih bisa berubah sampai organizer menentukan keputusan final.</p>
      <div className="card card-lime stack-sm">
        <h3>Simpan pintu masukmu.</h3>
        <p style={{ fontSize: 13 }}>
          Link ini khusus untuk kamu. Simpan untuk membuka jawaban di perangkat lain; jangan
          bagikan.
        </p>
        <div>
          <CopyButton
            value={`${process.env.NEXT_PUBLIC_APP_URL}/e/${slug}/p/${p.token}`}
            label="Salin link akses pribadi"
          />
        </div>
      </div>
      {event.status === 'STAGE_1_OPEN' && (
        <Link className="text-link" href={`/e/${slug}/stage-1`}>
          Ubah jawaban saya
        </Link>
      )}
      <PlanningAnalytics data={data} />
    </main>
  );
}
