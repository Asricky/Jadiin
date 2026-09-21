import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const rupiah = (n: number | null) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);
export const prettyDate = (s: string) =>
  s.includes('T')
    ? new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(s))
    : format(parseISO(s), 'EEEE, d MMM yyyy', { locale: id });
export const inputDateTime = (s: string | null) =>
  s ? new Date(new Date(s).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16) : '';
export const mediaUrl = (path: string | null) =>
  path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/villa-media/${path}`
    : null;
export async function api<T = Record<string, string>>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Permintaan gagal. Coba lagi.');
  return data;
}
