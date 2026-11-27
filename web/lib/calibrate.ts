import { DEFAULT_PARAMS, series, levelAt, type Params, type PkDose, type Point } from './pk-core.js';
import type { Dose, EffectMark, PvtResult, SleepRecord, Settings } from './store';

const H = 3600000;
const SHRINK_K = 5; // 기본값 쪽으로 당기는 세기 (기록 5일 = 반반)

export function kstDate(t: number): string {
  return new Date(t + 9 * H).toISOString().slice(0, 10);
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function shrink(def: number, personal: number | null, n: number): number {
  if (personal == null || n === 0) return def;
  return (def * SHRINK_K + personal * n) / (SHRINK_K + n);
}

export function toPk(doses: Dose[]): PkDose[] {
  return doses.map((d) => ({ t: d.t, mg: d.mg, kind: d.kind, withFood: d.withFood }));
}

function nearestPct(s: Point[], t: number): number {
  let best = s[0];
  for (const p of s) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
  return best?.pct ?? 0;
}

export interface DayEstimate {
  date: string;
  value: number;
  from: string; // 'PVT' | '효과 기록' | 'PVT+효과 기록' | '수면'
}

export interface Calibration {
  params: Params; // 실제로 쓰는 값
  mph: { def: number; personal: number | null; calibrated: number; days: DayEstimate[]; pvtBaselineMs: number | null };
  caf: { def: number; personal: number | null; calibrated: number; days: DayEstimate[] };
}

export function calibrate(
  doses: Dose[],
  effects: EffectMark[],
  pvts: PvtResult[],
  sleeps: SleepRecord[],
  settings: Settings,
): Calibration {
  const base: Params = {
    ...DEFAULT_PARAMS,
    weightKg: settings.weightKg,
    releaseH: settings.releaseH,
  };
  const pk = toPk(doses);
  const mphDoses = doses.filter((d) => d.kind === 'mph-oros');

  // 날짜별 메틸페니데이트 곡선 (그날 첫 복용 1시간 전 ~ 24시간 뒤)
  const daySeries = new Map<string, { s: Point[]; peakT: number }>();
  for (const d of mphDoses) {
    const date = kstDate(d.t);
    if (daySeries.has(date)) continue;
    const s = series(pk, 'mph-oros', d.t - H, d.t + 24 * H, 5, base);
    let peak = s[0];
    for (const p of s) if (p.raw > peak.raw) peak = p;
    daySeries.set(date, { s, peakT: peak.t });
  }
  const pctAt = (t: number): { pct: number; afterPeak: boolean } | null => {
    // t가 속한 복용 주기를 찾는다 (같은 날 또는 전날 복용)
    for (const date of [kstDate(t), kstDate(t - 24 * H)]) {
      const ds = daySeries.get(date);
      if (ds && t >= ds.s[0].t && t <= ds.s[ds.s.length - 1].t) return { pct: nearestPct(ds.s, t), afterPeak: t > ds.peakT };
    }
    return null;
  };

  // PVT 개인 기준: 약효가 거의 없을 때(20% 미만)의 반응시간 중앙값
  const offMed = pvts.filter((p) => (pctAt(p.t)?.pct ?? 0) < 20).map((p) => p.medianMs);
  const pvtBaselineMs = offMed.length >= 3 ? median(offMed) : median(pvts.map((p) => p.medianMs));

  const byDay = new Map<string, { pvt: number[]; marks: number[] }>();
  const bucket = (date: string) => {
    if (!byDay.has(date)) byDay.set(date, { pvt: [], marks: [] });
    return byDay.get(date)!;
  };

  // PVT가 평소보다 5% 이상 빠른 구간의 처음/끝 → 그 시각 곡선 %
  if (pvtBaselineMs) {
    const pvtDays = new Map<string, PvtResult[]>();
    for (const p of pvts) {
      const date = kstDate(p.t);
      if (!daySeries.has(date)) continue;
      if (!pvtDays.has(date)) pvtDays.set(date, []);
      pvtDays.get(date)!.push(p);
    }
    for (const [date, list] of pvtDays) {
      if (list.length < 3) continue;
      const good = list.filter((p) => p.medianMs <= pvtBaselineMs * 0.95).sort((a, b) => a.t - b.t);
      if (!good.length) continue;
      const first = pctAt(good[0].t);
      const last = pctAt(good[good.length - 1].t);
      if (first && !first.afterPeak) bucket(date).pvt.push(first.pct);
      if (last && last.afterPeak) bucket(date).pvt.push(last.pct);
    }
  }
  // 효과 시작/끝 탭 기록
  for (const e of effects) {
    const p = pctAt(e.t);
    if (p) bucket(kstDate(e.t)).marks.push(p.pct);
  }

  const mphDays: DayEstimate[] = [];
  for (const [date, b] of byDay) {
    const vals = [...b.pvt, ...b.marks];
    const v = median(vals);
    if (v == null) continue;
    const from = b.pvt.length && b.marks.length ? 'PVT+효과 기록' : b.pvt.length ? 'PVT' : '효과 기록';
    mphDays.push({ date, value: Math.min(90, Math.max(15, v)), from });
  }
  mphDays.sort((a, b) => a.date.localeCompare(b.date));
  const mphPersonal = median(mphDays.map((d) => d.value));
  const mphCal = shrink(DEFAULT_PARAMS.mphThresholdPct, mphPersonal, mphDays.length);

  // 카페인: 실제로 잠든 시각의 농도 = 그 정도에서는 잠들 수 있었다는 기록
  const cafDays: DayEstimate[] = [];
  for (const s of sleeps) {
    const c = levelAt(s.t, pk, 'caffeine', base);
    if (c < 50) continue; // 카페인이 거의 없던 날은 정보가 없음
    cafDays.push({ date: kstDate(s.t - 12 * H), value: Math.min(3000, Math.max(300, c)), from: '수면' });
  }
  cafDays.sort((a, b) => a.date.localeCompare(b.date));
  const cafPersonal = median(cafDays.map((d) => d.value));
  const cafCal = shrink(DEFAULT_PARAMS.cafSleepNgMl, cafPersonal, cafDays.length);

  const params: Params = {
    ...base,
    mphThresholdPct: settings.useCalibration ? mphCal : DEFAULT_PARAMS.mphThresholdPct,
    cafSleepNgMl: settings.useCalibration ? cafCal : DEFAULT_PARAMS.cafSleepNgMl,
  };
  return {
    params,
    mph: { def: DEFAULT_PARAMS.mphThresholdPct, personal: mphPersonal, calibrated: mphCal, days: mphDays, pvtBaselineMs },
    caf: { def: DEFAULT_PARAMS.cafSleepNgMl, personal: cafPersonal, calibrated: cafCal, days: cafDays },
  };
}
