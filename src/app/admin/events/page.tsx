import { supabase } from '@/lib/supabase/server';
import { EventsList } from '@/components/events-list';
import type { Event } from '@/types/domain';
export default async function Events() {
  const db = await supabase();
  const [
    { data, error },
    {
      data: { user },
    },
  ] = await Promise.all([
    db.from('events').select('*,participants(count)').order('created_at', { ascending: false }),
    db.auth.getUser(),
  ]);
  if (error) throw error;
  return (
    <EventsList
      events={(data || []) as (Event & { participants: { count: number }[] })[]}
      name={String(user?.user_metadata.display_name || 'Organizer').split(' ')[0]}
    />
  );
}
