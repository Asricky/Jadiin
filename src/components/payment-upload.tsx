'use client';
import { useRouter } from 'next/navigation';
import { UploadField } from './common';
import { CopyButton } from './common';
import { useState } from 'react';
import { methodLabel } from '@/lib/payment-methods';
import type { PaymentMethod } from '@/types/domain';
export function PaymentUpload({
  eventId,
  slug,
  amount,
  methods,
}: {
  eventId: string;
  slug: string;
  amount: number;
  methods: PaymentMethod[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const method = methods[selected] || methods[0];
  return (
    <div className="stack">
      <label className="field">
        Tujuan transfer
        <select
          aria-label="Tujuan transfer"
          disabled={busy}
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
        >
          {methods.map((m, i) => (
            <option key={i} value={i}>
              {methodLabel(m)}
            </option>
          ))}
        </select>
      </label>
      {method && (
        <div className="card stack-sm">
          <strong>{method.bank_name}</strong>
          <h3>{method.bank_account_number}</h3>
          <p>a.n. {method.bank_account_holder}</p>
          <CopyButton value={method.bank_account_number} label="Salin nomor rekening" />
          <small>
            Transfer penuh ke salah satu rekening, lalu unggah bukti untuk rekening yang dipilih.
          </small>
        </div>
      )}
      <UploadField
        eventId={eventId}
        kind="payment"
        amount={amount}
        paymentMethod={method && methodLabel(method)}
        disabled={!method}
        onBusyChange={setBusy}
        onDone={() => {
          router.push(`/e/${slug}/thank-you`);
          router.refresh();
        }}
      />
    </div>
  );
}
