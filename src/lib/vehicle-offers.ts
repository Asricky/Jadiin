import type { Group, Member, Participant } from '@/types/domain';
export type VehicleOffer = Pick<
  Participant,
  'id' | 'name' | 'vehicle_type' | 'vehicle_owner' | 'vehicle_driver' | 'vehicle_capacity'
>;
export function offerStatus(
  offer: VehicleOffer,
  groups: Group[],
  members: Member[],
  participants: { id: string; name: string }[] = [],
) {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  const owner = participants.find(
    (p) => normalize(p.name) === normalize(offer.vehicle_owner || offer.name),
  );
  const group = groups.find(
    (g) =>
      g.type === offer.vehicle_type &&
      (g.owner_participant_id === offer.id || g.owner_participant_id === owner?.id),
  );
  if (group) return { group, message: `Aktif di form peserta: ${group.label}` };
  if (members.some((m) => m.participant_id === offer.id))
    return {
      group: null,
      message: 'Penawar sudah memilih transport lain; perlu konfirmasi admin.',
    };
  return { group: null, message: 'Menunggu konfirmasi pemilik dan driver oleh admin.' };
}
