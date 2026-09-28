'use client';
import { useState } from 'react';
import type { Event } from '@/types/domain';
import { paymentMethods, methodLabel } from '@/lib/payment-methods';
import { Button } from './ui/button';
import { Input } from './ui/input';
export function PaymentMethodEditor({
  event,
  act,
  locked,
}: {
  event: Event;
  act: (action: string, data: object) => Promise<unknown>;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const extra = event.additional_payment_methods || [];
  return (
    <section className="card stack-sm">
      <div className="row between">
        <div>
          <h3>Metode pembayaran</h3>
          <p className="text-sm">Peserta memilih satu rekening tujuan transfer.</p>
        </div>
        <Button
          variant="outline"
          disabled={locked || busy || extra.length >= 9}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Batal' : 'Tambah metode pembayaran'}
        </Button>
      </div>
      {paymentMethods(event).map((m, i) => (
        <div className="row between" key={methodLabel(m)}>
          <div>
            <strong>{m.bank_name}</strong>
            <p>
              {m.bank_account_number} · a.n. {m.bank_account_holder}
            </p>
            <small>
              {i === 0 ? 'Rekening utama · ubah melalui pengaturan biaya' : 'Rekening tambahan'}
            </small>
          </div>
          {i > 0 && !locked && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    'Hapus rekening ini dari pilihan transfer? Bukti yang sudah masuk tetap tersimpan.',
                  )
                )
                  return;
                setBusy(true);
                try {
                  await act('payment_methods', {
                    methods: extra.filter((_, index) => index !== i - 1),
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Hapus
            </Button>
          )}
        </div>
      ))}
      {!event.bank_name && <p>Atur rekening utama pada pengaturan biaya terlebih dahulu.</p>}
      {open && (
        <form
          className="stack-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            try {
              if (await act('payment_methods', { methods: [...extra, f] })) setOpen(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid grid-2">
            {[
              ['bank_name', 'Bank tambahan'],
              ['bank_account_number', 'Nomor rekening tambahan'],
              ['bank_account_holder', 'Pemilik rekening tambahan'],
            ].map(([name, label]) => (
              <label className="field" key={name}>
                {label}
                <Input
                  name={name}
                  required
                  maxLength={name === 'bank_account_number' ? 30 : 100}
                  pattern={name === 'bank_account_number' ? '[0-9]{5,30}' : undefined}
                  inputMode={name === 'bank_account_number' ? 'numeric' : undefined}
                />
              </label>
            ))}
          </div>
          <Button disabled={busy || locked || !event.bank_name}>
            {busy ? 'Menyimpan...' : 'Simpan metode pembayaran'}
          </Button>
        </form>
      )}
    </section>
  );
}
