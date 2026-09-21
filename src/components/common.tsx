'use client';
import { useState } from 'react';
import { Copy, Check, LoaderCircle, Upload, Mountain } from 'lucide-react';
import Link from 'next/link';
import { Button } from './ui/button';
import { api } from '@/lib/utils';
import { browserDb } from '@/lib/supabase/client';
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark">
        <Mountain size={23} />
      </span>
      makrab<span className="brand-light">planner</span>
      <span className="brand-dot">.</span>
    </Link>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return children ? (
    <div role={error ? 'alert' : 'status'} className={`notice ${error ? 'notice-error' : ''}`}>
      {children}
    </div>
  ) : null;
}
export function CopyButton({ value, label = 'Salin link' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setError(true);
        }
      }}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
      {error ? 'Gagal menyalin' : copied ? 'Tersalin' : label}
    </Button>
  );
}
export function UploadField({
  eventId,
  kind,
  villaId,
  onDone,
}: {
  eventId: string;
  kind: 'media' | 'payment';
  villaId?: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div>
      <label className="upload-box">
        <Upload size={24} />
        <strong>
          {busy ? 'Mengunggah…' : kind === 'payment' ? 'Pilih bukti pembayaran' : 'Unggah foto'}
        </strong>
        <span>JPG, PNG, atau WebP · maksimal 5 MB</span>
        <input
          aria-label={kind === 'payment' ? 'Bukti pembayaran' : 'Foto'}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError('');
            setBusy(true);
            try {
              if (file.size > 5242880) throw new Error('Ukuran maksimal 5 MB');
              const signed = await api<{
                intent: string;
                path: string;
                token: string;
                bucket: string;
              }>('/api/uploads', {
                action: 'sign',
                kind,
                event_id: eventId,
                size: file.size,
                mime: file.type,
              });
              const { error } = await browserDb()
                .storage.from(signed.bucket)
                .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
              if (error) throw error;
              await api('/api/uploads', {
                action: 'complete',
                intent: signed.intent,
                villa_id: villaId,
              });
              onDone();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
              e.target.value = '';
            }
          }}
        />
        {busy && <LoaderCircle className="spin" />}
      </label>
      <Notice error>{error}</Notice>
    </div>
  );
}
