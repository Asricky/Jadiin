export default function Loading() {
  return (
    <main className="container section stack" aria-label="Memuat" aria-busy="true">
      <div className="skeleton" style={{ height: 45, width: '60%' }} />
      <div className="grid grid-3">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </main>
  );
}
