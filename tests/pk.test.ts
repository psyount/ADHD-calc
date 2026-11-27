import { describe, it, expect } from 'vitest';
import { DEFAULT_PARAMS, mphConc, cafConc, levelAt, series, summarize, bateman, batemanIntegral } from '../lib/pk-core.js';
import { calibrate, shrink } from '../lib/calibrate';
import { DEFAULT_SETTINGS } from '../lib/store';

const H = 3600000;
const P = DEFAULT_PARAMS;

function peakHour(f: (t: number) => number) {
  let m = 0, mt = 0;
  for (let t = 0; t <= 30; t += 0.05) { const v = f(t); if (v > m) { m = v; mt = t; } }
  return { t: mt, v: m };
}

describe('약동학 계산', () => {
  it('베이트만 적분이 수치 적분과 같다', () => {
    const ka = 1.5, ke = Math.LN2 / 3;
    let s = 0;
    for (let t = 0; t < 5; t += 0.0001) s += bateman(t, ka, ke) * 0.0001;
    expect(batemanIntegral(5, ka, ke)).toBeCloseTo(s, 3);
  });

  it('콘서타 피크는 복용 후 6~8시간', () => {
    const p = peakHour((t) => mphConc(t, 18, 85, P.releaseH));
    expect(p.t).toBeGreaterThan(6);
    expect(p.t).toBeLessThan(8);
  });

  it('카페인 피크는 1시간 안쪽, 음식과 함께면 늦어진다', () => {
    const a = peakHour((t) => cafConc(t, 100, 85, false));
    const b = peakHour((t) => cafConc(t, 100, 85, true));
    expect(a.t).toBeLessThan(1);
    expect(b.t).toBeGreaterThan(a.t);
  });

  it('체중이 무거우면 카페인 최고 농도가 낮다', () => {
    const w70 = peakHour((t) => cafConc(t, 100, 70, false)).v;
    const w85 = peakHour((t) => cafConc(t, 100, 85, false)).v;
    expect(w85 / w70).toBeCloseTo(70 / 85, 5);
  });

  it('두 번 마시면 곡선이 더해진다', () => {
    const d1 = { t: 0, mg: 100, kind: 'caffeine' as const };
    const d2 = { t: 3 * H, mg: 100, kind: 'caffeine' as const };
    const at = 4 * H;
    expect(levelAt(at, [d1, d2], 'caffeine', P)).toBeCloseTo(
      levelAt(at, [d1], 'caffeine', P) + levelAt(at, [d2], 'caffeine', P), 8);
  });

  it('메틸페니데이트 %는 피크에서 100%', () => {
    const s = series([{ t: 0, mg: 36, kind: 'mph-oros' }], 'mph-oros', 0, 24 * H, 5, P);
    const max = Math.max(...s.map((p) => p.pct!));
    expect(max).toBeCloseTo(100, 5);
    expect(s[0].pct).toBe(0);
  });

  it('카페인이 수면 기준선 아래로 내려가는 시각을 찾는다', () => {
    const now = 0;
    const doses = [{ t: -1 * H, mg: 200, kind: 'caffeine' as const }];
    const { caf } = summarize(doses, now, P);
    expect(caf.aboveSleepLine).toBe(true);
    expect(caf.sleepOkT).not.toBeNull();
    expect(levelAt(caf.sleepOkT!, doses, 'caffeine', P)).toBeLessThan(P.cafSleepNgMl);
    expect(levelAt(caf.sleepOkT! - 60000, doses, 'caffeine', P)).toBeGreaterThanOrEqual(P.cafSleepNgMl);
  });

  it('상태: 복용 2시간 뒤 상승, 7시간 뒤 피크, 20시간 뒤 효과 끝', () => {
    const doses = [{ t: 0, mg: 18, kind: 'mph-oros' as const }];
    expect(summarize(doses, 2 * H, P).mph.phase).toBe('rising');
    expect(summarize(doses, 7 * H, P).mph.phase).toBe('peak');
    expect(summarize(doses, 20 * H, P).mph.phase).toBe('ended');
  });
});

describe('개인 보정', () => {
  it('기록이 없으면 기본값', () => {
    const c = calibrate([], [], [], [], DEFAULT_SETTINGS);
    expect(c.params.mphThresholdPct).toBe(50);
    expect(c.params.cafSleepNgMl).toBe(1000);
  });

  it('축소 보정: 5일이면 기본값과 내 값의 중간', () => {
    expect(shrink(50, 70, 5)).toBe(60);
    expect(shrink(50, 70, 0)).toBe(50);
  });

  it('효과 끝 탭이 늘 같은 %에서 찍히면 그 쪽으로 옮겨 간다', () => {
    const doses = [];
    const effects = [];
    const day0 = Date.UTC(2026, 10, 1, 0, 0); // 한국 오전 9시
    for (let i = 0; i < 10; i++) {
      const t = day0 + i * 24 * H;
      doses.push({ id: 'd' + i, drugId: 'concerta', kind: 'mph-oros' as const, mg: 18, t });
      effects.push({ id: 'e' + i, t: t + 13 * H, type: 'end' as const });
    }
    const c = calibrate(doses, effects, [], [], DEFAULT_SETTINGS);
    expect(c.mph.days.length).toBe(10);
    expect(c.mph.personal!).toBeLessThan(50); // 13시간 뒤면 50%보다 낮은 지점
    expect(c.params.mphThresholdPct).toBeLessThan(50);
    expect(c.params.mphThresholdPct).toBeGreaterThan(c.mph.personal!);
  });
});
