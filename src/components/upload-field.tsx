'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { CheckCircle2, ImagePlus, LoaderCircle, AlertCircle } from 'lucide-react';
import { api, mediaUrl } from '@/lib/utils';
import { preparePhotos } from '@/lib/media';
import { browserDb } from '@/lib/supabase/client';
import type { VillaImage } from '@/types/domain';
type Item = {
  name: string;
  status: 'waiting' | 'uploading' | 'done' | 'error';
  path?: string;
  error?: string;
};
export function UploadField({
  eventId,
  kind,
  villaId,
  onDone,
  onUploaded,
  amount,
}: {
  eventId: string;
  kind: 'media' | 'payment';
  amount?: number;
  villaId?: string;
  onDone: () => void;
  onUploaded?: (image: VillaImage, cover: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  async function upload(input: File[]) {
    setBusy(true);
    setError('');
    setSkipped([]);
    let succeeded = false;
    try {
      const prepared =
        kind === 'media' ? await preparePhotos(input) : { files: [input[0]], skipped: [] };
      setSkipped(prepared.skipped);
      setItems(prepared.files.map((f) => ({ name: f.name, status: 'waiting' })));
      for (const [index, file] of prepared.files.entries()) {
        const update = (item: Partial<Item>) =>
          setItems((previous) => previous.map((v, i) => (i === index ? { ...v, ...item } : v)));
        update({ status: 'uploading' });
        try {
          if (file.size > 5242880) throw new Error('Maksimal 5 MB per foto.');
          const signed = await api<{ intent: string; path: string; token: string; bucket: string }>(
            '/api/uploads',
            {
              action: 'sign',
              kind,
              event_id: eventId,
              size: file.size,
              mime: file.type,
              expected_amount: amount,
            },
          );
          const { error } = await browserDb()
            .storage.from(signed.bucket)
            .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
          if (error) throw error;
          const result = await api<{ image?: VillaImage; cover: string | null }>('/api/uploads', {
            action: 'complete',
            intent: signed.intent,
            villa_id: villaId,
          });
          update({ status: 'done', path: signed.path });
          succeeded = true;
          if (result.image) onUploaded?.(result.image, result.cover);
        } catch (error) {
          update({ status: 'error', error: (error as Error).message });
        }
      }
      if (succeeded) onDone();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack-sm">
      <label
        className={`upload-box ${busy ? 'is-busy' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy && e.dataTransfer.files.length) void upload(Array.from(e.dataTransfer.files));
        }}
      >
        <ImagePlus size={24} />
        <strong>
          {busy
            ? 'Mengunggah foto…'
            : kind === 'payment'
              ? 'Pilih bukti pembayaran'
              : 'Tambahkan foto atau file ZIP'}
        </strong>
        <span>
          {kind === 'media'
            ? 'Pilih beberapa foto, atau tarik file ke sini. JPG, JPEG, PNG, WebP.'
            : 'JPG, JPEG, PNG, atau WebP.'}
        </span>
        <small>
          5 MB per foto{kind === 'media' ? ' · 30 foto per unggahan · ZIP maks. 25 MB' : ''}
        </small>
        <input
          aria-label={kind === 'payment' ? 'Bukti pembayaran' : 'Foto'}
          type="file"
          multiple={kind === 'media'}
          accept={
            kind === 'media'
              ? '.jpg,.jpeg,.png,.webp,.zip,image/jpeg,image/png,image/webp,application/zip'
              : 'image/jpeg,image/png,image/webp'
          }
          disabled={busy}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            if (files.length) void upload(files);
          }}
        />
      </label>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {items.length > 0 && (
        <div aria-live="polite" className="stack-sm">
          <p className="upload-summary">
            {items.filter((i) => i.status === 'done').length} dari {items.length} foto berhasil
            diunggah
          </p>
          <div className="upload-previews">
            {items.map((item, index) => (
              <div className="upload-preview" key={index}>
                {item.status === 'done' && kind === 'media' ? (
                  <img src={mediaUrl(item.path!)!} alt={`Berhasil diunggah: ${item.name}`} />
                ) : (
                  <div className="upload-placeholder">
                    {item.status === 'error' ? (
                      <AlertCircle />
                    ) : item.status === 'done' ? (
                      <CheckCircle2 />
                    ) : (
                      <LoaderCircle className={item.status === 'uploading' ? 'spin' : ''} />
                    )}
                  </div>
                )}
                <div>
                  <span title={item.name}>{item.name}</span>
                  <small className={item.status === 'error' ? 'text-error' : ''}>
                    {item.status === 'done'
                      ? 'Berhasil'
                      : item.status === 'error'
                        ? item.error
                        : item.status === 'uploading'
                          ? 'Mengunggah…'
                          : 'Dalam antrean'}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {skipped.length > 0 && (
        <p className="muted">{skipped.length} file non-foto di dalam ZIP dilewati.</p>
      )}
    </div>
  );
}
