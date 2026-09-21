'use client';
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, getDay, getDaysInMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import type { EventDate } from '@/types/domain';
export function DateGrid({
  dates,
  value,
  onChange,
  counts,
  total = 0,
  compact = false,
}: {
  dates: EventDate[];
  value?: string[];
  onChange?: (v: string[]) => void;
  counts?: Record<string, number>;
  total?: number;
  compact?: boolean;
}) {
  const drag = useRef<{ select: boolean; start: number; base: string[] } | null>(null);
  const [monthIndex, setMonthIndex] = useState(() =>
    Math.max(
      0,
      [...new Set(dates.map((d) => d.date.slice(0, 7)))]
        .sort()
        .indexOf(dates.find((d) => d.id === value?.[0])?.date.slice(0, 7) || ''),
    ),
  );
  const ordered = [...dates].sort((a, b) => a.date.localeCompare(b.date));
  const selection = useRef(value || []);
  const months = Object.groupBy(
    [...dates].sort((a, b) => a.date.localeCompare(b.date)),
    (d) => d.date.slice(0, 7),
  );
  function paint(dateId: string) {
    if (!drag.current || !onChange) return;
    const end = ordered.findIndex((d) => d.id === dateId);
    if (end < 0) return;
    const { start, base, select } = drag.current;
    const range = ordered.slice(Math.min(start, end), Math.max(start, end) + 1).map((d) => d.id);
    selection.current = select
      ? [...new Set([...base, ...range])]
      : base.filter((id) => !range.includes(id));
    onChange(selection.current);
  }
  return (
    <div className={`stack ${compact ? 'compact-calendar' : ''}`}>
      {compact && Object.keys(months).length > 1 && (
        <div className="row between">
          <button
            type="button"
            className="button button-ghost button-sm"
            disabled={monthIndex === 0}
            onClick={() => setMonthIndex(monthIndex - 1)}
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>
          <small>
            {monthIndex + 1} / {Object.keys(months).length}
          </small>
          <button
            type="button"
            className="button button-ghost button-sm"
            disabled={monthIndex >= Object.keys(months).length - 1}
            onClick={() => setMonthIndex(monthIndex + 1)}
            aria-label="Bulan berikutnya"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      {Object.entries(months)
        .filter((_, i) => !compact || i === Math.min(monthIndex, Object.keys(months).length - 1))
        .map(([month, days]) => {
          const byDay = new Map(days!.map((d) => [Number(d.date.slice(8)), d]));
          const lastDay = getDaysInMonth(parseISO(`${month}-01`));
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
                onLostPointerCapture={() => (drag.current = null)}
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
                              outline: value?.includes(d.id) ? '2px solid #2563eb' : undefined,
                              background: `rgba(37,99,235,${0.04 + 0.28 * (total ? count / total : 0)})`,
                            }
                          : undefined
                      }
                      onPointerDown={(e) => {
                        if (!onChange) return;
                        e.preventDefault();
                        selection.current = value || [];
                        e.currentTarget.parentElement?.setPointerCapture(e.pointerId);
                        drag.current = {
                          select: !selection.current.includes(d.id),
                          start: ordered.findIndex((x) => x.id === d.id),
                          base: [...selection.current],
                        };
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
                      {counts && <small>{count}</small>}
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
