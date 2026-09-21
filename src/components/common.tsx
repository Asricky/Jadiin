'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from './ui/button';
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Makrab Planner — beranda">
      <Image src="/brand/logo.png" alt="" width={56} height={56} className="brand-logo" priority />
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
