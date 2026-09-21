import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: {
    default: 'Jadiin',
    template: '%s · Jadiin',
  },
  description:
    'Dari pilih tanggal sampai siap berangkat. Rencanakan makrab bareng teman, semudah berbagi link.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
