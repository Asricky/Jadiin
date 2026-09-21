# Product Requirements Document
## Makrab Planner

**Version:** 1.0  
**Product Type:** Multi-tenant Event Planning Web Application  
**Primary Deployment:** Vercel  
**Backend:** Supabase  
**Target:** Mobile-first responsive web application

---

# 1. Product Overview

Makrab Planner adalah web application untuk membantu organizer merencanakan acara makrab, gathering, retreat, atau acara kelompok lainnya.

Platform memiliki dua jenis pengguna:

1. **Admin / Organizer**
   - Harus memiliki akun.
   - Bisa register dan login.
   - Bisa membuat lebih dari satu acara.
   - Mengelola seluruh proses planning sampai pembayaran.
   - Data antar-admin harus terisolasi.

2. **Participant**
   - Tidak perlu membuat akun.
   - Tidak memiliki password.
   - Membuka link acara.
   - Mengisi nama lalu mengikuti flow acara.
   - Setelah Stage 1 selesai, participant dapat melihat dashboard sementara.
   - Setelah Admin menentukan hasil final, participant masuk ke Stage 2.
   - Setelah upload pembayaran, participant mendapatkan confirmation / thank-you page.

Tujuan utamanya adalah menghilangkan kebutuhan organizer menggunakan kombinasi Google Forms, When2Meet, spreadsheet, WhatsApp voting, dan pencatatan pembayaran secara terpisah.

---

# 2. Core Product Principle

Product harus:

- Sangat mudah digunakan participant.
- Tidak memaksa participant membuat akun.
- Mobile-first.
- Cepat dibuka melalui link WhatsApp.
- Tidak membutuhkan tutorial.
- Seluruh proses event tersedia dalam satu aplikasi.
- Mendukung banyak event.
- Mendukung banyak Admin.
- Memiliki isolasi data antar-Admin.
- Bisa dijalankan dengan stack yang kompatibel dengan Vercel.
- Sebisa mungkin dapat berjalan menggunakan free tier untuk MVP.
- Tidak bergantung pada long-running backend process.

---

# 3. Product Structure

Secara garis besar:

```text
Makrab Planner
│
├── Public / Participant
│   └── Event Link
│       ├── Identity
│       ├── Stage 1 Form
│       ├── Planning Dashboard
│       ├── Stage 2 Final Information
│       ├── Payment Upload
│       └── Thank You
│
└── Admin
    ├── Register / Login
    ├── Event List
    ├── Create Event
    └── Event Management
        ├── Overview
        ├── Participants
        ├── Date Availability
        ├── Villas
        ├── Transport
        ├── Payments
        └── Settings
```

---

# 4. Multi-Tenant Concept

Platform harus dibuat multi-tenant sejak awal.

Contoh:

```text
Admin Lucas
├── Makrab Angkatan 2026
├── Trip Bandung
└── Gathering Kantor

Admin Adit
├── Makrab Divisi IT
└── Villa Trip 2027
```

Admin Lucas tidak boleh dapat mengakses event milik Admin Adit.

Setiap event memiliki URL unik:

```text
/event/makrab-angkatan-2026
/event/gathering-it-2026
```

atau versi pendek:

```text
/e/makrab-angkatan-2026
```

Admin dapat mengubah slug selama belum digunakan event lain.

---

# 5. User Roles

## 5.1 Admin

Admin menggunakan authentication.

Fitur:

- Register.
- Login.
- Logout.
- Forgot password.
- Create event.
- Edit event.
- Delete/archive event.
- Publish event.
- Share participant link.
- Copy link.
- Generate QR Code.
- Monitor participant responses.
- Configure candidate dates.
- Manage villa options.
- View voting.
- Finalize villa.
- Finalize date.
- Arrange transport.
- Configure payment.
- Review payment proof.
- Mark payment verified/rejected.
- Close event.

---

# 6. Participant Authentication Model

Participant **tidak memiliki account system**.

Participant tidak perlu:

- Email.
- Password.
- OTP.
- Register.
- Login.

Flow awal:

```text
Open Event Link
↓
Masukkan Nama
↓
Start Stage 1
```

Namun nama **tidak boleh digunakan sebagai security credential**.

Setelah Stage 1 berhasil disubmit:

1. Backend membuat random secure participant access token.
2. Token disimpan dalam bentuk hash di database.
3. Browser participant mendapatkan session cookie.
4. Participant juga memiliki unique recovery/access URL.
5. Token memungkinkan participant membuka kembali response miliknya tanpa account.

Contoh:

```text
/e/makrab-2026/p/secure-random-token
```

Participant normalnya tidak perlu memahami mekanisme ini.

Jika kembali menggunakan browser yang sama, event harus otomatis mengenali participant.

Jika participant kehilangan browser/session, Admin dapat membuat ulang participant access link.

Participant lain yang hanya mengetahui nama seseorang tidak boleh dapat mengedit data participant tersebut.

---

# 7. Event Lifecycle

Setiap event memiliki status:

```text
DRAFT
↓
STAGE_1_OPEN
↓
STAGE_1_CLOSED
↓
STAGE_2_OPEN
↓
COMPLETED
↓
ARCHIVED
```

### DRAFT

Event masih disiapkan Admin.

Participant link belum aktif.

### STAGE_1_OPEN

Participant dapat:

- Join.
- Mengisi Stage 1.
- Melihat planning dashboard setelah submit.

### STAGE_1_CLOSED

Tidak menerima participant Stage 1 baru kecuali Admin membuka kembali.

Admin memfinalisasi:

- Date.
- Villa.
- Transport.
- Cost.

### STAGE_2_OPEN

Participant dapat melihat:

- Villa final.
- Date final.
- Transport assignment.
- Cost.
- Payment instruction.
- Upload payment proof.

### COMPLETED

Event selesai.

Data masih dapat dilihat tetapi form dikunci.

---

# 8. Admin Onboarding

## Register

Fields:

- Full Name
- Email
- Password
- Confirm Password

Actions:

- Create Account
- Login

Setelah register:

```text
Welcome
↓
Create Your First Event
```

---

# 9. Admin Event Creation Wizard

Saat membuat event, gunakan wizard agar tidak terasa kompleks.

## Step 1 — Event Information

Fields:

- Event Name
- Description
- Event Cover Image optional
- Participant deadline
- Event slug

Contoh:

```text
Makrab Angkatan 2026
makrab-angkatan-2026
```

---

# 10. Candidate Date Configuration

Admin menentukan tanggal apa saja yang dapat dipilih participant.

Admin dapat:

### Mode A — Date Range

Contoh:

```text
1 October 2026 – 15 October 2026
```

Sistem membuat seluruh tanggal dalam range tersebut.

### Mode B — Specific Dates

Admin memilih tanggal secara manual.

Contoh:

```text
3 October
4 October
10 October
11 October
17 October
```

Admin dapat menghapus tanggal tertentu.

---

# 11. Villa Configuration

Admin dapat menambahkan beberapa pilihan villa.

Setiap villa memiliki:

- Villa Name
- Cover Image
- Image Gallery
- Description
- Price
- Capacity
- Address
- Google Maps URL
- Facilities
- Notes optional

Facilities menggunakan list.

Contoh:

```text
Private Pool
Karaoke
BBQ Area
8 Bedrooms
WiFi
Parking
Kitchen
```

Admin dapat:

- Add Villa.
- Edit Villa.
- Delete Villa.
- Reorder Villa.
- Disable Villa tanpa menghapus data.

---

# 12. Publish Event

Sebelum publish lakukan validation.

Minimal harus tersedia:

- Event name.
- Candidate dates.
- Minimal satu villa.

Jika validation berhasil:

```text
Publish Event
```

Setelah publish tampilkan:

- Participant Link.
- Copy Link.
- QR Code.
- Preview as Participant.

---

# 13. Participant Landing Page

Route:

```text
/e/[event-slug]
```

Landing page menampilkan:

- Event Name.
- Organizer.
- Short description.
- Stage status.
- Deadline.
- Participant count.
- CTA.

CTA:

```text
Ikut Makrab
```

atau jika participant session sudah dikenali:

```text
Lanjutkan
```

---

# 14. Participant Identity

Participant hanya diminta:

### Nama

Placeholder:

```text
Masukkan nama kamu
```

CTA:

```text
Lanjut
```

Jika nama belum ditemukan:

```text
Create Participant Session
```

Jika nama ditemukan dan browser memiliki access token yang valid:

```text
Resume Participant
```

Jika nama sudah digunakan tetapi browser tidak memiliki token:

Tampilkan pesan aman:

```text
Nama ini sudah terdaftar di acara ini.

Gunakan link akses sebelumnya atau hubungi organizer jika kamu ingin mengubah jawaban.
```

Jangan tampilkan nomor WhatsApp ataupun informasi sensitif participant yang sudah ada.

---

# 15. Participant Stage 1 Form

Stage 1 dibuat sebagai multi-step form.

Progress:

```text
1. Data Diri
2. Tanggal
3. Villa
4. Kendaraan
5. Review
```

---

# 16. Stage 1 — Data Diri

Fields:

### Nama

Sudah diisi dari step sebelumnya.

Editable sebelum submit.

### Nomor WhatsApp

Format Indonesia-friendly.

Contoh:

```text
081234567890
```

Sistem dapat normalize menjadi:

```text
6281234567890
```

Nomor WhatsApp hanya dapat dilihat oleh Admin.

Tidak ditampilkan pada public participant dashboard.

---

# 17. Stage 1 — Date Availability

Buat interaction yang terinspirasi dari When2Meet tetapi tidak perlu menyalin tampilannya.

Gunakan date availability grid.

Contoh:

```text
OCTOBER 2026

MON TUE WED THU FRI SAT SUN

                 1   2   3   4
 5   6   7   8   9  10  11
12  13  14  15
```

Participant dapat:

- Tap satu tanggal.
- Tap beberapa tanggal.
- Drag melewati beberapa date cells untuk memilih sekaligus.
- Drag/tap kembali untuk membatalkan.

Visual:

```text
Available     = selected
Unavailable   = unselected
```

MVP menggunakan binary availability saja.

Tidak perlu:

- Jam.
- Morning.
- Afternoon.
- Maybe.

Selected dates harus jelas secara visual.

Mobile interaction harus nyaman.

---

# 18. Stage 1 — Villa Vote

Participant memilih **satu villa**.

Gunakan card.

Contoh:

```text
┌─────────────────────────────┐
│ [Villa Image]               │
│                             │
│ Villa Istana Bunga          │
│ Capacity: 25                │
│                             │
│ [ View Info ]    ○ Select   │
└─────────────────────────────┘
```

Tombol:

```text
View Info
```

membuka modal / bottom sheet.

Modal menampilkan:

- Gallery.
- Nama.
- Price.
- Capacity.
- Facilities.
- Description.
- Address.
- Google Maps button.

CTA:

```text
Open in Google Maps
```

Gunakan URL Google Maps yang diinput Admin.

---

# 19. Stage 1 — Vehicle

Pertanyaan:

```text
Kamu punya kendaraan?
```

Options:

- Mobil
- Motor
- Tidak Ada

Tambahkan helper text:

> Isi kendaraan yang kamu punya ya, walaupun sekarang belum tentu mau dibawa. Data ini dipakai organizer untuk melihat kemungkinan transportasi.

Data ini **bukan berarti participant otomatis menjadi driver**.

Driver baru ditentukan Admin pada Stage 2.

---

# 20. Stage 1 — Review

Sebelum submit:

```text
Nama
WhatsApp
Available Dates
Villa Choice
Vehicle
```

CTA:

```text
Kirim Jawaban
```

Participant dapat kembali ke step sebelumnya.

---

# 21. Stage 1 Submission

Submission harus bersifat atomic.

Setelah berhasil:

- Participant created/updated.
- Date availability saved.
- Villa vote saved.
- Vehicle saved.
- Secure access token generated.
- Browser session stored.
- Timestamp recorded.

Redirect:

```text
/e/[slug]/dashboard
```

---

# 22. Participant Planning Dashboard

Dashboard Stage 1 hanya bisa dilihat participant yang sudah submit.

Dashboard menampilkan informasi sementara.

## Section 1 — Event Status

```text
Planning in Progress
```

Helper:

```text
Hasil di bawah masih dapat berubah sampai organizer menentukan keputusan final.
```

---

# 23. Most Voted Villa

Tampilkan villa dengan vote terbanyak.

Contoh:

```text
Villa Favorit Sementara

Villa Istana Bunga

12 votes
```

Jika tie:

```text
Voting sementara masih imbang
```

Tampilkan kedua villa.

Participant dapat membuka detail villa.

---

# 24. Most Available Date

Gunakan seluruh availability participant.

Hitung:

```text
availability_count(date)
```

Tanggal dengan jumlah participant available terbesar menjadi kandidat utama.

Contoh:

```text
Tanggal Paling Memungkinkan

Saturday
10 October 2026

18 of 21 participants available
```

Jika ada beberapa tanggal dengan nilai sama, tampilkan semuanya sebagai leading dates.

---

# 25. Availability Heatmap

Dashboard juga menampilkan aggregate calendar.

Semakin banyak orang available pada satu tanggal, semakin tinggi intensity visual cell.

Contoh:

```text
██ 18
▓▓ 14
▒▒ 8
░░ 3
```

Jangan bergantung hanya pada warna.

Tetap tampilkan jumlah availability agar accessible.

---

# 26. Participant List

Section:

```text
21 Participants
```

Tampilkan:

- Participant names.

Tidak tampilkan:

- WhatsApp.
- Payment.
- Access token.

Sorting:

- Alphabetical.

Optional search jika participant banyak.

---

# 27. Admin Event Overview

Route:

```text
/admin/events/[event-id]
```

Overview berisi cards:

```text
Participants
21

Stage 1 Completed
18 / 21

Top Villa
Villa A

Best Date
10 Oct

Vehicle Pool
6 Cars
9 Motorcycles

Payments
12 / 21
```

Card menyesuaikan current event stage.

---

# 28. Admin Participants Page

Table:

| Participant | WhatsApp | Stage 1 | Vehicle | Stage 2 | Payment |
|---|---|---|---|---|---|

Actions:

- View details.
- Edit.
- Delete.
- Generate new access link.
- Copy participant link.

Search:

- Name.
- WhatsApp.

Filter:

- Stage 1.
- Vehicle.
- Payment.

---

# 29. Admin Date Availability

Admin mendapatkan visualisasi agregat.

Tampilkan:

- Heatmap calendar.
- Date.
- Number available.
- Percentage.
- Participant names available.
- Participant names unavailable.

Sort option:

```text
Highest Availability
```

Contoh:

| Date | Available |
|---|---:|
| 10 Oct | 18/21 |
| 11 Oct | 17/21 |
| 4 Oct | 14/21 |

Admin tetap memiliki keputusan final.

Sistem hanya memberikan data, bukan otomatis memfinalisasi tanggal.

---

# 30. Admin Villa Voting

Tampilkan:

```text
Villa A
12 votes

Villa B
7 votes

Villa C
2 votes
```

Admin dapat membuka participant voter list.

Tombol:

```text
Set as Final Villa
```

Admin boleh memilih villa selain villa dengan vote tertinggi.

Tampilkan confirmation dialog sebelum finalisasi.

---

# 31. Close Stage 1

Admin klik:

```text
Close Stage 1
```

Confirmation:

```text
Participant tidak dapat mengirim atau mengubah Stage 1 setelah proses ini ditutup.

Continue?
```

Setelah Stage 1 ditutup, Admin masuk ke:

```text
Finalization Wizard
```

---

# 32. Finalization Wizard

Steps:

```text
1. Final Villa
2. Final Date
3. Transportation
4. Payment
5. Publish Stage 2
```

---

# 33. Final Villa

Tampilkan hasil voting sebagai referensi.

Admin memilih final villa.

Data final menyimpan:

```text
event.final_villa_id
```

---

# 34. Final Date

Tampilkan availability ranking.

Admin memilih satu tanggal final.

Data:

```text
event.final_date
```

---

# 35. Transport Planner

Transport Planner merupakan salah satu fitur utama Admin.

Layout desktop:

```text
UNASSIGNED

Andi
Budi
Caca
Dino


CAR — Lucas
Driver: Lucas
Seats: 4

- Lucas   DRIVER
- Andi
- Caca
- [empty]


MOTOR — Budi

- Budi    DRIVER
- Dino    PASSENGER
```

Admin dapat melakukan drag-and-drop.

Pada mobile gunakan:

```text
Assign Transport
```

modal/dropdown daripada drag-only.

---

# 36. Vehicle Groups

Admin dapat membuat:

### Car

Fields:

- Vehicle label optional.
- Owner.
- Driver.
- Capacity.
- Passengers.

Example:

```text
Mobil Lucas
Driver: Lucas
Capacity: 5
```

### Motorcycle

Fields:

- Owner.
- Driver.
- Passenger.

Default capacity:

```text
2
```

### Independent Transport

Untuk participant yang pergi sendiri.

---

# 37. Transport Validation

Sistem harus mencegah:

- Satu participant berada di dua kendaraan.
- Jumlah passenger > capacity.
- Motorcycle memiliki >2 orang.
- Participant menjadi driver dua vehicle sekaligus.

Sistem harus memberikan warning jika:

- Driver dipilih tetapi pada Stage 1 memilih "Tidak Ada Kendaraan".

Admin tetap boleh override warning.

---

# 38. Participant Transport Information

Participant Stage 2 melihat hanya assignment yang relevan.

Contoh:

```text
Transport Kamu

Mobil Lucas

Driver
Lucas

Passengers
Andi
Caca
Dino
```

atau:

```text
Motor Budi

Driver
Budi

Kamu dibonceng oleh Budi
```

Participant juga dapat melihat full transport arrangement jika Admin mengaktifkan:

```text
Show all transport groups
```

Default: ON.

---

# 39. Payment Configuration

Admin mengisi:

### Cost

```text
Rp350.000 / person
```

Fields:

- Amount per participant.
- Payment deadline optional.

### Bank Information

- Bank Name.
- Account Number.
- Account Holder.

Optional:

- Payment notes.

Contoh:

```text
Mohon cantumkan nama di berita transfer.
```

---

# 40. Stage 2 Participant Page

Setelah Admin publish Stage 2:

```text
It's Official 🎉
```

Tampilkan:

## Final Villa

- Image.
- Villa name.
- Address.
- Maps.
- Facilities.

## Final Date

- Day.
- Date.

## Transport

- Vehicle.
- Driver.
- Passengers.

## Cost

- Cost per person.

## Payment

- Bank.
- Account number.
- Account holder.
- Copy account number button.

CTA:

```text
Upload Bukti Pembayaran
```

---

# 41. Payment Upload

Supported:

- JPG.
- JPEG.
- PNG.
- WebP.
- PDF optional.

Recommended limit:

```text
5 MB
```

Images sebaiknya dikompresi client-side sebelum upload jika terlalu besar.

Upload dilakukan langsung ke Supabase Storage menggunakan signed upload mechanism.

Jangan mengirim file besar melalui Vercel serverless function jika tidak diperlukan.

Storage structure:

```text
payment-proofs/
  event-id/
    participant-id/
      uuid.jpg
```

Payment proof bucket bersifat **private**.

---

# 42. Payment Submission

Setelah file berhasil diupload:

Create payment record:

```text
status = PENDING
```

Participant langsung mendapatkan:

```text
Terima kasih! 🎉

Data dan bukti pembayaran kamu sudah kami terima.

Sampai ketemu di acaranya!
```

CTA optional:

```text
Kembali ke Detail Acara
```

---

# 43. Payment Status

Statuses:

```text
NOT_SUBMITTED
PENDING
VERIFIED
REJECTED
```

Jika `REJECTED`, participant dapat upload ulang.

Admin dapat memberikan rejection note.

Contoh:

```text
Nominal transfer belum terlihat jelas. Mohon upload ulang bukti pembayaran.
```

---

# 44. Admin Payment Dashboard

Table:

| Participant | Amount | Submitted | Status | Action |
|---|---:|---|---|---|

Admin dapat:

- Preview payment proof.
- Download proof.
- Verify.
- Reject.
- Add note.

Summary:

```text
Paid
18

Pending
2

Not Submitted
3
```

---

# 45. Event Completion

Admin dapat menekan:

```text
Complete Event
```

Setelah complete:

- Participant form read-only.
- Payment upload disabled unless reopened.
- Admin masih dapat melihat data.
- Event dapat diarchive.

---

# 46. Admin Navigation

Desktop sidebar:

```text
Makrab Planner

Events
──────────────

Current Event
Overview
Participants
Dates
Villas
Transport
Payments
Settings
```

Mobile:

gunakan bottom navigation atau compact menu.

---

# 47. Admin Events Dashboard

Setelah login:

```text
Your Events

[ + Create Event ]
```

Event card:

```text
Makrab Angkatan 2026

Stage 1 Open
21 participants

Deadline
30 Sep 2026

[ Manage ]
```

Tabs/filter:

- Active.
- Completed.
- Archived.

---

# 48. Event Settings

Admin dapat edit:

- Event name.
- Description.
- Cover.
- Slug.
- Deadline.
- Public participant list setting.
- Event status.

Danger zone:

- Close event.
- Archive.
- Delete event.

Delete membutuhkan confirmation dengan event name.

---

# 49. Database Design

Gunakan PostgreSQL melalui Supabase.

## profiles

```text
id uuid PK -> auth.users.id
display_name text
created_at timestamptz
updated_at timestamptz
```

---

## events

```text
id uuid PK
owner_id uuid FK profiles.id
name text
slug text UNIQUE
description text
cover_path text nullable

status enum:
DRAFT
STAGE_1_OPEN
STAGE_1_CLOSED
STAGE_2_OPEN
COMPLETED
ARCHIVED

stage1_deadline timestamptz nullable
stage2_deadline timestamptz nullable

final_villa_id uuid nullable
final_date date nullable

cost_per_person numeric nullable
bank_name text nullable
bank_account_number text nullable
bank_account_holder text nullable
payment_note text nullable

show_transport_groups boolean default true

created_at timestamptz
updated_at timestamptz
```

---

## event_dates

```text
id uuid PK
event_id uuid FK events.id
date date
created_at timestamptz

UNIQUE(event_id, date)
```

---

## villas

```text
id uuid PK
event_id uuid FK events.id
name text
description text
price numeric nullable
capacity integer nullable
address text
google_maps_url text
facilities text[]
cover_path text nullable
active boolean default true
sort_order integer
created_at timestamptz
updated_at timestamptz
```

---

## villa_images

```text
id uuid PK
villa_id uuid FK villas.id
storage_path text
sort_order integer
created_at timestamptz
```

---

## participants

```text
id uuid PK
event_id uuid FK events.id

name text
normalized_name text
whatsapp text

vehicle_type enum:
CAR
MOTORCYCLE
NONE

access_token_hash text

stage1_submitted_at timestamptz nullable
stage2_submitted_at timestamptz nullable

created_at timestamptz
updated_at timestamptz

UNIQUE(event_id, normalized_name)
```

---

## participant_availability

Only selected/available dates need to be stored.

```text
participant_id uuid
event_date_id uuid

PRIMARY KEY(participant_id, event_date_id)
```

---

## villa_votes

```text
participant_id uuid UNIQUE
villa_id uuid
created_at timestamptz
```

One participant = one villa vote.

---

## transport_groups

```text
id uuid PK
event_id uuid
type enum:
CAR
MOTORCYCLE
INDEPENDENT

label text nullable
owner_participant_id uuid nullable
driver_participant_id uuid nullable
capacity integer
sort_order integer

created_at timestamptz
updated_at timestamptz
```

---

## transport_members

```text
id uuid PK
transport_group_id uuid
participant_id uuid
role enum:
DRIVER
PASSENGER

seat_order integer nullable

UNIQUE(event_id equivalent participant assignment)
```

Database or application validation harus memastikan participant hanya memiliki satu transport assignment.

---

## payments

```text
id uuid PK
event_id uuid
participant_id uuid

amount numeric
proof_storage_path text

status enum:
PENDING
VERIFIED
REJECTED

admin_note text nullable

submitted_at timestamptz
verified_at timestamptz nullable
updated_at timestamptz
```

---

# 50. Storage Buckets

Gunakan dua storage bucket.

## villa-media

Villa images.

Permission:

```text
Public Read
Admin Write
```

## payment-proofs

Payment evidence.

Permission:

```text
PRIVATE
```

Hanya:

- Event owner Admin.
- Participant pemilik payment melalui verified access flow.

yang boleh mengakses.

Gunakan signed URL untuk preview.

Jangan expose raw storage path sebagai public URL.

---

# 51. Security

Security wajib menjadi bagian implementation, bukan fase setelah aplikasi selesai.

Gunakan:

- Supabase Row Level Security.
- Server-side authorization.
- Secure participant tokens.
- Hashed participant tokens.
- HttpOnly Secure cookies jika memungkinkan.
- Input validation.
- Zod schema validation.
- Rate protection pada participant submission.
- File MIME validation.
- File-size validation.
- Sanitization.
- RLS untuk Admin resources.
- Private payment bucket.

`SUPABASE_SERVICE_ROLE_KEY`:

- Server only.
- Tidak pernah memakai prefix `NEXT_PUBLIC`.
- Tidak pernah dikirim ke browser.
- Tidak pernah dimasukkan git.

---

# 52. Row Level Security

Admin hanya boleh CRUD data jika:

```text
event.owner_id == auth.uid()
```

Semua child entities harus memvalidasi ownership melalui `event_id`.

Contoh:

```text
villa.event_id
→ event.owner_id
→ auth.uid()
```

Participant public endpoints tidak boleh menggunakan unrestricted anonymous database mutation.

Public mutation harus melalui server endpoint/action yang melakukan:

- Event validation.
- Stage validation.
- Token validation jika update.
- Request validation.

---

# 53. Participant Privacy

Participant dashboard boleh menampilkan:

- Name.
- Aggregated vote result.
- Date availability count.
- Participant list.

Jangan tampilkan:

- WhatsApp.
- Payment proof.
- Bank transfer information participant.
- Participant access token.
- Internal Admin notes.

---

# 54. Frontend Stack

Gunakan:

```text
Next.js — latest stable
TypeScript
React
Tailwind CSS
shadcn/ui
Lucide Icons
React Hook Form
Zod
Supabase JS
Supabase SSR
date-fns
```

Gunakan native HTML/Pointer Events untuk date paint selection atau library kecil jika benar-benar dibutuhkan.

Transport drag-and-drop dapat menggunakan:

```text
dnd-kit
```

Hindari dependency berlebihan.

---

# 55. Backend Architecture

Tidak perlu membuat backend server terpisah.

Gunakan:

```text
Next.js App Router
Server Components
Server Actions / Route Handlers
Supabase Postgres
Supabase Auth
Supabase Storage
```

Architecture:

```text
Browser
   │
   ▼
Next.js / Vercel
   │
   ├── Authentication
   ├── Validation
   ├── Participant Session
   └── Business Logic
   │
   ▼
Supabase
   ├── PostgreSQL
   ├── Auth
   └── Storage
```

---

# 56. Suggested Application Routes

```text
/
├── /
├── /login
├── /register
│
├── /admin
│   ├── /events
│   ├── /events/new
│   └── /events/[eventId]
│       ├── /overview
│       ├── /participants
│       ├── /dates
│       ├── /villas
│       ├── /transport
│       ├── /payments
│       └── /settings
│
└── /e/[slug]
    ├── /
    ├── /join
    ├── /stage-1
    ├── /dashboard
    ├── /stage-2
    └── /thank-you
```

Participant token dapat dikelola melalui cookie atau secure participant-specific route.

---

# 57. Suggested Project Structure

```text
src/
├── app/
│   ├── (auth)/
│   ├── admin/
│   ├── e/
│   ├── api/
│   └── layout.tsx
│
├── components/
│   ├── admin/
│   ├── participant/
│   ├── events/
│   ├── villas/
│   ├── dates/
│   ├── transport/
│   ├── payments/
│   └── ui/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── participant-session/
│   ├── validation/
│   ├── permissions/
│   └── utils/
│
├── actions/
│
├── hooks/
│
└── types/

supabase/
├── migrations/
├── seed.sql
└── config.toml
```

---

# 58. UI Direction

Design:

- Modern.
- Friendly.
- Clean.
- Slightly playful.
- Tidak terlalu corporate.
- Tidak terlalu childish.
- Mobile-first.
- Plenty of whitespace.
- Rounded card.
- Clear visual hierarchy.
- Smooth interaction.

Gunakan maximum content width agar desktop tidak terlalu melebar.

Participant interface harus terasa seperti aplikasi event, bukan database admin.

---

# 59. Participant Mobile Experience

Mayoritas participant diasumsikan membuka link dari WhatsApp di smartphone.

Prioritas:

- Button minimal ~44px touch target.
- Sticky CTA pada multi-step form.
- Modal villa menjadi bottom sheet pada mobile.
- Date grid tetap mudah disentuh.
- Images lazy-loaded.
- Skeleton loading.
- Optimistic interaction jika aman.
- Tidak ada hover-only functionality.

---

# 60. Loading & Error States

Setiap halaman data memiliki:

- Loading state.
- Empty state.
- Error state.

Contoh empty participants:

```text
Belum ada participant.

Bagikan link acara untuk mulai mengumpulkan jawaban.
```

Tidak boleh terdapat blank white page apabila request gagal.

---

# 61. Form Persistence

Stage 1 sebaiknya menyimpan draft di localStorage sampai berhasil submit.

Tujuan:

Jika browser refresh atau koneksi putus, participant tidak kehilangan seluruh pilihan.

Setelah successful submission:

```text
clear stage1 draft
```

---

# 62. Concurrency

Harus aman jika puluhan participant submit secara bersamaan.

Gunakan:

- Database constraint.
- Transaction/RPC jika diperlukan.
- Upsert yang benar.
- Unique constraint.

Jangan mengandalkan client state sebagai source of truth.

---

# 63. Aggregate Calculations

Villa voting:

```text
COUNT(villa_votes)
GROUP BY villa
```

Date:

```text
COUNT(participant_availability)
GROUP BY event_date
```

Transport:

```text
COUNT(vehicle_type)
```

Payment:

```text
COUNT(payment status)
```

Untuk MVP, aggregate dapat dihitung saat request karena ukuran event relatif kecil.

Tidak perlu complex caching infrastructure.

---

# 64. Tie Handling

Villa vote tie:

```text
Villa A dan Villa B sedang imbang dengan 8 vote.
```

Date availability tie:

Tampilkan seluruh tanggal yang memiliki top availability count.

Jangan memilih winner secara random.

---

# 65. Accessibility

Minimal:

- Semantic HTML.
- Keyboard navigation.
- Modal focus trap.
- Proper form labels.
- Sufficient contrast.
- Error tidak hanya ditunjukkan melalui warna.
- Heatmap memiliki angka/text.
- ARIA labels untuk icon-only buttons.

---

# 66. Performance

Target:

- Fast mobile loading.
- Optimize images.
- Lazy-load villa galleries.
- Avoid unnecessary client components.
- Server Component untuk data-heavy screens.
- Direct Storage upload.
- Pagination jika participant list besar.
- Avoid excessive realtime subscription.

Supabase Realtime tidak wajib untuk MVP.

Dashboard dapat menggunakan refresh/revalidation setelah mutation.

---

# 67. Deployment

Frontend:

```text
Vercel
```

Backend:

```text
Supabase
```

Tidak perlu VPS.

Environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
PARTICIPANT_TOKEN_SECRET=
```

Production secrets hanya disimpan melalui environment variables.

---

# 68. Vercel Compatibility

Application tidak boleh bergantung pada:

- Local filesystem persistence.
- Long-running Node.js server.
- Local database.
- Docker daemon.
- Background process yang harus selalu hidup.

Semua persistent data berada pada Supabase.

Uploaded files tidak disimpan pada filesystem Vercel.

---

# 69. Free-Tier Strategy

Untuk MVP:

```text
Vercel
→ Frontend + Serverless

Supabase
→ Auth + PostgreSQL + Storage
```

Jangan menambahkan paid dependency yang tidak diperlukan.

Villa images harus dioptimalkan.

Payment proof dibatasi ukuran.

Tambahkan dokumentasi bahwa infrastructure quota perlu dipantau jika penggunaan platform membesar.

---

# 70. Seed / Demo Data

Sediakan seed event agar UI dapat langsung dites.

Contoh:

```text
Event:
Makrab Angkatan 2026

Dates:
10 Oct
11 Oct
17 Oct
18 Oct

Villas:
Villa Pine
Villa Mountain View
Villa Cendana

Participants:
Lucas
Andi
Budi
Caca
Dinda
```

Gunakan fake phone numbers untuk development data.

---

# 71. Admin MVP Features

Wajib ada:

- Authentication.
- Multi-event dashboard.
- Event creation.
- Candidate dates.
- Villa management.
- Participant monitoring.
- Villa results.
- Date availability.
- Finalization.
- Transport planner.
- Payment configuration.
- Payment verification.
- Event lifecycle.

---

# 72. Participant MVP Features

Wajib ada:

- Enter name.
- Stage 1.
- WhatsApp.
- Date availability.
- Villa voting.
- Villa info.
- Vehicle ownership.
- Review.
- Submit.
- Planning dashboard.
- Participant list.
- Stage 2 final information.
- Transport assignment.
- Payment upload.
- Thank-you state.

---

# 73. Features Not Required for MVP

Jangan mengembangkan terlebih dahulu:

- Chat.
- AI features.
- Native mobile app.
- Email marketing.
- WhatsApp API.
- Automatic bank verification.
- Payment gateway.
- Split payment.
- Multiple organizer collaboration.
- Complex role management.
- Real-time chat.
- Social feed.
- Attendance QR scan.

Architecture boleh memungkinkan extension di kemudian hari.

---

# 74. Future Improvements

Potensi version berikutnya:

- Co-admin.
- Expense tracking.
- Itinerary.
- Room allocation.
- Food preference.
- T-shirt size.
- Automatic WhatsApp reminders.
- Attendance.
- Group chat link.
- Event templates.
- Duplicate previous event.
- Export participants to Excel.
- Export transport manifest.
- Expense settlement.
- Notifications.
- Custom branding.
- Public/private event access code.

---

# 75. Testing

Gunakan:

```text
Vitest
React Testing Library
Playwright
```

Minimal test business logic:

### Admin Security

Admin A tidak dapat membaca/mengubah Event B.

### Villa Vote

Participant hanya memiliki satu active vote.

### Availability

Duplicate date availability tidak diperbolehkan.

### Participant

Duplicate normalized participant name dicegah per event.

### Event State

Stage 1 tidak dapat diedit setelah ditutup.

### Transport

Participant tidak dapat berada di dua kendaraan.

### Vehicle Capacity

Tidak boleh melebihi capacity.

### Payment

Participant tidak dapat membaca payment proof participant lain.

### Upload

Invalid file type ditolak.

---

# 76. Critical E2E Tests

## Scenario 1 — Full Event

```text
Admin register
→ Create Event
→ Add dates
→ Add villas
→ Publish
→ Participant joins
→ Participant submits Stage 1
→ Dashboard updates
→ Admin closes Stage 1
→ Admin chooses date
→ Admin chooses villa
→ Admin arranges transport
→ Admin configures payment
→ Admin publishes Stage 2
→ Participant sees final info
→ Participant uploads payment
→ Thank-you displayed
→ Admin verifies payment
```

---

## Scenario 2 — Multi Tenant

```text
Admin A creates Event A
Admin B creates Event B

Admin A cannot:
- read Event B
- edit Event B
- access Event B participants
- access Event B payments
```

---

## Scenario 3 — Returning Participant

```text
Participant submits Stage 1
→ closes browser
→ returns with valid participant session
→ automatically recognized
→ sees dashboard
```

---

# 77. Acceptance Criteria

Product dianggap MVP-ready jika:

1. Admin dapat register/login.
2. Banyak Admin dapat memakai platform secara independen.
3. Admin dapat membuat banyak event.
4. Event memiliki unique shareable URL.
5. Participant tidak perlu account.
6. Participant dapat submit Stage 1.
7. Date selector bekerja baik di desktop dan mobile.
8. Villa detail modal bekerja.
9. Villa vote tersimpan dengan benar.
10. Vehicle ownership tersimpan.
11. Participant dashboard memperlihatkan aggregate result.
12. Admin mendapatkan seluruh Stage 1 data.
13. Admin dapat menutup Stage 1.
14. Admin dapat menentukan final villa dan final date.
15. Admin dapat menyusun transport group.
16. Participant mendapatkan transport assignment.
17. Admin dapat menentukan biaya dan rekening.
18. Participant dapat upload bukti pembayaran.
19. Payment proof bersifat private.
20. Admin dapat verify/reject pembayaran.
21. Participant mendapatkan thank-you state.
22. RLS mencegah data leakage antar-Admin.
23. Application berhasil build production.
24. Application berhasil deploy ke Vercel.
25. Tidak ada dependency pada persistent local server filesystem.
26. Responsive pada smartphone.
27. Tidak ada critical console error.
28. Core E2E tests pass.

---

# 78. Definition of Done

Jangan anggap task selesai hanya karena UI berhasil dibuat.

Definition of Done:

```text
UI implemented
+
Database migration implemented
+
Authentication working
+
RLS implemented
+
Storage policies implemented
+
Forms connected to real database
+
Validation implemented
+
Participant session working
+
Admin authorization working
+
Stage lifecycle working
+
Transport logic working
+
Payment upload working
+
Tests passing
+
Production build passing
+
README complete
+
Vercel deployment ready
```

Tidak boleh menggunakan dummy/mock state pada final production flow.

---

# 79. Final Product Flow

## Participant

```text
Event Link
   ↓
Enter Name
   ↓
Stage 1
   ├── WhatsApp
   ├── Date Availability
   ├── Villa Vote
   └── Vehicle
   ↓
Submit
   ↓
Planning Dashboard
   ├── Most Voted Villa
   ├── Best Date
   ├── Availability Heatmap
   └── Participants
   ↓
Admin Finalization
   ↓
Stage 2
   ├── Final Villa
   ├── Final Date
   ├── Transport Assignment
   ├── Cost
   └── Bank Information
   ↓
Payment Proof
   ↓
Submit
   ↓
Thank You
```

## Admin

```text
Register / Login
   ↓
Create Event
   ↓
Configure Dates
   ↓
Configure Villas
   ↓
Publish
   ↓
Collect Participants
   ↓
Monitor:
   ├── Participants
   ├── Villa Voting
   ├── Date Availability
   └── Vehicle Pool
   ↓
Close Stage 1
   ↓
Finalize:
   ├── Villa
   ├── Date
   ├── Transportation
   └── Payment
   ↓
Publish Stage 2
   ↓
Monitor Payments
   ↓
Verify
   ↓
Complete Event
```