import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHmac } from 'node:crypto';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
test('participants claim seats atomically, switch safely, and stale payment amounts are rejected', async ({
  browser,
  page,
}) => {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const password = 'E2eMakrab2026!';
  const suffix = Date.now();
  const email = `seats-${suffix}@makrab.test`;
  const { data: user, error: err } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(err).toBeNull();
  const owner = createClient(url, anon, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
  let eid = '';
  let other = '';
  async function act(action: string, data: object, event = eid) {
    const r = await owner.rpc('admin_action', {
      p_event: event || null,
      p_action: action,
      p_data: data,
    });
    expect(r.error).toBeNull();
    return r.data;
  }
  try {
    const slug = `seats-${suffix}`;
    eid = await act('create', {
      name: 'Akhir pekan di Bandung',
      slug,
      description: 'Perjalanan dua hari bersama teman.',
      stage1_deadline: '',
    });
    await act('dates', { dates: ['2027-01-01', '2027-01-02'] });
    const villa = await act('villa', {
      name: 'Rumah Kebun',
      description: 'Penginapan untuk akhir pekan.',
      price: 2000000,
      capacity: 10,
      address: 'Bandung',
      google_maps_url: '',
      facilities: ['Dapur', 'Taman'],
      notes: '',
      active: true,
      sort_order: 0,
    });
    await act('status', { status: 'STAGE_1_OPEN' });
    const { data: dates } = await db.from('event_dates').select('id').eq('event_id', eid);
    const ids: string[] = [];
    const tokens: string[] = [];
    for (const name of ['Raka', 'Nadia', 'Maura']) {
      const token = randomBytes(32).toString('base64url');
      tokens.push(token);
      const hash = createHmac('sha256', process.env.PARTICIPANT_TOKEN_SECRET!)
        .update(token)
        .digest('hex');
      const { data, error } = await db.rpc('submit_stage1', {
        p_event: eid,
        p_hash: hash,
        p_existing_hash: null,
        p_data: {
          name,
          whatsapp: '6281234567890',
          vehicle_type: 'NONE',
          villa_id: villa,
          dates: dates!.map((d) => d.id),
        },
      });
      expect(error).toBeNull();
      ids.push(data);
      const context = await browser.newContext({
        baseURL: origin,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await context.addCookies([
        { name: `mp_${eid}`, value: token, url: origin, httpOnly: true, sameSite: 'Lax' },
      ]);
      contexts.push(context);
    }
    await act('status', { status: 'STAGE_1_CLOSED' });
    const group = await act('group', {
      type: 'CAR',
      label: 'Mobil Raka',
      capacity: 2,
      owner_participant_id: ids[0],
      driver_participant_id: ids[0],
    });
    await act('finalize', { final_date: '2027-01-01', final_villa_id: villa });
    await act('billing', {
      cost_per_person: 200000,
      bank_name: 'BCA',
      bank_account_number: '1234567890',
      bank_account_holder: 'Raka',
      payment_note: 'Transfer sesuai tagihan.',
      stage2_deadline: '',
    });
    // Publishing no longer requires admins to assign every passenger.
    await act('status', { status: 'STAGE_2_OPEN' });
    const p1 = await contexts[1].newPage();
    await p1.goto(`/e/${slug}/stage-2`);
    await expect(p1.getByRole('button', { name: 'Ikut Mobil Raka' })).toBeVisible();
    await p1.getByRole('button', { name: 'Ikut Mobil Raka' }).click();
    await expect(p1.getByRole('button', { name: 'Kendaraanmu', exact: true })).toBeVisible();
    await p1.screenshot({ path: 'test-results/transport-stage2-mobile.png', fullPage: true });
    expect(await p1.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await p1.getByRole('button', { name: 'Lepas pilihan transport' }).click();
    await expect(p1.getByRole('button', { name: 'Ikut Mobil Raka' })).toBeEnabled();
    const request = (i: number, data: object) =>
      contexts[i].request.post(`/api/events/${slug}/transport`, {
        headers: { Origin: origin },
        data,
      });
    const race = await Promise.all([
      request(1, { group_id: group }),
      request(2, { group_id: group }),
    ]);
    expect(race.filter((r) => r.ok())).toHaveLength(1);
    const winner = race[0].ok() ? 1 : 2;
    const loser = winner === 1 ? 2 : 1;
    expect(
      (await db.from('transport_members').select('*').eq('transport_group_id', group)).data,
    ).toHaveLength(2);
    expect((await request(0, { group_id: null, independent: true })).ok()).toBe(false);
    expect((await request(winner, { group_id: null, independent: true })).ok()).toBe(true);
    expect((await request(loser, { group_id: group })).ok()).toBe(true);
    // Switching into a full vehicle must not release the participant's existing seat.
    const before = (
      await db
        .from('transport_members')
        .select('transport_group_id')
        .eq('participant_id', ids[winner])
        .single()
    ).data;
    expect((await request(winner, { group_id: group })).ok()).toBe(false);
    expect(
      (
        await db
          .from('transport_members')
          .select('transport_group_id')
          .eq('participant_id', ids[winner])
          .single()
      ).data,
    ).toEqual(before);
    other = await act(
      'create',
      {
        name: 'Private event',
        slug: `other-seats-${suffix}`,
        description: '',
        stage1_deadline: '',
      },
      '',
    );
    const { data: foreign } = await db
      .from('transport_groups')
      .insert({ event_id: other, type: 'INDEPENDENT', label: 'Private ride', capacity: 1 })
      .select('id')
      .single();
    expect((await request(winner, { group_id: foreign!.id })).ok()).toBe(false);
    const stranger = await browser.newContext({ baseURL: origin });
    contexts.push(stranger);
    expect(
      (
        await stranger.request.post(`/api/events/${slug}/transport`, {
          headers: { Origin: origin },
          data: { group_id: group },
        })
      ).status(),
    ).toBe(401);
    const anonymous = createClient(url, anon, { auth: { persistSession: false } });
    expect(
      (await anonymous.rpc('choose_transport', { p_event: eid, p_hash: 'invalid', p_group: group }))
        .error,
    ).toBeTruthy();
    const allSeats = await contexts[winner].request.get(`/api/events/${slug}/transport`);
    const roster = await allSeats.json();
    expect(
      roster.participants.every(
        (p: Record<string, unknown>) => !('whatsapp' in p) && !('access_token_hash' in p),
      ),
    ).toBe(true);
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page).toHaveURL(/admin\/events$/);
    await page.goto(`/admin/events/${eid}`);
    await expect(page.getByRole('heading', { name: 'Teman seperjalanan' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ketersediaan peserta' })).toHaveCount(0);
    const ride = page
      .locator('.ride-card')
      .filter({ has: page.getByRole('heading', { name: 'Mobil Raka' }) });
    await expect(ride).toContainText('Raka');
    await expect(ride).toContainText(loser === 1 ? 'Nadia' : 'Maura');
    await page.screenshot({ path: 'test-results/transport-admin-desktop.png', fullPage: true });
    await page.getByRole('link', { name: 'Pembayaran', exact: true }).click();
    await expect(page.locator('.payment-row')).toHaveCount(3);
    await expect(page.locator('.money-stat.remaining')).toContainText('600.000');
    // A price change between signing and committing must not stamp the new amount on an old proof.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=',
      'base64',
    );
    const sign = await contexts[1].request.post('/api/uploads', {
      headers: { Origin: origin },
      data: {
        action: 'sign',
        kind: 'payment',
        event_id: eid,
        mime: 'image/png',
        size: png.length,
        expected_amount: 200000,
      },
    });
    expect(sign.ok()).toBe(true);
    const intent = await sign.json();
    await act('billing', {
      cost_per_person: 250000,
      bank_name: 'BCA',
      bank_account_number: '1234567890',
      bank_account_holder: 'Raka',
      payment_note: '',
      stage2_deadline: '',
    });
    expect(
      (
        await anonymous.storage
          .from(intent.bucket)
          .uploadToSignedUrl(intent.path, intent.token, png, { contentType: 'image/png' })
      ).error,
    ).toBeNull();
    const commit = await contexts[1].request.post('/api/uploads', {
      headers: { Origin: origin },
      data: { action: 'complete', intent: intent.intent },
    });
    expect(commit.status()).toBe(400);
    expect((await commit.json()).error).toContain('Nominal berubah');
    expect((await db.from('payments').select('id').eq('event_id', eid)).data).toHaveLength(0);
    await act('status', { status: 'COMPLETED' });
    expect((await request(loser, { group_id: null })).ok()).toBe(false);
  } finally {
    for (const c of contexts) await c.close();
    if (eid) {
      const { data: intents } = await db.from('upload_intents').select('path').eq('event_id', eid);
      if (intents?.length)
        await db.storage.from('payment-proofs').remove(intents.map((i) => i.path));
      await db.from('events').delete().eq('id', eid);
    }
    if (other) await db.from('events').delete().eq('id', other);
    await db.auth.admin.deleteUser(user.user!.id);
  }
});
