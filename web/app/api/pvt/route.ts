import { NextResponse } from 'next/server';
import { body, bad, parseTime } from '@/lib/api';
import { put, remove, newId, type PvtResult } from '@/lib/store';

export async function POST(req: Request) {
  const b = await body(req);
  const medianMs = Number(b.medianMs);
  if (!(medianMs > 80 && medianMs < 3000)) return bad('medianMs 값이 이상해요');
  const t = parseTime(b.time);
  if (t == null) return bad('time 형식을 못 읽었어요');
  const r: PvtResult = { id: newId(), t, medianMs, lapses: Number(b.lapses ?? 0), n: Number(b.n ?? 0) };
  await put('pvts', r);
  return NextResponse.json({ ok: true, result: r });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return bad('id 필요');
  await remove('pvts', id);
  return NextResponse.json({ ok: true });
}
