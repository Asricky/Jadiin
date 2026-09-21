import Link from 'next/link';
import { ArrowRight, CalendarDays, House, Car, Check } from 'lucide-react';
import { Brand } from '@/components/common';
import { Button } from '@/components/ui/button';
export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Brand />
          <Button variant="ghost" asChild>
            <Link href="/login">
              Masuk organizer
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </header>
      <main className="container">
        <section className="landing-intro">
          <div className="stack">
            <p className="text-sm font-medium">Tanggal, villa, transport, dan patungan.</p>
            <h1>
              Makrab berikutnya,
              <br />
              mulai direncanakan.
            </h1>
            <p className="landing-description">
              Kumpulkan pilihan teman lewat satu link. Temukan dua hari yang cocok, pilih villa,
              lalu siapkan keberangkatannya.
            </p>
            <div className="row">
              <Button asChild>
                <Link href="/register">
                  Buat acara
                  <ArrowRight size={17} />
                </Link>
              </Button>
              <span className="text-sm muted">Peserta cukup isi nama. Tanpa akun.</span>
            </div>
          </div>
          <div className="landing-plan">
            <div className="row between">
              <span className="text-sm font-semibold">Dari rencana sampai berangkat</span>
              <span className="pill">2 hari · 1 malam</span>
            </div>
            <ol>
              {[
                [
                  CalendarDays,
                  'Cari tanggal yang cocok',
                  'Peserta menandai waktu luang di kalender.',
                ],
                [House, 'Pilih villa bersama', 'Bandingkan foto, fasilitas, dan hasil voting.'],
                [Car, 'Siapkan keberangkatan', 'Atur tempat duduk dan konfirmasi pembayaran.'],
              ].map(([Icon, title, description], i) => {
                const I = Icon as typeof Check;
                return (
                  <li key={i}>
                    <span className="plan-icon">
                      <I size={20} />
                    </span>
                    <div>
                      <h3>{String(title)}</h3>
                      <p>{String(description)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="landing-note">
              <Check size={16} />
              Semua informasi tersedia di link acara yang sama.
            </div>
          </div>
        </section>
      </main>
      <footer className="footer container row between">
        <span>Jadiin</span>
        <span>Untuk organizer dan teman seperjalanan.</span>
      </footer>
    </>
  );
}
