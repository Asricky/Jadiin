import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { service } from './supabase/server';
export const newToken = () => randomBytes(32).toString('base64url');
export function hashToken(token: string) {
  const secret = process.env.PARTICIPANT_TOKEN_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('PARTICIPANT_TOKEN_SECRET minimal 32 karakter');
  return createHmac('sha256', secret).update(token).digest('hex');
}
export const cookieName = (eventId: string) => `mp_${eventId}`;
export async function setSession(eventId: string, token: string) {
  (await cookies()).set(cookieName(eventId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/`,
    maxAge: 60 * 60 * 24 * 180,
  });
}
export async function session(eventId: string) {
  const token = (await cookies()).get(cookieName(eventId))?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = hashToken(token);
  const { data, error } = await service()
    .from('participants')
    .select('id,name,whatsapp,vehicle_type,stage2_submitted_at')
    .eq('event_id', eventId)
    .eq('access_token_hash', hash)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, hash, token } : null;
}
