import { NextResponse } from 'next/server';
import { body, bad } from '@/lib/api';
import { get, put, type DayRecord } from '@/lib/store';
import { kstDate } from '@/lib/calibrate';

export async function POST(req: Request) {
  const b = await body(req);
  const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : kstDate(Date.now());
  const cur = (await get<DayRecord>('days', date)) ?? { date };
  const next: DayRecord = { ...cur };
  if (b.condition !== undefined) {
    const c = Number(b.condition);
    if (!(c >= 1 && c <= 5)) return bad('condition은 1~5');
    next.condition = c;
  }
  if (b.memo !== undefined) next.memo = String(b.memo).slice(0, 2000);
  await put('days', next);
  return NextResponse.json({ ok: true, day: next });
}
