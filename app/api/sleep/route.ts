import { NextResponse } from 'next/server';
import { body, bad, parseTime } from '@/lib/api';
import { all, put, remove, newId, type SleepRecord } from '@/lib/store';

// 단축어: { sleepStart: "2026-11-28T01:20:00+09:00" } (같은 밤 기록은 덮어씀)
export async function POST(req: Request) {
  const b = await body(req);
  const raw = b.sleepStart ?? b.time;
  if (raw == null || raw === '') return bad('sleepStart 필요');
  const t = parseTime(raw);
  if (t == null) return bad('sleepStart 형식을 못 읽었어요');
  const existing = await all<SleepRecord>('sleeps');
  for (const s of existing) if (Math.abs(s.t - t) < 10 * 3600000) await remove('sleeps', s.id);
  const rec: SleepRecord = { id: newId(), t };
  await put('sleeps', rec);
  return NextResponse.json({ ok: true, sleep: rec, message: '잠든 시각을 기록했어요' });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return bad('id 필요');
  await remove('sleeps', id);
  return NextResponse.json({ ok: true });
}
