'use client';
import { useRef } from 'react';
import { format, parseISO, getDay } from 'date-fns';
import { id } from 'date-fns/locale';
import type { EventDate } from '@/types/domain';
export function DateGrid({
  dates,
  value,
  onChange,
  counts,
  total = 0,
}: {
  dates: EventDate[];
  value?: string[];
  onChange?: (v: string[]) => void;
  counts?: Record<string, number>;
  total?: number;
}) {
  const drag = useRef<{ select: boolean; seen: Set<string> } | null>(null);
  const selection = useRef(value || []);
  const months = Object.groupBy(
    [...dates].sort((a, b) => a.date.localeCompare(b.date)),
    (d) => d.date.slice(0, 7),
  );
  function paint(dateId: string) {
    if (!drag.current || drag.current.seen.has(dateId) || !onChange) return;
    drag.current.seen.add(dateId);
    selection.current = drag.current.select
      ? [...new Set([...selection.current, dateId])]
      : selection.current.filter((x) => x !== dateId);
    onChange(selection.current);
  }
  return (
    <div className="stack">
      {Object.entries(months).map(([month, days]) => {
        const byDay = new Map(days!.map((d) => [Number(d.date.slice(8)), d]));
        const lastDay = Math.max(...byDay.keys());
        const offset = (getDay(parseISO(`${month}-01`)) + 6) % 7;
        return (
          <div key={month} className="stack-sm">
            <h3 style={{ fontSize: 14, textTransform: 'capitalize' }}>
              {format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: id })}
            </h3>
            <div
              className="calendar"
              style={{ touchAction: onChange ? 'none' : undefined }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') drag.current = null;
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const target = document
                  .elementFromPoint(e.clientX, e.clientY)
                  ?.closest<HTMLElement>('[data-date-id]');
                if (target?.dataset.dateId) paint(target.dataset.dateId);
              }}
            >
              {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => (
                <span key={d} className="calendar-day">
                  {d}
                </span>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: lastDay }, (_, i) => {
                const d = byDay.get(i + 1);
                if (!d)
                  return (
                    <span
                      className="date-cell"
                      style={{ opacity: 0.25, borderColor: 'transparent' }}
                      key={i}
                    >
                      {i + 1}
                    </span>
                  );
                const count = counts?.[d.id] || 0;
                return (
                  <button
                    type="button"
                    key={d.id}
                    data-date-id={d.id}
                    aria-label={`${d.date}${counts ? `: ${count} dari ${total} tersedia` : ''}`}
                    aria-pressed={onChange ? value?.includes(d.id) : undefined}
                    className={`date-cell ${value?.includes(d.id) ? 'selected' : ''}`}
                    style={
                      counts
                        ? {
                            background: `rgba(91,139,65,${0.06 + 0.65 * (total ? count / total : 0)})`,
                          }
                        : undefined
                    }
                    onPointerDown={(e) => {
                      if (!onChange) return;
                      e.preventDefault();
                      selection.current = value || [];
                      drag.current = { select: !selection.current.includes(d.id), seen: new Set() };
                      paint(d.id);
                    }}
                    onClick={(e) => {
                      if (e.detail === 0 && onChange)
                        onChange(
                          value?.includes(d.id)
                            ? value.filter((x) => x !== d.id)
                            : [...(value || []), d.id],
                        );
                    }}
                  >
                    {i + 1}
                    {counts && <small>{count} orang</small>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
