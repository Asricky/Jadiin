import { redirect } from 'next/navigation';
import { publicEvent, bundle } from '@/lib/server';
import { session } from '@/lib/session';
import { StageOne } from '@/components/stage-one';
export default async function Stage1({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await publicEvent(slug);
  if (
    event.status !== 'STAGE_1_OPEN' ||
    (event.stage1_deadline && new Date(event.stage1_deadline) < new Date())
  )
    redirect(`/e/${slug}`);
  const [data, p] = await Promise.all([bundle(event), session(event.id)]);
  return (
    <main className="narrow section stack">
      <span className="eyebrow">{event.name}</span>
      <StageOne
        event={{ id: event.id, slug: event.slug }}
        dates={data.dates}
        villas={data.villas}
        images={data.images}
        initial={
          p
            ? {
                name: p.name,
                whatsapp: p.whatsapp,
                vehicle_type: p.vehicle_type,
                vehicle_owner: p.vehicle_owner || '',
                vehicle_driver: p.vehicle_driver || '',
                vehicle_capacity: p.vehicle_capacity || 5,
                dates: data.availability
                  .filter((a) => a.participant_id === p.id)
                  .map((a) => a.event_date_id),
                villa_id: data.votes.find((v) => v.participant_id === p.id)?.villa_id || '',
              }
            : undefined
        }
      />
    </main>
  );
}
