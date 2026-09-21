import { addDays, format, parseISO } from 'date-fns';
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
  const dates = [...data.dates].sort((a, b) => a.date.localeCompare(b.date));
  const datePairs = dates
    .flatMap((start) => {
      const end = dates.find(
        (d) => d.date === format(addDays(parseISO(start.date), 1), 'yyyy-MM-dd'),
      );
      if (!end) return [];
      const first = new Set(
        data.availability.filter((a) => a.event_date_id === start.id).map((a) => a.participant_id),
      );
      const both = new Set(
        data.availability
          .filter((a) => a.event_date_id === end.id && first.has(a.participant_id))
          .map((a) => a.participant_id),
      );
      return [{ start, end, count: both.size, participantIds: [...both] }];
    })
    .sort((a, b) => b.count - a.count || a.start.date.localeCompare(b.start.date));
  const maxPair = datePairs[0]?.count || 0;
  return {
    datePairs,
    leadingPairs: datePairs.filter((p) => maxPair > 0 && p.count === maxPair),
    maxPair,
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
