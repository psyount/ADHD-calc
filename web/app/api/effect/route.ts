import { NextResponse } from 'next/server';
import { body, bad, parseTime } from '@/lib/api';
import { put, remove, newId, type EffectMark } from '@/lib/store';

export async function POST(req: Request) {
  const b = await body(req);
  const type = b.type === 'end' ? 'end' : b.type === 'start' ? 'start' : null;
  if (!type) return bad('type은 start 또는 end');
  const t = parseTime(b.time);
  if (t == null) return bad('time 형식을 못 읽었어요');
  const mark: EffectMark = { id: newId(), t, type };
  await put('effects', mark);
  return NextResponse.json({ ok: true, mark });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return bad('id 필요');
  await remove('effects', id);
  return NextResponse.json({ ok: true });
}
