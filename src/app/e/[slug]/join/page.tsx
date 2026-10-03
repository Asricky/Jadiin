import { redirect } from 'next/navigation';
import { publicEvent } from '@/lib/server';
export default async function Join({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await publicEvent(slug);
  redirect(`/e/${slug}/${event.status === 'STAGE_2_OPEN' ? 'stage-2' : 'stage-1'}`);
}
