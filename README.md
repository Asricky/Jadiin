# Makrab Planner

Aplikasi makrab multi-tenant berbasis PRD: organizer memiliki banyak acara, participant mengisi pilihan tanpa akun, organizer memfinalisasi tanggal/villa/transport, lalu peserta mengirim bukti pembayaran private.

Stack: Next.js 16 stable / App Router, React, TypeScript, Tailwind CSS 4, komponen shadcn/ui (Radix + CVA), Lucide, Supabase PostgreSQL/Auth/Storage, React Hook Form + Zod, date-fns, dnd-kit, Vitest, Playwright. Runtime production menggunakan Next.js serverless di Vercel; Docker hanya untuk development dan test lokal.

## Local setup

Prasyarat: Node.js 22+, npm, Docker Desktop untuk Supabase lokal.

Shortcut setelah Supabase hidup: `node scripts/configure-local.mjs` membuat `.env.local` beserta secret random tanpa mencetak keys; file existing tidak ditimpa. Untuk startup ringan gunakan `npx supabase start -x 'studio,imgproxy,edge-runtime,logflare,vector,realtime,postgres-meta'` (kutip daftar pada PowerShell).

```sh
npm ci
npx supabase start
cp .env.example .env.local
npx supabase status
```

Pada PowerShell gunakan `Copy-Item .env.example .env.local`. Isi URL, anon key, dan service-role key dari Supabase lokal ke `.env.local`. Buat token secret dengan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Jangan commit secret.

```sh
npm run seed
npm run dev
```

Buka http://localhost:3000. Studio lokal: http://127.0.0.1:54323; inbox email lokal: http://127.0.0.1:54324. Aplikasi menampilkan petunjuk konfigurasi jika environment belum lengkap; tidak fallback ke data mock.

## Environment variables

| Variable                        | Kegunaan                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL project Supabase                                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key/publishable key untuk Auth dan signed upload                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Secret backend; hanya di modul `server-only`                                 |
| `NEXT_PUBLIC_APP_URL`           | Origin aplikasi persis, tanpa trailing slash. Lokal: `http://localhost:3000` |
| `PARTICIPANT_TOKEN_SECRET`      | Random secret minimal 32 karakter untuk HMAC token participant               |

Mengubah token secret mencabut seluruh sesi/link participant. URL aplikasi dipakai untuk pemeriksaan Origin, redirect Auth, QR, dan recovery link. Preview Vercel memerlukan environment URL yang cocok dengan deployment preview.

## Supabase setup dan migration

Untuk hosted Supabase, buat project baru. Login CLI, link project, lalu jalankan migrasi:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Migrasi ada di `supabase/migrations/`. Untuk mereset **database lokal** dan menerapkan ulang semua migrasi: `npx supabase db reset`, lalu `npm run seed`. Reset menghapus data lokal. Alternatif hosted: jalankan file SQL sesuai urutan melalui SQL Editor.

Di Authentication → URL Configuration, set Site URL ke origin Vercel dan tambahkan redirect `/auth/callback` dan `/auth/callback?next=/reset-password`. Aktifkan konfirmasi email dan konfigurasi SMTP production. Registrasi lokal mengikuti pengaturan `supabase/config.toml`; email reset dapat dibaca lewat inbox lokal. Profil otomatis dibuat melalui trigger Auth.

## RLS dan authorization

- Semua tabel domain mengaktifkan RLS. Organizer hanya dapat membaca baris miliknya melalui `events.owner_id = auth.uid()`; child tables memakai `owns_event(event_id)`.
- Tidak ada akses anonymous ke tabel bisnis atau mutation RPC. Organizer diberi SELECT dan RPC transaksi, **bukan** direct INSERT/UPDATE/DELETE. Ini menjaga validasi lifecycle meskipun seseorang memakai REST Supabase langsung.
- `admin_action` memakai `auth.uid()`, memvalidasi ownership, dan mengunci baris event untuk serialisasi perubahan. Status hanya dapat berpindah sesuai lifecycle. Publikasi Stage 2 membutuhkan final villa/date, bank, biaya, dan transport semua participant.
- Foreign key komposit memastikan tanggal, vote, kendaraan, dan participant berasal dari event yang sama. Unique constraints mencegah nama ganda, multiple votes, multiple transport assignments, dan driver ganda. Kapasitas kendaraan diperiksa dalam transaksi yang mengunci event.
- Submit Stage 1 melalui Route Handler dengan Zod, status/deadline, rate limit database, kemudian RPC atomic untuk participant + availability + vote. Update membutuhkan token yang sesuai. Mengetahui nama tidak memberi akses.
- Token participant random 256 bit, disimpan sebagai HMAC-SHA256, cookie HttpOnly/SameSite=Lax/Secure di production, berlaku 180 hari di browser. Link recovery memakai token yang sama dan tombol konfirmasi; tidak ada mutasi sesi lewat GET. Reset akses organizer mencabut token lama.
- Dashboard participant hanya menampilkan nama dan agregat. WhatsApp, hash token, bukti dan catatan pembayaran peserta lain tidak dikirim ke participant. Link akses sendiri merupakan bearer credential; jangan bagikan. Hindari mencatat URL recovery penuh di logging/analytics. Response memakai `Referrer-Policy: no-referrer`.
- Setiap mutation API memeriksa Origin. Rate limit tersimpan di PostgreSQL agar konsisten antar-instance Vercel; counter lama dibersihkan secara bertahap.

## Storage buckets dan signed upload

Migrasi membuat dua bucket:

| Bucket           | Read                                            | Write                                                |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `villa-media`    | Public (foto villa/cover acara)                 | Signed upload setelah ownership admin diverifikasi   |
| `payment-proofs` | Private; owner RLS atau signed preview 60 detik | Signed upload setelah token participant diverifikasi |

Semua upload dibatasi JPG/PNG/WebP, maksimal **5 MB**, pada Zod dan konfigurasi bucket. SVG/PDF tidak diaktifkan. Server menciptakan path random yang terikat event/participant dan upload intent 10 menit. Browser mengunggah langsung ke Storage memakai `uploadToSignedUrl`; service key tidak pernah dikirim ke browser. Signed upload tidak mengizinkan overwrite. Setelah upload, server membaca object maksimal 5 MB, memeriksa magic bytes dan ukuran aktual terhadap intent, lalu RPC mengunci event/intent, memeriksa status, ownership/token, dan mencatat payment secara atomic. Signed URL Supabase bisa hidup lebih lama daripada intent, tetapi intent kedaluwarsa tidak bisa menghasilkan payment record.

Status pembayaran: belum submit → pending → verified/rejected. Upload ulang hanya untuk rejected. Bukti pending/verified tidak bisa ditimpa. Rejection note wajib diisi; preview owner memakai signed URL singkat. File orphan dari upload yang ditinggalkan dan bukti lama tidak otomatis dihapus; atur retensi/pembersihan bucket sesuai kebutuhan operasional. Menghapus event menghapus baris domain; object Storage perlu dibersihkan terpisah.

## Seed / demo

`npm run seed` membuat akun Auth sungguhan dan event melalui RPC sungguhan. Seed idempotent dan default hanya menerima Supabase lokal.

- Email: `organizer@makrab.test`
- Password lokal: `MakrabDemo2026!` (override dengan `DEMO_PASSWORD`)
- Acara voting: `/e/makrab-cerita-kita-2026`, dua villa, tujuh tanggal relatif terhadap hari seed, enam jawaban peserta.
- Satu event draft tambahan.

Untuk project hosted **khusus demo**, set `ALLOW_REMOTE_SEED=true` dan password unik. Jangan seed akun demo default ke production. Seed tidak menciptakan link participant yang dapat ditebak; gunakan tombol Reset akses organizer untuk mencoba sebagai peserta seeded, atau submit peserta baru dari event link.

## Flow penggunaan

1. Register/login organizer, buat event melalui wizard nama → tanggal → villa; upload cover/galeri, tambah pilihan villa jika perlu.
2. Publish Stage 1, salin link atau gunakan QR. Participant mengisi nama/WA, kalender tap/paint, vote villa, kendaraan, dan review.
3. Participant mendapat sesi dan dashboard sementara. Simpan link akses pribadi; organizer bisa mencabut/mengganti link.
4. Organizer melihat agregat/tie, daftar peserta, rincian tanggal dan voter, lalu menutup Stage 1.
5. Susun kendaraan: kapasitas termasuk driver; motor maksimal dua; mandiri satu. Drag desktop atau dropdown mobile. Driver tidak otomatis berasal dari kepemilikan kendaraan; peringatan ditampilkan jika memilih driver tanpa kendaraan.
6. Wizard finalisasi menetapkan villa/date/cost/bank. Publish Stage 2 setelah semua peserta ditempatkan.
7. Participant melihat rencana dan kendaraan, melakukan transfer, mengunggah bukti, dan melihat thank-you/status. Organizer verify/reject dengan alasan; rejected boleh upload ulang.
8. Complete mengunci form; organizer bisa membuka Stage 2 kembali atau mengarsipkan. Delete perlu mengetik nama event.

Keputusan MVP: tanggal hanya bisa diubah saat DRAFT agar jawaban existing tidak hilang; villa yang sudah mendapat vote tidak bisa dihapus (nonaktifkan). Tidak ada jam availability, realtime subscription, atau PDF. Draft Stage 1 disimpan lokal di browser dan dihapus setelah submit; data produksi tetap di Supabase.

## Tests dan production build

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Playwright membaca `.env.local`, membutuhkan Supabase hidup dan migrasi terpasang, dan membuat data khusus test. Tidak ada mocks pada critical flow. Test mencakup login, wizard, publish, participant mobile, penolakan nama ganda, submit terkunci, transport, finalisasi, private upload, payment verification, completion, isolasi RLS/RPC, rollback lintas-event, dan race kapasitas kendaraan. Jangan arahkan test ke production.

Untuk menguji build production: jalankan `npm run build`, lalu `E2E_PRODUCTION=true npm run test:e2e` (PowerShell: `$env:E2E_PRODUCTION='true'; npm run test:e2e`). Hentikan server dev lebih dulu agar Playwright menjalankan production server. Workflow GitHub Actions menyiapkan Supabase lokal dan menjalankan seluruh pemeriksaan.

Jika download browser dibatasi, gunakan Chrome terpasang: set `PLAYWRIGHT_CHANNEL=chrome` sebelum Playwright. Jadwal/deadline organizer memakai WIB (UTC+7) secara eksplisit agar konsisten dengan runtime Vercel UTC.

## Deploy ke Vercel

1. Push repo ke GitHub dan import sebagai Next.js project di Vercel. Node.js 22+, install `npm ci`, build `npm run build`.
2. Terapkan migration ke hosted Supabase **sebelum** menggunakan aplikasi.
3. Isi kelima environment variables untuk Production (service-role dan token secret sebagai secrets). Set URL ke domain HTTPS final.
4. Konfigurasi Auth Site URL/redirect URLs dan SMTP sesuai domain tersebut.
5. Deploy. `vercel.json` memakai region Singapore (`sin1`) dan fungsi upload 30 detik. Pilih region Supabase terdekat.
6. Verifikasi register/email, event baru, participant, upload, dan signed preview pada domain final.

Tidak ada persistent filesystem, server terpisah, worker berkepanjangan, atau VPS pada production. Semua data, session hash, rate counters, dan file berada di Supabase. Docker/seed/testing tidak dijalankan di Vercel. Deployment Vercel dan provisioning hosted Supabase memerlukan akun/credential pemilik masing-masing.
