'use client';
import { Check, ArrowLeft } from 'lucide-react';
import type { Status } from '@/types/domain';
import { Button } from './ui/button';
export const phases: { status: Status; label: string; description: string }[] = [
  { status: 'DRAFT', label: 'Draft', description: 'Siapkan pilihan tanggal dan villa.' },
  {
    status: 'STAGE_1_OPEN',
    label: 'Voting',
    description: 'Peserta mengisi tanggal, villa, dan kendaraan.',
  },
  {
    status: 'STAGE_1_CLOSED',
    label: 'Finalisasi',
    description: 'Tetapkan tanggal, villa, transport, dan biaya.',
  },
  {
    status: 'STAGE_2_OPEN',
    label: 'Pembayaran',
    description: 'Peserta melihat rencana final dan mengirim bukti bayar.',
  },
  {
    status: 'COMPLETED',
    label: 'Selesai',
    description: 'Acara selesai. Seluruh data tetap tersimpan.',
  },
  {
    status: 'ARCHIVED',
    label: 'Arsip',
    description: 'Acara diarsipkan dan tautan publik ditutup.',
  },
];
export function PhaseTimeline({
  status,
  onBack,
  disabled,
}: {
  status: Status;
  onBack: (status: Status) => void;
  disabled: boolean;
}) {
  const index = phases.findIndex((p) => p.status === status);
  return (
    <section className="phase-panel" aria-label="Timeline acara">
      <ol className="phase-timeline">
        {phases.map((phase, i) => (
          <li
            key={phase.status}
            className={i === index ? 'current' : i < index ? 'complete' : ''}
            aria-current={i === index ? 'step' : undefined}
          >
            <span className="phase-dot">{i < index ? <Check size={14} /> : i + 1}</span>
            <span>{phase.label}</span>
          </li>
        ))}
      </ol>
      <div className="row between">
        <p>{phases[index].description}</p>
        {index > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onBack(phases[index - 1].status)}
          >
            <ArrowLeft size={14} />
            Kembali ke {phases[index - 1].label}
          </Button>
        )}
      </div>
    </section>
  );
}
