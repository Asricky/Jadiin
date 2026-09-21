'use client';
import { useState } from 'react';
import { Copy, Check, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { Button } from './ui/button';
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark">
        <CalendarDays size={19} />
      </span>
      Makrab <span className="brand-light">Planner</span>
    </Link>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return children ? (
    <div role={error ? 'alert' : 'status'} className={`notice ${error ? 'notice-error' : ''}`}>
      {children}
    </div>
  ) : null;
}
export function CopyButton({ value, label = 'Salin link' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setError(true);
        }
      }}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
      {error ? 'Gagal menyalin' : copied ? 'Tersalin' : label}
    </Button>
  );
}
export { UploadField } from './upload-field';
