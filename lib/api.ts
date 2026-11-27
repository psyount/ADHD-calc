import { NextResponse } from 'next/server';
import { all, getSettings, type Dose, type EffectMark, type PvtResult, type SleepRecord, type DayRecord } from './store';
import { calibrate } from './calibrate';

export function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// 시각 해석: ms 숫자, ISO 문자열, "2026-11-28 01:20"(한국 시간) 모두 허용. 없으면 지금.
export function parseTime(v: unknown): number | null {
  if (v == null || v === '') return Date.now();
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^\d{10,13}$/.test(s)) return Number(s.length === 10 ? s + '000' : s);
  const local = s.match(/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (local) {
    const [, y, mo, d, h, mi, se] = local;
    return Date.UTC(+y, +mo - 1, +d, +h - 9, +mi, se ? +se : 0);
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

export async function loadAll() {
  const [doses, effects, pvts, sleeps, days, settings] = await Promise.all([
    all<Dose>('doses'),
    all<EffectMark>('effects'),
    all<PvtResult>('pvts'),
    all<SleepRecord>('sleeps'),
    all<DayRecord>('days'),
    getSettings(),
  ]);
  doses.sort((a, b) => a.t - b.t);
  effects.sort((a, b) => a.t - b.t);
  pvts.sort((a, b) => a.t - b.t);
  sleeps.sort((a, b) => a.t - b.t);
  const calibration = calibrate(doses, effects, pvts, sleeps, settings);
  return { doses, effects, pvts, sleeps, days, settings, calibration };
}
