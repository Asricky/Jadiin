import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
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
    const recommendation = await act('villa', {
      name: 'Villa Pemandangan',
      description: 'Pilihan rekomendasi organizer.',
      price: 1500000,
      capacity: 12,
      address: 'Lembang',
      google_maps_url: '',
      facilities: ['Teras', 'Dapur'],
      notes: '',
      active: true,
      sort_order: 9,
    });
    expect(
      (await owner.rpc('recommend_villa', { p_event: eid, p_villa: recommendation })).error,
    ).toBeNull();
    const { data: dates } = await db.from('event_dates').select('id').eq('event_id', eid);
    const ids: string[] = [];
    for (const name of ['Raka', 'Nadia', 'Maura']) {
      const context = await browser.newContext({
        baseURL: origin,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      contexts.push(context);
      const submitted = await context.request.post(`/api/events/${slug}/stage-1`, {
        headers: { Origin: origin },
        data: {
          name,
          whatsapp: '6281234567890',
          vehicle_type: name === 'Nadia' ? 'NONE' : 'CAR',
          vehicle_owner: name === 'Maura' ? 'NABIL' : name,
          vehicle_driver: name === 'Maura' ? 'Nabil' : name,
          vehicle_capacity: 2,
          villa_id: villa,
          dates: dates!.map((d) => d.id),
        },
      });
      expect(submitted.ok()).toBe(true);
      const { data: participant, error } = await db
        .from('participants')
        .select('id')
        .eq('event_id', eid)
        .eq('name', name)
        .single();
      expect(error).toBeNull();
      ids.push(participant!.id);
    }
    await act('status', { status: 'STAGE_1_CLOSED' });
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
    const activated = (await db.from('transport_groups').select('*').eq('event_id', eid)).data!;
    expect(activated).toHaveLength(1);
    const group = activated[0].id;
    expect(activated[0].owner_participant_id).toBe(ids[0]);
    const p1 = await contexts[1].newPage();
    await p1.goto(`/e/${slug}/stage-2`);
    await expect(p1.locator(`[data-pending-offer="${ids[2]}"]`)).toContainText('NABIL');
    await expect(p1.locator(`[data-pending-offer="${ids[2]}"]`)).toContainText('belum aktif');
    await expect(p1.locator('.villa-card')).toHaveCount(0);
    await expect(p1.getByRole('region', { name: 'Preview pilihan villa' })).toHaveCount(0);
    await expect(p1.locator('.final-trip-line')).toContainText('Rumah Kebun');
    expect(await p1.locator('#transport').evaluate((el) => el.nextElementSibling?.id)).toBe(
      'payment',
    );
    expect(
      (await db.from('transport_members').select('*').eq('transport_group_id', group)).data,
    ).toHaveLength(1);
    await expect(p1.getByRole('button', { name: 'Ikut Mobil Raka' })).toBeVisible();
    // Actual touch drag, using the handle instead of locking the whole page scroll.
    async function touchDragPassenger(name: string) {
      const grip = p1.getByRole('button', { name: `Geser transport untuk ${name}` });
      await grip.scrollIntoViewIfNeeded();
      const handle = (await grip.boundingBox())!;
      const touch = await contexts[1].newCDPSession(p1);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: handle.x + 20, y: handle.y + 20 }],
      });
      await p1.waitForTimeout(250); // TouchSensor activation threshold.
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: handle.x + 20, y: 45 }],
      });
      await expect
        .poll(async () => {
          const bounds = (await p1
            .locator(`[data-transport-drop="${group}"] .transport-passengers`)
            .boundingBox())!;
          return bounds.y >= 45 && bounds.y + bounds.height / 2 < 780;
        })
        .toBe(true);
      const carBounds = (await p1
        .locator(`[data-transport-drop="${group}"] .transport-passengers`)
        .boundingBox())!;
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: carBounds.x + carBounds.width / 2, y: carBounds.y + carBounds.height / 2 },
        ],
      });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
    }
    await touchDragPassenger('Nadia');
    await expect(p1.getByRole('button', { name: 'Kendaraanmu', exact: true })).toBeVisible();
    await expect(p1.locator('[data-transport-drop="unassigned"]')).not.toContainText('Nadia');
    await p1.reload();
    await expect(
      p1.locator(`[data-transport-drop="${group}"] .transport-passengers`),
    ).toContainText('Nadia');
    await expect(p1.getByLabel('Tujuan transfer', { exact: true })).toBeVisible();
    await expect(p1.locator('.transport-columns')).toBeVisible();
    await p1.screenshot({ path: 'test-results/transport-stage2-mobile.png', fullPage: true });
    expect(await p1.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await p1.getByRole('button', { name: 'Lepas pilihan transport' }).click();
    await expect(p1.getByRole('button', { name: 'Ikut Mobil Raka' })).toBeEnabled();
    const request = (i: number, data: object) =>
      contexts[i].request.post(`/api/events/${slug}/transport`, {
        headers: { Origin: origin },
        data,
      });
    // A valid participant can assign another passenger, but never a reserved driver.
    expect((await request(1, { group_id: group, participant_id: ids[2] })).ok()).toBe(true);
    expect((await request(0, { group_id: null, participant_id: ids[2] })).ok()).toBe(true);
    expect((await request(1, { group_id: null, participant_id: ids[0] })).ok()).toBe(false);
    expect(
      (
        await request(1, {
          group_id: group,
          participant_id: '00000000-0000-4000-8000-000000000001',
        })
      ).ok(),
    ).toBe(false);
    await p1.reload();
    await expect(p1.getByRole('button', { name: 'Geser transport untuk Maura' })).toBeVisible();
    // Nadia's session drags Maura's name, not only its own name.
    await touchDragPassenger('Maura');
    await expect(
      p1.locator(`[data-transport-drop="${group}"] .transport-passengers`),
    ).toContainText('Maura');
    expect((await request(1, { group_id: null, participant_id: ids[2] })).ok()).toBe(true);
    await p1.reload();
    await p1.getByLabel('Tambah penumpang ke Mobil Raka', { exact: true }).selectOption(ids[2]);
    await expect(
      p1.locator(`[data-transport-drop="${group}"] .transport-passengers`),
    ).toContainText('Maura');
    expect((await request(1, { group_id: null, participant_id: ids[2] })).ok()).toBe(true);
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
    const { data: foreignPerson, error: foreignError } = await db
      .from('participants')
      .insert({
        event_id: other,
        name: 'Other event passenger',
        whatsapp: '6281234567888',
        access_token_hash: randomBytes(32).toString('hex'),
        vehicle_type: 'NONE',
      })
      .select('id')
      .single();
    expect(foreignError).toBeNull();
    expect(
      (await request(winner, { group_id: group, participant_id: foreignPerson!.id })).ok(),
    ).toBe(false);
    expect(
      (
        await db.rpc('assign_transport', {
          p_event: eid,
          p_hash: 'invalid',
          p_group: group,
          p_participant: ids[loser],
        })
      ).error,
    ).toBeTruthy();
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
      (await anonymous.rpc('recommend_villa', { p_event: eid, p_villa: recommendation })).error,
    ).toBeTruthy();
    expect(
      (await owner.rpc('recommend_villa', { p_event: other, p_villa: recommendation })).error,
    ).toBeTruthy();
    expect(
      (await anonymous.rpc('assign_transport', { p_event: eid, p_hash: 'invalid', p_group: group }))
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
    await page.goto(`/admin/events/${eid}/villas`);
    await page.getByRole('button', { name: 'Jadikan rekomendasi utama', exact: true }).click();
    await expect(page.locator('.villa-card').first()).toContainText('Rumah Kebun');
    await p1.reload();
    await expect(p1.locator('.villa-card')).toHaveCount(0);
    expect(
      (await db.from('events').select('final_villa_id').eq('id', eid).single()).data
        ?.final_villa_id,
    ).toBe(villa);
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
    // A late joiner gets a private session, no invented Stage 1 answers, and a real seat.
    await page.getByRole('link', { name: 'Transport', exact: true }).click();
    await page.getByRole('button', { name: 'Tambah peserta', exact: true }).click();
    await page.getByLabel('Nama peserta susulan', { exact: true }).fill('Dimas Susulan');
    await page.getByLabel('WhatsApp peserta susulan', { exact: true }).fill('081234567899');
    const addedResponse = page.waitForResponse(
      (r) => r.url().endsWith(`/api/admin/events/${eid}`) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Simpan peserta susulan' }).click();
    const added = await (await addedResponse).json();
    expect(added.access_url).toContain(`/e/${slug}/p/`);
    await expect(page.getByRole('button', { name: 'Salin link peserta susulan' })).toBeVisible();
    const late = (await db.from('participants').select('*').eq('id', added.id).single()).data!;
    expect(late.stage1_submitted_at).toBeNull();
    expect(
      (await db.from('villa_votes').select('*').eq('participant_id', added.id)).data,
    ).toHaveLength(0);
    await act('assign', { participant_id: ids[loser], group_id: '' });
    await page.reload();
    const chip = page
      .locator('[data-drop-id="unassigned"] .person-chip')
      .filter({ hasText: 'Dimas Susulan' });
    const target = page.locator(`[data-drop-id="${group}"]`);
    await chip.scrollIntoViewIfNeeded();
    const from = (await chip.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 4 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
    await page.mouse.up();
    await expect(target).toContainText('Dimas Susulan');
    await page.screenshot({ path: 'test-results/transport-late-participant.png', fullPage: true });
    await page.getByRole('link', { name: 'Pembayaran', exact: true }).click();
    await expect(page.locator('.payment-row')).toHaveCount(4);
    await page.getByRole('button', { name: 'Tambah metode pembayaran' }).click();
    await page.getByLabel('Bank tambahan', { exact: true }).fill('Mandiri');
    await page.getByLabel('Nomor rekening tambahan', { exact: true }).fill('9876543210');
    await page.getByLabel('Pemilik rekening tambahan', { exact: true }).fill('Panitia Jadiin');
    await page.getByRole('button', { name: 'Simpan metode pembayaran' }).click();
    await expect(page.getByText('9876543210 · a.n. Panitia Jadiin')).toBeVisible();
    const lateContext = await browser.newContext({ baseURL: origin });
    contexts.push(lateContext);
    const latePage = await lateContext.newPage();
    const motorcycle = await act('group', {
      type: 'MOTORCYCLE',
      label: 'Motor teman',
      capacity: 2,
      owner_participant_id: ids[loser],
      driver_participant_id: ids[loser],
    });
    await latePage.goto(added.access_url);
    await latePage.getByRole('button', { name: 'Buka jawaban saya' }).click();
    await expect(latePage).toHaveURL(/stage-2$/);
    expect(
      (await db.from('transport_members').select('*').eq('transport_group_id', motorcycle)).data,
    ).toHaveLength(1);
    async function dragLate(target: string) {
      const targetType = (
        await db.from('transport_groups').select('type').eq('id', target).single()
      ).data!.type;
      const tab = targetType === 'CAR' ? 'Mobil' : 'Motor';
      // Release the current choice before switching the category, then drag from the shared roster.
      if (await latePage.getByRole('button', { name: 'Lepas pilihan transport' }).isVisible()) {
        await latePage.getByRole('button', { name: 'Lepas pilihan transport' }).click();
        await expect(latePage.locator('[data-transport-drop="unassigned"]')).toContainText(
          'Dimas Susulan',
        );
      }
      await latePage.locator('.transport-tabs button').filter({ hasText: tab }).click();
      const chip = latePage.getByRole('button', { name: 'Geser transport untuk Dimas Susulan' });
      await chip.scrollIntoViewIfNeeded();
      const from = (await chip.boundingBox())!,
        to = (await latePage.locator(`[data-transport-drop="${target}"]`).boundingBox())!;
      await latePage.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await latePage.mouse.down();
      await latePage.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, {
        steps: 4,
      });
      await latePage.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
      await latePage.mouse.up();
      await expect(
        latePage.locator(`[data-transport-drop="${target}"] .transport-passengers`),
      ).toContainText('Dimas Susulan');
      expect(
        (await db.from('transport_members').select('*').eq('participant_id', added.id)).data,
      ).toHaveLength(1);
    }
    await dragLate(motorcycle);
    await expect(latePage.locator('[data-transport-drop="unassigned"]')).not.toContainText(
      'Dimas Susulan',
    );
    await latePage.reload();
    await latePage.locator('.transport-tabs button').filter({ hasText: 'Motor' }).click();
    await expect(
      latePage.locator(`[data-transport-drop="${motorcycle}"] .transport-passengers`),
    ).toContainText('Dimas Susulan');
    await latePage.getByRole('button', { name: 'Pilih berangkat mandiri' }).click();
    await expect(latePage.locator('[data-transport-drop="independent"]')).toContainText(
      'Dimas Susulan',
    );
    await expect(latePage.locator('[data-transport-drop="unassigned"]')).not.toContainText(
      'Dimas Susulan',
    );
    await latePage.reload();
    await expect(latePage.getByRole('button', { name: 'Pilihanmu: mandiri' })).toBeVisible();
    await latePage.getByRole('button', { name: 'Batalkan berangkat mandiri' }).click();
    await expect(latePage.locator('[data-transport-drop="unassigned"]')).toContainText(
      'Dimas Susulan',
    );
    await latePage.locator('.transport-tabs button').filter({ hasText: 'Mobil' }).click();
    await latePage.getByRole('button', { name: 'Ikut Mobil Raka' }).click();
    await expect(
      latePage.locator(`[data-transport-drop="${group}"] .transport-passengers`),
    ).toContainText('Dimas Susulan');
    await dragLate(motorcycle);
    expect(await latePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(latePage.locator('.transport-drag-preview')).toHaveCount(0);
    await latePage.screenshot({ path: 'test-results/final-plan-desktop.png', fullPage: true });
    // Same-category and cross-category moves preserve a single assignment.
    for (const type of ['CAR', 'MOTORCYCLE']) {
      const driver = await act('add_participant', {
        name: `Driver ${type} tambahan`,
        whatsapp: '6281234567888',
        vehicle_type: 'NONE',
        hash: randomBytes(32).toString('hex'),
      });
      const extraGroup = await act('group', {
        type,
        label: `${type} tambahan`,
        capacity: 2,
        owner_participant_id: driver,
        driver_participant_id: driver,
      });
      await latePage.reload();
      if (type === 'CAR') {
        await latePage.locator('.transport-tabs button').filter({ hasText: 'Mobil' }).click();
        await latePage.getByRole('button', { name: 'Ikut Mobil Raka' }).click();
        await expect(
          latePage.locator(`[data-transport-drop="${group}"] .transport-passengers`),
        ).toContainText('Dimas Susulan');
      }
      await latePage
        .locator('.transport-tabs button')
        .filter({ hasText: type === 'CAR' ? 'Mobil' : 'Motor' })
        .click();
      await latePage.getByRole('button', { name: `Ikut ${type} tambahan` }).click();
      await expect(
        latePage.locator(`[data-transport-drop="${extraGroup}"] .transport-passengers`),
      ).toContainText('Dimas Susulan');
      expect(
        (await db.from('transport_members').select('*').eq('participant_id', added.id)).data,
      ).toHaveLength(1);
      await latePage.locator('.transport-tabs button').filter({ hasText: 'Motor' }).click();
      await latePage.getByRole('button', { name: 'Ikut Motor teman' }).click();
      await expect(
        latePage.locator(`[data-transport-drop="${motorcycle}"] .transport-passengers`),
      ).toContainText('Dimas Susulan');
    }
    await expect(latePage.getByRole('button', { name: 'Kendaraanmu', exact: true })).toBeVisible();
    expect(
      (
        await db
          .from('transport_members')
          .select('transport_group_id')
          .eq('participant_id', added.id)
          .single()
      ).data?.transport_group_id,
    ).toBe(motorcycle);
    await latePage.goto(`/e/${slug}/stage-2`);
    await latePage.getByLabel('Tujuan transfer', { exact: true }).selectOption('1');
    await expect(latePage.getByRole('heading', { name: '9876543210' })).toBeVisible();
    const selectedMethod = 'Mandiri · 9876543210 · Panitia Jadiin';
    const signLate = await lateContext.request.post('/api/uploads', {
      headers: { Origin: origin },
      data: {
        action: 'sign',
        kind: 'payment',
        event_id: eid,
        mime: 'image/png',
        size: png.length,
        expected_amount: 250000,
        payment_method: selectedMethod,
      },
    });
    expect(signLate.ok()).toBe(true);
    const lateIntent = await signLate.json();
    expect(
      (
        await anonymous.storage
          .from(lateIntent.bucket)
          .uploadToSignedUrl(lateIntent.path, lateIntent.token, png, { contentType: 'image/png' })
      ).error,
    ).toBeNull();
    await act('payment_methods', { methods: [] });
    const staleMethod = await lateContext.request.post('/api/uploads', {
      headers: { Origin: origin },
      data: { action: 'complete', intent: lateIntent.intent },
    });
    expect(staleMethod.status()).toBe(400);
    expect((await staleMethod.json()).error).toContain('Rekening berubah');
    await act('payment_methods', {
      methods: [
        {
          bank_name: 'Mandiri',
          bank_account_number: '9876543210',
          bank_account_holder: 'Panitia Jadiin',
        },
      ],
    });
    await latePage
      .getByLabel('Bukti pembayaran', { exact: true })
      .setInputFiles({ name: 'transfer-mandiri.png', mimeType: 'image/png', buffer: png });
    await expect(latePage).toHaveURL(/thank-you$/);
    await act('payment_methods', { methods: [] });
    expect(
      (await db.from('payments').select('payment_method').eq('participant_id', added.id).single())
        .data?.payment_method,
    ).toBe(selectedMethod);
    expect(
      (
        await anonymous.rpc('admin_action', {
          p_event: eid,
          p_action: 'add_participant',
          p_data: { name: 'Intruder' },
        })
      ).error,
    ).toBeTruthy();
    const motorOwner = await act('add_participant', {
      name: 'Penyedia Motor',
      whatsapp: '6281234567888',
      vehicle_type: 'MOTORCYCLE',
      hash: randomBytes(32).toString('hex'),
    });
    const motorOffer = (
      await db
        .from('transport_groups')
        .select('*')
        .eq('event_id', eid)
        .eq('owner_participant_id', motorOwner)
        .single()
    ).data!;
    expect(motorOffer.type).toBe('MOTORCYCLE');
    expect(
      (await db.from('transport_members').select('*').eq('transport_group_id', motorOffer.id)).data,
    ).toHaveLength(1);
    await latePage.goto(`/e/${slug}/stage-2`);
    await latePage.locator('.transport-tabs button').filter({ hasText: 'Motor' }).click();
    await expect(
      latePage.getByRole('heading', { name: 'Motor Penyedia Motor', exact: true }),
    ).toBeVisible();
    await page.goto(`/admin/events/${eid}/transport`);
    await expect(
      page.getByText('Aktif di form peserta: Motor Penyedia Motor', { exact: true }),
    ).toBeVisible();
    const refreshedRoster = await (
      await contexts[1].request.get(`/api/events/${slug}/transport`)
    ).json();
    expect(
      refreshedRoster.offers.every(
        (p: Record<string, unknown>) => !('whatsapp' in p) && !('access_token_hash' in p),
      ),
    ).toBe(true);
    await act('delete_group', { id: motorOffer.id });
    await act('status', { status: 'STAGE_1_CLOSED' });
    await act('status', { status: 'STAGE_2_OPEN' });
    expect(
      (await db.from('transport_groups').select('id').eq('owner_participant_id', motorOwner)).data,
    ).toHaveLength(0);
    expect(
      (await db.from('transport_groups').select('id').eq('owner_participant_id', ids[0])).data,
    ).toHaveLength(1);
    await act('status', { status: 'COMPLETED' });
    expect(
      (await owner.rpc('recommend_villa', { p_event: eid, p_villa: null })).error,
    ).toBeTruthy();
    expect(
      (
        await owner.rpc('admin_action', {
          p_event: eid,
          p_action: 'payment_methods',
          p_data: { methods: [] },
        })
      ).error,
    ).toBeTruthy();
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
