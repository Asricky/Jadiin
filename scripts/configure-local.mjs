import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env.local')) throw new Error('.env.local sudah ada; tidak ditimpa.');
const status = JSON.parse(
  execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
);
if (!status.API_URL || !status.ANON_KEY || !status.SERVICE_ROLE_KEY)
  throw new Error('Jalankan npx supabase start terlebih dahulu.');
writeFileSync(
  '.env.local',
  [
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${status.ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
    'NEXT_PUBLIC_APP_URL=http://localhost:3000',
    `PARTICIPANT_TOKEN_SECRET=${randomBytes(32).toString('hex')}`,
    '',
  ].join('\n'),
  { flag: 'wx', mode: 0o600 },
);
console.log('.env.local untuk Supabase lokal dibuat. Secret tidak dicetak.');
