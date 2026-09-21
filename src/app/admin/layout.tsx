import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Brand } from '@/components/common';
import { configured, supabase } from '@/lib/supabase/server';
import { Logout } from '@/components/admin-shell';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!configured()) redirect('/login');
  const {
    data: { user },
  } = await (await supabase()).auth.getUser();
  if (!user) redirect('/login');
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Brand />
          <div className="row">
            <Link className="nav-link" href="/admin/events">
              Acara saya
            </Link>
            <span className="avatar">
              {String(user.user_metadata.display_name || 'A').slice(0, 1)}
            </span>
            <Logout />
          </div>
        </div>
      </header>
      {children}
      <footer className="container footer row between">
        <span>Rencana bareng, cerita bareng.</span>
        <span>Makrab Planner © {new Date().getFullYear()}</span>
      </footer>
    </>
  );
}
