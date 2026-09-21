/** Canonical URLs never use localhost on Vercel, even if a local .env value was copied. */
export function appOrigin(env: Record<string, string | undefined> = process.env): string {
  const deployed = env.VERCEL === '1';
  const candidates = [
    env.NEXT_PUBLIC_APP_URL,
    ...(env.VERCEL_ENV === 'preview'
      ? [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
      : [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL]),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
      const local =
        url.hostname === 'localhost' ||
        url.hostname.endsWith('.localhost') ||
        url.hostname === '[::1]' ||
        url.hostname === '0.0.0.0' ||
        url.hostname.startsWith('127.');
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        (deployed && (local || url.protocol !== 'https:'))
      )
        continue;
      return url.origin;
    } catch {
      /* Try the next trusted environment value. */
    }
  }
  if (deployed)
    throw new Error(
      'Konfigurasi domain publik Vercel belum tersedia. Isi NEXT_PUBLIC_APP_URL dengan domain HTTPS.',
    );
  return 'http://localhost:3000';
}
