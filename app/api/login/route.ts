import { NextResponse } from 'next/server';
import { COOKIE, sessionValue } from '@/lib/auth';
import { body, bad } from '@/lib/api';

export async function POST(req: Request) {
  const { pin } = await body(req);
  if (!process.env.APP_PIN) return bad('APP_PIN이 설정되지 않았어요', 500);
  if (String(pin ?? '') !== process.env.APP_PIN) return bad('PIN이 틀렸어요', 401);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, (await sessionValue())!, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
