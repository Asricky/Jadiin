import { Unzip, UnzipInflate } from 'fflate';
import { detectImage } from './validation';
export const MAX_PHOTOS = 30;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 100 * 1024 * 1024;
export async function preparePhotos(files: File[]): Promise<{ files: File[]; skipped: string[] }> {
  const result: File[] = [];
  const skipped: string[] = [];
  let expanded = 0;
  async function add(name: string, bytes: Uint8Array) {
    const mime = detectImage(bytes);
    if (!mime) throw new Error(`${name}: isi file bukan JPG, PNG, atau WebP yang valid.`);
    if (bytes.length > MAX_PHOTO_BYTES) throw new Error(`${name}: maksimal 5 MB per foto.`);
    if (result.length >= MAX_PHOTOS) throw new Error(`Maksimal ${MAX_PHOTOS} foto per unggahan.`);
    result.push(new File([new Uint8Array(bytes)], name.split('/').pop()!, { type: mime }));
  }
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      if (file.size > 25 * 1024 * 1024) throw new Error('ZIP maksimal 25 MB.');
      const pending: { name: string; bytes: Uint8Array }[] = [];
      let failure: Error | undefined;
      let entries = 0;
      const unzip = new Unzip((entry) => {
        if (++entries > 300) {
          failure = new Error('ZIP memuat terlalu banyak file.');
          return;
        }
        if (entry.name.includes('..') || entry.name.startsWith('/') || entry.name.includes('\\')) {
          failure = new Error('Struktur path ZIP tidak valid.');
          return;
        }
        if (
          !/\.(jpe?g|png|webp)$/i.test(entry.name) ||
          entry.name.startsWith('__MACOSX/') ||
          entry.name.split('/').some((x) => x.startsWith('.'))
        ) {
          if (!entry.name.endsWith('/')) skipped.push(entry.name);
          return;
        }
        if (pending.length + result.length >= MAX_PHOTOS) {
          failure = new Error(`Maksimal ${MAX_PHOTOS} foto per unggahan.`);
          return;
        }
        if ((entry.originalSize || 0) > MAX_PHOTO_BYTES) {
          failure = new Error(`${entry.name}: maksimal 5 MB per foto.`);
          return;
        }
        let size = 0;
        const chunks: Uint8Array[] = [];
        entry.ondata = (error, chunk, final) => {
          if (error) {
            failure = error;
            return;
          }
          size += chunk.length;
          expanded += chunk.length;
          if (size > MAX_PHOTO_BYTES || expanded > MAX_EXPANDED_BYTES) {
            failure = new Error('Hasil ekstraksi ZIP melebihi batas ukuran.');
            entry.terminate();
            return;
          }
          chunks.push(chunk);
          if (final && !failure) {
            const bytes = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) {
              bytes.set(chunk, offset);
              offset += chunk.length;
            }
            pending.push({ name: entry.name, bytes });
          }
        };
        entry.start();
      });
      unzip.register(UnzipInflate);
      const bytes = new Uint8Array(await file.arrayBuffer());
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        unzip.push(bytes.subarray(offset, offset + 65536), offset + 65536 >= bytes.length);
        if (failure) throw failure;
      }
      for (const item of pending) await add(item.name, item.bytes);
    } else {
      if (file.size > MAX_PHOTO_BYTES) throw new Error(`${file.name}: maksimal 5 MB per foto.`);
      expanded += file.size;
      if (expanded > MAX_EXPANDED_BYTES) throw new Error('Total foto maksimal 100 MB.');
      await add(file.name, new Uint8Array(await file.arrayBuffer()));
    }
  }
  if (!result.length) throw new Error('Tidak ada foto JPG, JPEG, PNG, atau WebP di dalam file.');
  return { files: result, skipped };
}
