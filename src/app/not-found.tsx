import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="narrow section stack">
      <h1>Acara belum ditemukan.</h1>
      <p>Periksa kembali link dari organizer. Acara mungkin belum dipublikasikan.</p>
      <Link className="button" href="/">
        Kembali ke beranda
      </Link>
    </main>
  );
}
