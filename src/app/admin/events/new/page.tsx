import { CreateWizard } from '@/components/create-wizard';
export default function NewEvent() {
  return (
    <main className="narrow section stack">
      <span className="eyebrow">ACARA BARU</span>
      <h1>Buat acara</h1>
      <p>Isi detail acara, kandidat tanggal, dan pilihan villa.</p>
      <CreateWizard />
    </main>
  );
}
