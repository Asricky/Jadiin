import { Brand } from '@/components/common';
export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="narrow topbar-inner">
          <Brand />
          <span className="eyebrow hide-mobile">LET’S MAKE MEMORIES</span>
        </div>
      </header>
      {children}
      <footer className="narrow footer">Rencana bareng, cerita bareng. ✦ Makrab Planner</footer>
    </>
  );
}
