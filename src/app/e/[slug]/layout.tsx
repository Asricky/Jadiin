import { Brand } from '@/components/common';
export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="narrow topbar-inner">
          <Brand />
        </div>
      </header>
      {children}
      <footer className="narrow footer">Makrab Planner</footer>
    </>
  );
}
