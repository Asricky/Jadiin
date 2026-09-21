'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="narrow section stack">
      <h1>Ups, ada gangguan.</h1>
      <p>Rencanamu tetap tersimpan. Coba muat ulang beberapa saat lagi.</p>
      <button className="button" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
