import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { preparePhotos } from '../../src/lib/media';
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const jpeg = new Uint8Array([255, 216, 255, 224, 1, 2, 3]);
const archive = (entries: Record<string, Uint8Array>) =>
  new File([new Uint8Array(zipSync(entries))], 'photos.zip', { type: 'application/zip' });
describe('batch and ZIP photo preparation', () => {
  it('normalizes MIME by content and extracts only supported photos, including uppercase JPEG', async () => {
    const result = await preparePhotos([
      new File([png], 'direct.png', { type: '' }),
      archive({
        'album/cover.JPG': jpeg,
        'album/room.JPEG': jpeg,
        'album/pool.png': png,
        'readme.txt': new TextEncoder().encode('skip'),
        '__MACOSX/._cover.JPG': jpeg,
      }),
    ]);
    expect(result.files.map((f) => f.name)).toEqual([
      'direct.png',
      'cover.JPG',
      'room.JPEG',
      'pool.png',
    ]);
    expect(result.files.map((f) => f.type)).toEqual([
      'image/png',
      'image/jpeg',
      'image/jpeg',
      'image/png',
    ]);
    expect(result.skipped).toHaveLength(2);
  });
  it('rejects HTML renamed as a photo', async () => {
    await expect(
      preparePhotos([
        archive({ 'attack.jpg': new TextEncoder().encode('<script>alert(1)</script>') }),
      ]),
    ).rejects.toThrow('isi file bukan');
  });
  it('rejects path traversal and archives with no supported photos', async () => {
    await expect(preparePhotos([archive({ '../photo.png': png })])).rejects.toThrow('path ZIP');
    await expect(preparePhotos([archive({ 'readme.txt': png })])).rejects.toThrow('Tidak ada foto');
  });
  it('enforces batch and decompressed photo limits before network uploads', async () => {
    await expect(
      preparePhotos(Array.from({ length: 31 }, (_, i) => new File([png], `${i}.png`))),
    ).rejects.toThrow('30 foto');
    const oversized = new Uint8Array(5242881);
    oversized.set(png);
    await expect(preparePhotos([archive({ 'large.png': oversized })])).rejects.toThrow(
      /5 MB|batas ukuran/,
    );
  });
  it('fails corrupt ZIPs instead of silently reporting success', async () => {
    await expect(preparePhotos([new File(['invalid zip'], 'bad.zip')])).rejects.toThrow();
  });
});
