import 'server-only';
import { service } from './supabase/server';
import type { VehicleOffer } from './vehicle-offers';
// Only called after participant session/event authorization. Never expose phone/token.
export async function transportOffers(eventId: string): Promise<VehicleOffer[]> {
  const result: VehicleOffer[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await service()
      .from('participants')
      .select('id,name,vehicle_type,vehicle_owner,vehicle_driver,vehicle_capacity')
      .eq('event_id', eventId)
      .neq('vehicle_type', 'NONE')
      .order('id')
      .range(offset, offset + 499);
    if (error) throw error;
    result.push(...data);
    if (data.length < 500) return result;
  }
}
