import Link from 'next/link';
import { ArrowUpRight, CalendarDays, House, Route, Trees, Check } from 'lucide-react';
import { Brand } from '@/components/common';
export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Brand />
          <div className="row">
            <Link className="nav-link" href="/login">
              Masuk organizer
            </Link>
            <Link className="button" href="/register">
              Mulai rencana <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </header>
      <main className="container">
        <section
          className="hero grid grid-2"
          style={{ alignItems: 'center', gap: 50, paddingBottom: 64 }}
        >
          <div className="stack">
            <span className="eyebrow">LESS RIBET, MORE MAK RAB</span>
            <h1>
              Rencana bareng.<span className="hero-line">Cerita yang dikenang.</span>
            </h1>
            <p>
              Pilih tanggal, temukan villa, dan atur perjalanan. Semua rencana makrab di satu
              tempat, tinggal bagikan link ke grup.
            </p>
            <div className="row">
              <Link href="/register" className="button">
                Bikin acara pertamamu <ArrowUpRight size={18} />
              </Link>
              <span className="muted" style={{ fontSize: 12 }}>
                Participant tanpa login.
              </span>
            </div>
          </div>
          <div className="hero-art" style={{ minHeight: 360 }}>
            <Trees size={150} strokeWidth={1} />
            <span className="hero-sticker sticker-one">☀ Akhirnya, jadi berangkat!</span>
            <span className="hero-sticker sticker-two">✓ Satu link. Semua ikut.</span>
          </div>
        </section>
        <div className="row between" style={{ marginBottom: 24 }}>
          <h2>Dari “kapan nih?” ke “gas!”</h2>
          <span className="eyebrow">RENCANA JADI NYATA</span>
        </div>
        <section className="grid grid-3">
          {[
            [
              CalendarDays,
              '01',
              'Cari waktu bareng',
              'Semua pilih tanggal luang. Temukan waktu yang paling pas.',
            ],
            [
              House,
              '02',
              'Pilih tempat favorit',
              'Lihat villa, fasilitas, dan hasil voting dalam satu tempat.',
            ],
            [
              Route,
              '03',
              'Berangkat tanpa ribet',
              'Atur kendaraan dan pembayaran. Tinggal siapkan cerita.',
            ],
          ].map(([Icon, n, title, desc]) => {
            const I = Icon as typeof Check;
            return (
              <article className="card stack" key={String(n)}>
                <div className="row between">
                  <I size={28} strokeWidth={1.5} />
                  <span className="eyebrow">{String(n)}</span>
                </div>
                <div>
                  <h3>{String(title)}</h3>
                  <p style={{ fontSize: 13, marginTop: 8 }}>{String(desc)}</p>
                </div>
              </article>
            );
          })}
        </section>
      </main>
      <footer className="footer container row between">
        <Brand />
        <span>Dibuat untuk momen yang layak direncanakan.</span>
      </footer>
    </>
  );
}
