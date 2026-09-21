'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Plus, Trees, CalendarDays, Users, ArrowRight, Sparkles } from 'lucide-react';
import { type Event, statusLabel } from '@/types/domain';
import { mediaUrl, prettyDate } from '@/lib/utils';
export function EventsList({
  events,
  name,
}: {
  events: (Event & { participants: { count: number }[] })[];
  name: string;
}) {
  const [tab, setTab] = useState('active');
  const shown = events.filter((e) =>
    tab === 'active'
      ? !['COMPLETED', 'ARCHIVED'].includes(e.status)
      : tab === 'completed'
        ? e.status === 'COMPLETED'
        : e.status === 'ARCHIVED',
  );
  return (
    <main className="container">
      <section className="hero grid grid-2 dashboard-hero" style={{ alignItems: 'center' }}>
        <div className="stack">
          <span className="eyebrow">RUANG RENCANA KAMU</span>
          <h1>
            Halo, {name} <span style={{ fontSize: 30 }}>☀</span>
            <br />
            Ada cerita apa berikutnya?
          </h1>
          <p>
            Kumpulkan teman, pilih tempat, dan wujudkan rencana. Momen seru berikutnya dimulai dari
            sini.
          </p>
          <div>
            <Link className="button" href="/admin/events/new">
              <Plus size={17} /> Buat acara baru
            </Link>
          </div>
        </div>
        <div className="hero-art hide-mobile">
          <Trees size={110} strokeWidth={1} />
          <span className="hero-sticker sticker-one">Rencana kecil, cerita besar.</span>
          <span className="hero-sticker sticker-two">Let’s make it happen ✨</span>
        </div>
      </section>
      <section className="stack section" style={{ paddingTop: 16 }}>
        <div className="row between">
          <div className="row">
            <h2>Acara kamu</h2>
            <span className="pill">{events.length} acara</span>
          </div>
          <span className="muted hide-mobile" style={{ fontSize: 12 }}>
            Semua rencana, satu tempat.
          </span>
        </div>
        <div className="tabs">
          {[
            ['active', 'Berjalan'],
            ['completed', 'Selesai'],
            ['archived', 'Arsip'],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`tab ${tab === v ? 'active' : ''}`}
            >
              {l}
            </button>
          ))}
        </div>
        {shown.length ? (
          <div className="grid grid-3">
            {shown.map((e) => (
              <Link key={e.id} href={`/admin/events/${e.id}`} className="card event-card">
                <div className="event-cover">
                  {e.cover_path ? (
                    <img src={mediaUrl(e.cover_path)!} alt="" />
                  ) : (
                    <Trees size={70} strokeWidth={1} />
                  )}
                  <span className={`badge badge-${e.status}`}>{statusLabel[e.status]}</span>
                </div>
                <div className="event-content">
                  <h3>{e.name}</h3>
                  <p
                    style={{
                      fontSize: 12,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.description || 'Momen seru sedang direncanakan.'}
                  </p>
                  <div className="event-meta">
                    <span className="row" style={{ gap: 5 }}>
                      <Users size={14} />
                      {e.participants[0]?.count || 0} peserta
                    </span>
                    <span className="row" style={{ gap: 5 }}>
                      <CalendarDays size={14} />
                      {e.stage1_deadline
                        ? prettyDate(e.stage1_deadline).split(', ')[1]
                        : 'Belum ada deadline'}
                    </span>
                  </div>
                  <div className="event-footer">
                    <span>Kelola acara</span>
                    <ArrowUpRight size={18} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <Sparkles size={34} />
            <h3>
              {tab === 'active' ? 'Cerita berikutnya menunggu kamu.' : 'Belum ada acara di sini.'}
            </h3>
            <p>Buat acara pertamamu, bagikan link, dan biarkan semua ikut merencanakan.</p>
            <Link className="button" href="/admin/events/new">
              Buat acara <ArrowRight size={16} />
            </Link>
          </div>
        )}
        <div className="card card-lime row between">
          <div className="row">
            <span style={{ fontSize: 26 }}>✦</span>
            <div>
              <h3 style={{ fontSize: 15 }}>Lebih sedikit chat “jadi kapan?”</h3>
              <p style={{ fontSize: 12 }}>
                Bagikan satu link. Teman-teman pilih tanggal dan villa tanpa perlu akun.
              </p>
            </div>
          </div>
          <span className="eyebrow hide-mobile">MORE QUALITY TIME</span>
        </div>
      </section>
    </main>
  );
}
