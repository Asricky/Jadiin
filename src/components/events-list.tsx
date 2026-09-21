'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Plus, CalendarDays, Users } from 'lucide-react';
import { type Event, statusLabel } from '@/types/domain';
import { mediaUrl, prettyDate } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Button } from './ui/button';
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
    <main className="container section stack">
      <header className="row between page-heading">
        <div className="stack-sm">
          <p className="text-sm">Workspace {name}</p>
          <h1>Acara kamu</h1>
          <p>Siapkan rencana, bagikan link, dan pantau jawaban peserta.</p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">
            <Plus size={17} />
            Buat acara baru
          </Link>
        </Button>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList variant="line" aria-label="Filter acara">
          <TabsTrigger value="active">Berjalan</TabsTrigger>
          <TabsTrigger value="completed">Selesai</TabsTrigger>
          <TabsTrigger value="archived">Arsip</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          {shown.length ? (
            <div className="event-list">
              {shown.map((e) => (
                <Link key={e.id} href={`/admin/events/${e.id}`} className="event-row">
                  <div className="event-thumbnail">
                    {e.cover_path ? (
                      <img src={mediaUrl(e.cover_path)!} alt="" />
                    ) : (
                      <CalendarDays size={25} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="event-row-body">
                    <div className="row between">
                      <h3>{e.name}</h3>
                      <span className={`badge badge-${e.status}`}>{statusLabel[e.status]}</span>
                    </div>
                    <p className="line-clamp-1 text-sm mt-1">
                      {e.description || 'Lengkapi detail dan mulai mengumpulkan jawaban.'}
                    </p>
                    <div className="event-meta">
                      <span className="row">
                        <Users size={14} />
                        {e.participants[0]?.count || 0} peserta
                      </span>
                      <span>
                        {e.final_date
                          ? prettyDate(e.final_date)
                          : e.stage1_deadline
                            ? `Batas voting ${prettyDate(e.stage1_deadline)}`
                            : 'Tanggal belum ditetapkan'}
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="hide-mobile" size={18} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">
              <CalendarDays size={28} />
              <h3>{tab === 'active' ? 'Belum ada acara berjalan' : 'Belum ada acara di sini'}</h3>
              <p>
                {tab === 'active'
                  ? 'Mulai dengan nama acara, beberapa tanggal, dan pilihan villa.'
                  : 'Acara dengan fase ini akan muncul di sini.'}
              </p>
              {tab === 'active' && (
                <Button asChild>
                  <Link href="/admin/events/new">Buat acara pertama</Link>
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
