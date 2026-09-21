import type { Bundle } from '@/types/domain';
export function analytics(data: Bundle) {
  const dateCounts = Object.fromEntries(
    data.dates.map((d) => [d.id, data.availability.filter((a) => a.event_date_id === d.id).length]),
  );
  const villaCounts = Object.fromEntries(
    data.villas.map((v) => [v.id, data.votes.filter((a) => a.villa_id === v.id).length]),
  );
  const maxDate = Math.max(0, ...Object.values(dateCounts));
  const maxVilla = Math.max(
    0,
    ...data.villas.filter((v) => v.active).map((v) => villaCounts[v.id]),
  );
  return {
    dateCounts,
    villaCounts,
    maxDate,
    maxVilla,
    leadingDates: data.dates.filter((d) => maxDate > 0 && dateCounts[d.id] === maxDate),
    leadingVillas: data.villas.filter(
      (v) => v.active && maxVilla > 0 && villaCounts[v.id] === maxVilla,
    ),
  };
}
