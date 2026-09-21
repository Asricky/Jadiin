import { appOrigin } from '@/lib/app-origin';
import { notFound } from 'next/navigation';
import { ownedEvent, bundle, HttpError } from '@/lib/server';
import { EventManager } from '@/components/event-manager';
export default async function Manage({
  params,
}: {
  params: Promise<{ id: string; tab?: string[] }>;
}) {
  const { id, tab } = await params;
  const active = tab?.[0] || 'overview';
  if (
    !['overview', 'participants', 'dates', 'villas', 'transport', 'payments', 'settings'].includes(
      active,
    ) ||
    (tab?.length || 0) > 1
  )
    notFound();
  const { event } = await ownedEvent(id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  return <EventManager data={await bundle(event, true)} tab={active} appUrl={appOrigin()} />;
}
