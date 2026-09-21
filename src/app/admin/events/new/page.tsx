import { CreateWizard } from '@/components/create-wizard';
export default function NewEvent() {
  return (
    <main className="narrow section stack">
      <span className="eyebrow">SATU LANGKAH MENUJU CERITA BARU</span>
      <h1>Bikin rencana seru.</h1>
      <p>Mulai dari detail sederhana. Kamu bisa melengkapinya sebelum membagikan link.</p>
      <CreateWizard />
    </main>
  );
}
