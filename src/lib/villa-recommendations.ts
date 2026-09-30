import type { Villa } from '@/types/domain';
export function orderedVillas(villas: Villa[], recommended?: string | null) {
  return [...villas].sort(
    (a, b) =>
      Number(b.id === recommended) - Number(a.id === recommended) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name, 'id') ||
      a.id.localeCompare(b.id),
  );
}
