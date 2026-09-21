import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHmac } from 'node:crypto';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.PARTICIPANT_TOKEN_SECRET)
  throw new Error('Lengkapi .env.local dahulu.');
if (
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) &&
  process.env.ALLOW_REMOTE_SEED !== 'true'
)
  throw new Error(
    'Untuk seed project remote khusus demo, set ALLOW_REMOTE_SEED=true. Jangan seed production.',
  );
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const password = process.env.DEMO_PASSWORD || 'MakrabDemo2026!';
const email = 'organizer@makrab.test';
const { data: existing } = await db.auth.admin.listUsers();
let user = existing.users.find((u) => u.email === email);
if (!user) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Asricky' },
  });
  if (error) throw error;
  user = data.user;
}
const admin = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { error: loginError } = await admin.auth.signInWithPassword({ email, password });
if (loginError) throw loginError;
async function act(event, action, data) {
  const r = await admin.rpc('admin_action', { p_event: event, p_action: action, p_data: data });
  if (r.error) throw r.error;
  return r.data;
}
const { data: old } = await db
  .from('events')
  .select('id')
  .eq('slug', 'makrab-cerita-kita-2026')
  .maybeSingle();
if (old) {
  console.log('Demo sudah tersedia: /e/makrab-cerita-kita-2026');
  process.exit(0);
}
const eid = await act(null, 'create', {
  name: 'Makrab Cerita Kita 2026',
  slug: 'makrab-cerita-kita-2026',
  description:
    'Tutup laptop, buka cerita baru. Dua hari di pegunungan, BBQ bareng, dan obrolan yang nggak habis-habis. Yuk, pilih waktu dan tempat favoritmu!',
  stage1_deadline: '',
});
const first = new Date();
first.setDate(first.getDate() + 21);
const dates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(first);
  d.setDate(d.getDate() + i);
  return d.toISOString().slice(0, 10);
});
await act(eid, 'dates', { dates });
const villas = [];
for (const [name, price, capacity, facilities] of [
  ['Villa Senja', 2500000, 25, ['Kolam renang', 'BBQ', 'Karaoke', 'WiFi']],
  ['Rumah Pinus', 1800000, 20, ['Taman', 'Dapur', 'Api unggun', 'Parkir']],
]) {
  villas.push(
    await act(eid, 'villa', {
      name,
      price,
      capacity,
      facilities,
      description: 'Ruang hangat untuk waktu berkualitas di tengah sejuknya pegunungan.',
      address: 'Lembang, Bandung Barat',
      google_maps_url: 'https://www.google.com/maps/search/?api=1&query=Lembang',
      notes: 'Harga per malam. Konfirmasi ketersediaan ke pengelola.',
      active: true,
      sort_order: villas.length,
    }),
  );
}
await act(eid, 'status', { status: 'STAGE_1_OPEN' });
const { data: ds } = await db.from('event_dates').select('id').eq('event_id', eid).order('date');
for (const [i, name] of [
  'Andi Pratama',
  'Nadia Putri',
  'Bima Saputra',
  'Caca Amelia',
  'Dimas Arya',
  'Rani Safitri',
].entries()) {
  const token = randomBytes(32).toString('base64url');
  const hash = createHmac('sha256', process.env.PARTICIPANT_TOKEN_SECRET)
    .update(token)
    .digest('hex');
  const { error } = await db.rpc('submit_stage1', {
    p_event: eid,
    p_hash: hash,
    p_existing_hash: null,
    p_data: {
      name,
      whatsapp: `62812345000${i}`,
      vehicle_type: ['CAR', 'NONE', 'MOTORCYCLE'][i % 3],
      villa_id: villas[i % 2],
      dates: ds.filter((_, j) => (j + i) % 3 !== 0).map((d) => d.id),
    },
  });
  if (error) throw error;
}
await act(null, 'create', {
  name: 'Weekend Tanpa Deadline',
  slug: 'weekend-tanpa-deadline',
  description: 'Rencana kecil untuk rehat bersama teman kantor.',
  stage1_deadline: '',
});
console.log(
  `Demo siap. Login: ${email}; password: ${process.env.DEMO_PASSWORD ? 'sesuai DEMO_PASSWORD' : 'MakrabDemo2026!'}; event: /e/makrab-cerita-kita-2026`,
);
