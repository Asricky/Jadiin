import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createHmac, randomBytes } from 'node:crypto';

test('new and existing participants confirm details before private payment upload', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const suffix = Date.now();
  const slug = `payment-registration-${suffix}`;
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const hash = (token: string) =>
    createHmac('sha256', process.env.PARTICIPANT_TOKEN_SECRET!).update(token).digest('hex');
  const { data: user, error: userError } = await db.auth.admin.createUser({
    email: `payment-registration-${suffix}@makrab.test`,
    password: 'E2eMakrab2026!',
    email_confirm: true,
  });
  expect(userError).toBeNull();
  let eventId = '';
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=',
    'base64',
  );
  try {
    const { data: event, error: eventError } = await db
      .from('events')
      .insert({
        owner_id: user.user!.id,
        name: 'Pendaftaran susulan',
        slug,
        status: 'DRAFT',
        cost_per_person: 150000,
        bank_name: 'BCA',
        bank_account_number: '1234567890',
        bank_account_holder: 'Organizer',
      })
      .select('id')
      .single();
    expect(eventError).toBeNull();
    eventId = event!.id;
    const { error: datesError } = await db.from('event_dates').insert([
      { event_id: eventId, date: '2027-09-09' },
      { event_id: eventId, date: '2027-09-10' },
    ]);
    expect(datesError).toBeNull();
    const { data: villa, error: villaError } = await db
      .from('villas')
      .insert({
        event_id: eventId,
        name: 'Hanami Test Villa',
        cover_path: '/villas/hanami/pool-projector.jpg',
      })
      .select('id')
      .single();
    expect(villaError).toBeNull();
    expect(
      (
        await db
          .from('events')
          .update({ status: 'STAGE_2_OPEN', final_villa_id: villa!.id, final_date: '2027-09-09' })
          .eq('id', eventId)
      ).error,
    ).toBeNull();
    const token = randomBytes(32).toString('base64url');
    const { data: existing, error: participantError } = await db
      .from('participants')
      .insert({
        event_id: eventId,
        name: 'Peserta Lama',
        whatsapp: '6281234567890',
        vehicle_type: 'CAR',
        vehicle_owner: 'Peserta Lama',
        vehicle_driver: 'Peserta Lama',
        vehicle_capacity: 5,
        access_token_hash: hash(token),
      })
      .select('id')
      .single();
    expect(participantError).toBeNull();
    const oldContext = await browser.newContext();
    contexts.push(oldContext);
    await oldContext.addCookies([{ name: `mp_${eventId}`, value: token, url: origin }]);
    const oldPage = await oldContext.newPage();
    const earlyUpload = await oldContext.request.post(`${origin}/api/uploads`, {
      headers: { Origin: origin },
      data: {
        action: 'sign',
        event_id: eventId,
        kind: 'payment',
        expected_amount: 150000,
        mime: 'image/png',
        size: png.length,
      },
    });
    expect(earlyUpload.status()).toBe(400);
    expect((await earlyUpload.json()).error).toContain('Konfirmasi nama');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/e/${slug}`);
    await page.getByRole('link', { name: 'Daftar & bayar' }).click();
    await expect(page).toHaveURL(/stage-2$/);
    await expect(page.getByLabel('Bukti pembayaran', { exact: true })).toHaveCount(0);
    await page.getByLabel('Nama lengkap', { exact: true }).fill('Peserta Baru');
    await page.getByLabel('Nomor WhatsApp').fill('081234567891');
    await page.getByLabel('Konfirmasi kendaraan').selectOption('MOTORCYCLE');
    await expect(page.getByLabel('Kapasitas termasuk pengemudi')).toHaveValue('2');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Konfirmasi & lanjut ke pembayaran' }).click();
    await expect(page.getByLabel('Bukti pembayaran', { exact: true })).toBeVisible();
    const { data: newcomer } = await db
      .from('participants')
      .select('*')
      .eq('event_id', eventId)
      .eq('name', 'Peserta Baru')
      .single();
    expect(newcomer.stage1_submitted_at).toBeNull();
    expect(newcomer.payment_details_confirmed_at).toBeTruthy();
    expect(newcomer.vehicle_type).toBe('MOTORCYCLE');
    expect(newcomer.vehicle_capacity).toBe(2);
    expect(newcomer.whatsapp).toBe('6281234567891');
    await page
      .getByLabel('Bukti pembayaran', { exact: true })
      .setInputFiles({ name: 'new-proof.png', mimeType: 'image/png', buffer: png });
    await expect(page).toHaveURL(/thank-you$/);

    const duplicateContext = await browser.newContext();
    contexts.push(duplicateContext);
    const duplicate = await duplicateContext.request.post(
      `${origin}/api/events/${slug}/payment-participant`,
      {
        headers: { Origin: origin },
        data: {
          name: ' Peserta   Baru ',
          whatsapp: '081234567892',
          vehicle_type: 'NONE',
          confirmed: true,
        },
      },
    );
    expect(duplicate.status()).toBe(409);
    const unconfirmed = await duplicateContext.request.post(
      `${origin}/api/events/${slug}/payment-participant`,
      {
        headers: { Origin: origin },
        data: {
          name: 'Tanpa Konfirmasi',
          whatsapp: '081234567892',
          vehicle_type: 'NONE',
          confirmed: false,
        },
      },
    );
    expect(unconfirmed.status()).toBe(400);

    await oldPage.goto(`/e/${slug}/stage-2`);
    await expect(oldPage.getByLabel('Nama lengkap', { exact: true })).toHaveValue('Peserta Lama');
    await expect(oldPage.getByLabel('Konfirmasi kendaraan')).toHaveValue('CAR');
    await oldPage.getByLabel('Nama lengkap', { exact: true }).fill('Peserta Lama Diperbarui');
    await oldPage.getByLabel('Konfirmasi kendaraan').selectOption('NONE');
    await oldPage.getByRole('checkbox').check();
    await oldPage.getByRole('button', { name: 'Konfirmasi & lanjut ke pembayaran' }).click();
    await expect(oldPage.getByLabel('Bukti pembayaran', { exact: true })).toBeVisible();
    await oldPage
      .getByLabel('Bukti pembayaran', { exact: true })
      .setInputFiles({ name: 'old-proof.png', mimeType: 'image/png', buffer: png });
    await expect(oldPage).toHaveURL(/thank-you$/);
    const { data: updated } = await db
      .from('participants')
      .select('*')
      .eq('id', existing!.id)
      .single();
    expect(updated.name).toBe('Peserta Lama Diperbarui');
    expect(updated.vehicle_type).toBe('NONE');
    expect(updated.vehicle_owner).toBeNull();
    expect(updated.vehicle_capacity).toBeNull();
    expect(updated.stage1_submitted_at).toBeTruthy();
    const { data: payments } = await db
      .from('payments')
      .select('participant_id,status')
      .eq('event_id', eventId);
    expect(payments).toHaveLength(2);
    expect(payments?.find((p) => p.participant_id === existing!.id)?.status).toBe('PENDING');
    expect(payments?.find((p) => p.participant_id === newcomer.id)?.status).toBe('PENDING');
    expect(
      (
        await db
          .from('participants')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
      ).count,
    ).toBe(2);

    await db
      .from('events')
      .update({ stage2_deadline: new Date(Date.now() - 60000).toISOString() })
      .eq('id', eventId);
    const closed = await duplicateContext.request.post(
      `${origin}/api/events/${slug}/payment-participant`,
      {
        headers: { Origin: origin },
        data: {
          name: 'Terlambat',
          whatsapp: '081234567893',
          vehicle_type: 'NONE',
          confirmed: true,
        },
      },
    );
    expect(closed.status()).toBe(400);
    expect((await closed.json()).error).toContain('ditutup');
  } finally {
    for (const context of contexts) await context.close();
    if (eventId) {
      const { data: proofs } = await db
        .from('payments')
        .select('proof_storage_path')
        .eq('event_id', eventId);
      if (proofs?.length)
        await db.storage.from('payment-proofs').remove(proofs.map((p) => p.proof_storage_path));
      await db.from('events').delete().eq('id', eventId);
    }
    await db.auth.admin.deleteUser(user.user!.id);
  }
});
