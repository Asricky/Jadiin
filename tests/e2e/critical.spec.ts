import { zipSync } from 'fflate';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHmac } from 'node:crypto';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const password = 'E2eMakrab2026!';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=',
  'base64',
);
test('organizer can register through the UI', async ({ page }) => {
  const email = `register-${Date.now()}@makrab.test`;
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    await page.goto('/register');
    await page.getByLabel('Nama lengkap').fill('New Organizer');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Konfirmasi password').fill(password);
    await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
    await expect(page).toHaveURL(/admin\/events$/);
    await expect(page.getByRole('heading', { name: 'Acara kamu' })).toBeVisible();
  } finally {
    const { data } = await db.auth.admin.listUsers();
    const user = data.users.find((u) => u.email === email);
    if (user) await db.auth.admin.deleteUser(user.id);
  }
});
test('real database: admin → participant → transport → private proof → verify → complete', async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  expect(url, 'Supabase must be configured; core tests never use mocks').toBeTruthy();
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const suffix = Date.now();
  const email = `e2e-${suffix}@makrab.test`;
  const slug = `e2e-makrab-${suffix}`;
  const name = `E2E Makrab ${suffix}`;
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'E2E Organizer' },
  });
  expect(error).toBeNull();
  const uid = created.user!.id;
  let eventId = '';
  let participantContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  try {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page).toHaveURL(/admin\/events$/);
    await page.getByRole('link', { name: 'Buat acara baru' }).click();
    await page.getByLabel('Nama acara').fill(name);
    await page.getByLabel('Link acara').fill(slug);
    await page.getByLabel('Deskripsi').fill('Rencana perjalanan dari browser ke database nyata.');
    await page.getByRole('button', { name: 'Lanjut pilih tanggal' }).click();
    const date = new Date();
    date.setDate(date.getDate() + 30);
    const dateText = date.toISOString().slice(0, 10);
    await page.getByLabel('Dari tanggal').fill(dateText);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    const endText = endDate.toISOString().slice(0, 10);
    await page.getByLabel('Sampai tanggal').fill(endText);
    await page.getByRole('button', { name: 'Tambahkan tanggal' }).click();
    await page.getByRole('button', { name: 'Simpan tanggal' }).click();
    await page.getByLabel('Nama villa', { exact: true }).fill('Villa E2E');
    await page.getByLabel('Harga per malam').fill('2000000');
    await expect(page.getByLabel('Harga per malam')).toHaveValue('2.000.000');
    await page
      .getByLabel('Fasilitas (satu fasilitas per baris)')
      .fill('Kolam renang\nArea BBQ\nWiFi');
    await page.getByLabel('Alamat', { exact: true }).fill('Jl. Pengujian No. 10, Bandung');
    await page.getByLabel('Kapasitas orang').fill('10');
    await page.getByLabel('Google Maps URL').fill('https://maps.google.com/');
    await page.getByRole('button', { name: 'Simpan villa', exact: true }).click();
    const jpeg = Buffer.from(
      await page.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 8;
        c.height = 8;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#eab308';
        ctx.fillRect(0, 0, 8, 8);
        return c.toDataURL('image/jpeg').split(',')[1];
      }),
      'base64',
    );
    const archive = zipSync({
      'photos/room.JPEG': new Uint8Array(jpeg),
      'notes.txt': new TextEncoder().encode('not a photo'),
    });
    await page.getByLabel('Foto', { exact: true }).setInputFiles([
      { name: 'villa.png', mimeType: 'image/png', buffer: png },
      { name: 'garden.jpg', mimeType: 'image/jpeg', buffer: jpeg },
      { name: 'villa.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) },
    ]);
    await expect(page.getByText('3 dari 3 foto berhasil diunggah')).toBeVisible();
    await expect(page.getByText('1 file non-foto di dalam ZIP dilewati.')).toBeVisible();
    await expect(page.getByRole('img', { name: /Berhasil diunggah:/ })).toHaveCount(3);
    await page.getByRole('button', { name: 'Jadikan foto 2 cover', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Jadikan foto 2 cover', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: 'test-results/revision-upload-desktop.png', fullPage: true });
    const starredSrc = await page.getByAltText('Foto villa 2', { exact: true }).getAttribute('src');
    await page.getByRole('button', { name: 'Selesai, kembali ke acara' }).click();
    await expect(page).toHaveURL(/admin\/events\/[a-f0-9-]+$/);
    eventId = page.url().split('/').pop()!;
    page.on('dialog', (dialog) =>
      dialog.accept(dialog.type() === 'prompt' ? 'Bukti kurang jelas' : undefined),
    );
    await page.getByRole('button', { name: 'Publish acara', exact: true }).click();
    await page.getByRole('button', { name: 'Ya, ubah fase' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Voting dibuka', { exact: true })).toBeVisible();
    participantContext = await browser.newContext({
      baseURL: appUrl,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const participant = await participantContext.newPage();
    participant.on('pageerror', (e) => consoleErrors.push(e.message));
    await participant.goto(`/e/${slug}`);
    await participant.getByRole('link', { name: 'Ikut makrab' }).click();
    await participant.getByLabel('Nama kamu').fill('Teman E2E');
    await participant.getByLabel('Nomor WhatsApp').fill('081234567890');
    await participant.getByRole('button', { name: 'Lanjut', exact: true }).click();
    const startCell = await participant
      .getByRole('button', { name: dateText, exact: true })
      .boundingBox();
    const endCell = await participant
      .getByRole('button', { name: endText, exact: true })
      .boundingBox();
    await participant.mouse.move(
      startCell!.x + startCell!.width / 2,
      startCell!.y + startCell!.height / 2,
    );
    await participant.mouse.down();
    await participant.mouse.move(
      endCell!.x + endCell!.width / 2,
      endCell!.y + endCell!.height / 2,
      { steps: 5 },
    );
    await participant.mouse.up();
    await expect(participant.getByRole('button', { name: dateText, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(participant.getByRole('button', { name: endText, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Real touch drag toggles the whole range off, then on again on a phone viewport.
    const touch = await participantContext.newCDPSession(participant);
    for (let i = 0; i < 2; i++) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          { x: startCell!.x + startCell!.width / 2, y: startCell!.y + startCell!.height / 2 },
        ],
      });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: endCell!.x + endCell!.width / 2, y: endCell!.y + endCell!.height / 2 }],
      });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(participant.getByRole('button', { name: endText, exact: true })).toHaveAttribute(
        'aria-pressed',
        i === 0 ? 'false' : 'true',
      );
    }
    await touch.detach();
    await participant.screenshot({
      path: 'test-results/revision-dates-mobile.png',
      fullPage: true,
    });
    await participant.getByRole('button', { name: 'Lanjut', exact: true }).click();
    await expect(participant.getByAltText('Cover Villa E2E')).toHaveAttribute('src', starredSrc!);
    await participant.getByRole('button', { name: 'Lihat info' }).click();
    await expect(participant.getByRole('dialog')).toContainText('Villa E2E');
    await expect(participant.getByRole('dialog')).toContainText('Area BBQ');
    await expect(participant.getByRole('dialog')).toContainText('Jl. Pengujian No. 10');
    await expect(participant.getByRole('link', { name: 'Buka Google Maps' })).toHaveAttribute(
      'href',
      'https://maps.google.com/',
    );
    await participant.screenshot({
      path: 'test-results/revision-villa-modal-mobile.png',
      fullPage: true,
    });
    await participant.getByRole('button', { name: 'Tutup', exact: true }).click();
    await participant.getByRole('button', { name: 'Pilih villa' }).click();
    await participant.getByRole('button', { name: 'Lanjut', exact: true }).click();
    await participant.getByRole('button', { name: 'Mobil', exact: true }).click();
    await expect(participant.getByLabel('Nama pemilik kendaraan')).toHaveValue('Teman E2E');
    await expect(participant.getByLabel('Nama driver')).toHaveValue('Teman E2E');
    await participant.getByRole('button', { name: 'Lanjut', exact: true }).click();
    await expect(participant.getByRole('heading', { name: 'Periksa jawaban' })).toBeVisible();
    expect((await db.from('participants').select('id').eq('event_id', eventId)).data).toEqual([]);
    await participant.getByRole('button', { name: 'Kirim jawaban' }).click();
    await expect(participant).toHaveURL(/dashboard$/);
    await expect(participant.getByRole('heading', { name: /Terima kasih/ })).toBeVisible();
    const { data: p } = await db.from('participants').select('*').eq('event_id', eventId).single();
    expect(p.whatsapp).toBe('6281234567890');
    expect(p.vehicle_owner).toBe('Teman E2E');
    expect(p.vehicle_driver).toBe('Teman E2E');
    expect(p.vehicle_capacity).toBe(5);
    await expect(
      participant.getByText('1 dari 1 peserta bisa di kedua hari. 2 hari, 1 malam.'),
    ).toBeVisible();
    await expect(participant.getByAltText('Cover Villa E2E')).toHaveAttribute('src', starredSrc!);
    await expect(participant.getByRole('heading', { name: 'Sudah mengisi' })).toBeVisible();
    await participant.screenshot({
      path: 'test-results/revision-results-mobile.png',
      fullPage: true,
    });
    expect(
      await participant.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const cookies = await participantContext.cookies();
    const cookie = cookies.find((c) => c.name === `mp_${eventId}`)!;
    expect(cookie.httpOnly).toBe(true);
    expect(p.access_token_hash).not.toBe(cookie.value);
    // A fresh browser knowing the name cannot replace the response or read WhatsApp.
    const outsider = await browser.newContext({ baseURL: appUrl });
    const outsiderPage = await outsider.newPage();
    await outsiderPage.goto(`/e/${slug}/dashboard`);
    await expect(outsiderPage).toHaveURL(new RegExp(`/e/${slug}$`));
    const { data: dates } = await db.from('event_dates').select('id').eq('event_id', eventId);
    const { data: villas } = await db.from('villas').select('id').eq('event_id', eventId);
    const duplicate = await outsider.request.post(`/api/events/${slug}/stage-1`, {
      headers: { Origin: appUrl },
      data: {
        name: 'Teman E2E',
        whatsapp: '081299999999',
        vehicle_type: 'NONE',
        dates: dates!.map((d) => d.id),
        villa_id: villas![0].id,
      },
    });
    expect(duplicate.status()).toBe(409);
    await outsiderPage.getByRole('link', { name: 'Ikut makrab' }).click();
    await outsiderPage.getByLabel('Nama kamu').fill('Teman E2E');
    await outsiderPage.getByLabel('Nomor WhatsApp').fill('081299999999');
    await outsiderPage.getByRole('button', { name: 'Lanjut', exact: true }).click();
    await expect(
      outsiderPage.getByRole('alert').filter({ hasText: 'Nama ini sudah terdaftar' }),
    ).toBeVisible();
    await outsiderPage.goto(`/e/${slug}/p/${cookie.value}`);
    await outsiderPage.getByRole('button', { name: 'Buka jawaban saya' }).click();
    await expect(outsiderPage).toHaveURL(/dashboard$/);
    await expect(
      outsiderPage.getByRole('heading', { name: /Terima kasih, Teman E2E/ }),
    ).toBeVisible();
    await outsider.close();
    await page.reload();
    await expect(page.getByRole('heading', { name: name, exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/revision-admin-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Tutup Stage 1' }).click();
    await page.getByRole('button', { name: 'Ya, ubah fase' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Sedang difinalisasi', { exact: true })).toBeVisible();
    const closed = await participant.request.post(`/api/events/${slug}/stage-1`, {
      headers: { Origin: appUrl },
      data: {
        name: 'Teman E2E',
        whatsapp: '081234567890',
        vehicle_type: 'CAR',
        dates: [],
        villa_id: villas![0].id,
      },
    });
    expect(closed.ok()).toBe(false);
    await page.getByRole('link', { name: 'Transport', exact: true }).click();
    await page.getByLabel('Pemilik', { exact: true }).selectOption(p.id);
    await expect(page.getByLabel('Label', { exact: true })).toHaveValue('Mobil Teman E2E');
    await expect(page.getByLabel('Driver', { exact: true })).toHaveValue(p.id);
    await page.getByRole('button', { name: 'Tambahkan kendaraan' }).click();
    await expect(page.getByRole('heading', { name: /Mobil Teman E2E/ })).toBeVisible();
    await page.getByRole('link', { name: 'Ringkasan', exact: true }).click();
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
    await page.getByLabel('Biaya per orang').fill('350000');
    await page.getByLabel('Nama bank').fill('BCA');
    await page.getByLabel('Nomor rekening').fill('1234567890');
    await page.getByLabel('Nama pemilik rekening').fill('E2E Organizer');
    await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
    await page.getByRole('button', { name: 'Simpan keputusan final' }).click();
    await expect(page.getByText('Perubahan tersimpan.')).toBeVisible();
    await page.getByRole('button', { name: 'Publish Stage 2', exact: true }).click();
    await page.getByRole('button', { name: 'Ya, ubah fase' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Siap berangkat', { exact: true })).toBeVisible();
    await participant.reload();
    await expect(participant).toHaveURL(/stage-2$/);
    await expect(
      participant.getByRole('heading', { name: 'Rencana final', exact: true }),
    ).toBeVisible();
    const oversize = await participant.request.post('/api/uploads', {
      headers: { Origin: appUrl },
      data: {
        action: 'sign',
        kind: 'payment',
        event_id: eventId,
        mime: 'image/png',
        size: 5242881,
      },
    });
    expect(oversize.status()).toBe(400);
    const badFile = Buffer.from('<script>not an image</script>');
    const intentResponse = await participant.request.post('/api/uploads', {
      headers: { Origin: appUrl },
      data: {
        action: 'sign',
        kind: 'payment',
        event_id: eventId,
        mime: 'image/png',
        size: badFile.length,
      },
    });
    expect(intentResponse.ok()).toBe(true);
    const intent = await intentResponse.json();
    const storageClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const badUpload = await storageClient.storage
      .from(intent.bucket)
      .uploadToSignedUrl(intent.path, intent.token, badFile, { contentType: 'image/png' });
    expect(badUpload.error).toBeNull();
    const invalidCommit = await participant.request.post('/api/uploads', {
      headers: { Origin: appUrl },
      data: { action: 'complete', intent: intent.intent },
    });
    expect(invalidCommit.status()).toBe(400);
    expect((await db.from('payments').select('id').eq('participant_id', p.id)).data).toEqual([]);
    await participant
      .getByLabel('Bukti pembayaran', { exact: true })
      .setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: png });
    await expect(participant).toHaveURL(/thank-you$/);
    await expect(participant.getByRole('heading', { name: /Terima kasih/ })).toBeVisible();
    const { data: payment } = await db
      .from('payments')
      .select('*')
      .eq('participant_id', p.id)
      .single();
    expect(payment.status).toBe('PENDING');
    const publicProof = await participant.request.get(
      `${url}/storage/v1/object/public/payment-proofs/${payment.proof_storage_path}`,
    );
    expect(publicProof.ok()).toBe(false);
    await page.getByRole('link', { name: 'Pembayaran', exact: true }).click();
    const preview = await page.request.get(`/api/admin/payments/${payment.id}`);
    expect(preview.ok()).toBe(true);
    expect((await page.request.get((await preview.json()).url)).ok()).toBe(true);
    await page.getByRole('button', { name: 'Tolak', exact: true }).click();
    await expect(page.getByText('REJECTED', { exact: true })).toBeVisible();
    await participant.goto(`/e/${slug}/stage-2`);
    await expect(participant.getByText('Bukti kurang jelas', { exact: true })).toBeVisible();
    await participant
      .getByLabel('Bukti pembayaran', { exact: true })
      .setInputFiles({ name: 'proof-new.png', mimeType: 'image/png', buffer: png });
    await expect(participant).toHaveURL(/thank-you$/);
    await page.reload();
    await page.getByRole('button', { name: 'Verifikasi', exact: true }).click();
    await expect(page.getByText('VERIFIED', { exact: true })).toBeVisible();
    const rotated = await page.request.post(`/api/admin/events/${eventId}`, {
      headers: { Origin: appUrl },
      data: { action: 'rotate_token', data: { id: p.id } },
    });
    expect(rotated.ok()).toBe(true);
    const newAccess = (await rotated.json()).access_url;
    await participant.goto(`/e/${slug}/stage-2`);
    await expect(participant).toHaveURL(new RegExp(`/e/${slug}$`));
    await participant.goto(newAccess);
    await participant.getByRole('button', { name: 'Buka jawaban saya' }).click();
    await expect(participant).toHaveURL(/stage-2$/);
    await page.getByRole('button', { name: 'Selesaikan acara', exact: true }).click();
    await page.getByRole('button', { name: 'Ya, ubah fase' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.badge-COMPLETED')).toBeVisible();
    await participant.goto(`/e/${slug}/stage-2`);
    await expect(participant.getByRole('heading', { name: 'Acara selesai' })).toBeVisible();
    await expect(participant.getByLabel('Bukti pembayaran', { exact: true })).toHaveCount(0);
    const lockedUpload = await participant.request.post('/api/uploads', {
      headers: { Origin: appUrl },
      data: {
        action: 'sign',
        kind: 'payment',
        event_id: eventId,
        mime: 'image/png',
        size: png.length,
      },
    });
    expect(lockedUpload.ok()).toBe(false);
    await page.getByRole('button',{name:'Arsipkan acara',exact:true}).click();
    await page.getByRole('button',{name:'Ya, ubah fase'}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.badge-ARCHIVED')).toBeVisible();
    for (const target of ['Selesai', 'Pembayaran', 'Finalisasi', 'Voting', 'Draft']) {
      await page.getByRole('button', { name: `Kembali ke ${target}`, exact: true }).click();
      await page.getByRole('button', { name: 'Ya, ubah fase' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    const { data: retained } = await db.from('participants').select('id').eq('event_id', eventId);
    expect(retained).toHaveLength(1);
    expect(
      (await db.from('payments').select('status').eq('event_id', eventId)).data?.[0].status,
    ).toBe('VERIFIED');
    expect(
      (await db.from('event_phase_history').select('id').eq('event_id', eventId)).data,
    ).toHaveLength(10);
    expect(
      (await db.from('events').select('final_end_date').eq('id', eventId).single()).data
        ?.final_end_date,
    ).toBe(endText);
    expect(consoleErrors).toEqual([]);
  } finally {
    await participantContext?.close();
    if (eventId) {
      const { data: intents } = await db
        .from('upload_intents')
        .select('kind,path')
        .eq('event_id', eventId);
      for (const kind of ['media', 'payment']) {
        const paths = (intents || []).filter((i) => i.kind === kind).map((i) => i.path);
        if (paths.length)
          await db.storage.from(kind === 'media' ? 'villa-media' : 'payment-proofs').remove(paths);
      }
      await db.from('events').delete().eq('id', eventId);
    }
    await db.auth.admin.deleteUser(uid);
  }
});

test('RLS, RPC isolation, transaction rollback, capacity and token rotation', async () => {
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const users: string[] = [];
  const events: string[] = [];
  async function actor(label: string) {
    const email = `${label}-${Date.now()}@makrab.test`;
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(error).toBeNull();
    users.push(data.user!.id);
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    await client.auth.signInWithPassword({ email, password });
    return client;
  }
  try {
    const a = await actor('alice');
    const b = await actor('bob');
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    async function act(client: typeof a, id: string | null, action: string, data: object) {
      return client.rpc('admin_action', { p_event: id, p_action: action, p_data: data });
    }
    const { data: e } = await act(a, null, 'create', {
      name: 'Security event',
      slug: `security-${Date.now()}`,
      description: '',
      stage1_deadline: '',
    });
    events.push(e);
    expect((await b.from('events').select('*').eq('id', e)).data).toEqual([]);
    expect((await act(b, e, 'settings', { name: 'Hacked' })).error).toBeTruthy();
    expect((await anon.from('events').select('*')).error).toBeTruthy();
    expect(
      (
        await anon.rpc('submit_stage1', {
          p_event: e,
          p_hash: 'x'.repeat(64),
          p_existing_hash: null,
          p_data: {},
        })
      ).error,
    ).toBeTruthy();
    expect(
      (await a.from('events').update({ status: 'STAGE_2_OPEN' }).eq('id', e)).error,
    ).toBeTruthy();
    await act(a, e, 'dates', { dates: ['2027-01-01', '2027-01-02'] });
    const { data: vid } = await act(a, e, 'villa', {
      name: 'Security villa',
      description: '',
      price: 1,
      capacity: 10,
      address: '',
      google_maps_url: '',
      facilities: [],
      notes: '',
      active: true,
      sort_order: 0,
    });
    await act(a, e, 'status', { status: 'STAGE_1_OPEN' });
    const { data: ds } = await db.from('event_dates').select('id').eq('event_id', e);
    const hash = () =>
      createHmac('sha256', process.env.PARTICIPANT_TOKEN_SECRET!)
        .update(randomBytes(32))
        .digest('hex');
    const { data: other } = await act(b, null, 'create', {
      name: 'Other event',
      slug: `other-${Date.now()}`,
      description: '',
      stage1_deadline: '',
    });
    events.push(other);
    await act(b, other, 'dates', { dates: ['2027-01-02'] });
    const { data: otherDs } = await db.from('event_dates').select('id').eq('event_id', other);
    const body = {
      name: 'Rollback participant',
      whatsapp: '6281234567890',
      vehicle_type: 'CAR',
      villa_id: vid,
      dates: [otherDs![0].id],
    };
    const invalid = await db.rpc('submit_stage1', {
      p_event: e,
      p_hash: hash(),
      p_existing_hash: null,
      p_data: body,
    });
    expect(invalid.error).toBeTruthy();
    expect((await db.from('participants').select('id').eq('event_id', e)).data).toHaveLength(0);
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const { data: pid, error } = await db.rpc('submit_stage1', {
        p_event: e,
        p_hash: hash(),
        p_existing_hash: null,
        p_data: { ...body, name: `Person ${i}`, dates: ds!.map((d) => d.id) },
      });
      expect(error).toBeNull();
      ids.push(pid);
    }
    expect((await b.from('participants').select('*').eq('event_id', e)).data).toEqual([]);
    expect((await b.from('event_phase_history').select('*').eq('event_id',e)).data).toEqual([]);
    expect((await a.from('event_phase_history').select('*').eq('event_id',e)).data).toHaveLength(1);
    expect((await act(b,e,'status',{status:'DRAFT'})).error).toBeTruthy();
    await act(a, e, 'status', { status: 'STAGE_1_CLOSED' });
    const { data: gid, error: groupError } = await act(a, e, 'group', {
      type: 'MOTORCYCLE',
      label: 'Motor',
      capacity: 2,
      driver_participant_id: ids[0],
      owner_participant_id: ids[0],
    });
    expect(groupError).toBeNull();
    const race = await Promise.all([
      act(a, e, 'assign', { participant_id: ids[1], group_id: gid }),
      act(a, e, 'assign', { participant_id: ids[2], group_id: gid }),
    ]);
    expect(race.filter((r) => !r.error)).toHaveLength(1);
    expect(
      (await db.from('transport_members').select('*').eq('transport_group_id', gid)).data,
    ).toHaveLength(2);
    const token = hash();
    await act(a, e, 'rotate_token', { id: ids[0], hash: token });
    expect(
      (await db.from('participants').select('access_token_hash').eq('id', ids[0]).single()).data
        ?.access_token_hash,
    ).toBe(token);
    expect((await act(a, e, 'status', { status: 'STAGE_2_OPEN' })).error).toBeTruthy();
  } finally {
    for (const id of events) await db.from('events').delete().eq('id', id);
    for (const id of users) await db.auth.admin.deleteUser(id);
  }
});
