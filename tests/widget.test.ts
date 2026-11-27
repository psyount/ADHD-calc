import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// @ts-expect-error mjs 스크립트
import { buildWidget } from '../scripts/build-widget.mjs';
import * as pk from '../lib/pk-core.js';

const H = 3600000;

describe('Scriptable 위젯', () => {
  it('저장된 FocusWidget.js 가 최신이다 (npm run widget 실행 필요 여부)', () => {
    expect(readFileSync('scriptable/FocusWidget.js', 'utf8')).toBe(buildWidget());
  });

  it('위젯 안의 계산이 웹앱 계산과 같다', () => {
    const src = buildWidget() as string;
    const core = src.slice(src.indexOf('// ===== 약동학 계산 핵심'), src.indexOf('// ===== 약동학 계산 끝'));
    const ctx: Record<string, unknown> = {};
    vm.createContext(ctx);
    vm.runInContext(core + '\nthis.summarize = summarize; this.series = series; this.DEFAULT_PARAMS = DEFAULT_PARAMS;', ctx);
    const doses = [
      { t: 0, mg: 18, kind: 'mph-oros' as const },
      { t: 5 * H, mg: 100, kind: 'caffeine' as const, withFood: true },
      { t: 9 * H, mg: 100, kind: 'caffeine' as const },
    ];
    const P = pk.DEFAULT_PARAMS;
    for (const now of [2 * H, 7 * H, 11 * H, 16 * H]) {
      const a = JSON.stringify(pk.summarize(doses, now, P));
      const b = JSON.stringify((ctx.summarize as typeof pk.summarize)(doses, now, P));
      expect(b).toBe(a);
    }
    const s1 = pk.series(doses, 'mph-oros', 0, 20 * H, 10, P);
    const s2 = (ctx.series as typeof pk.series)(doses, 'mph-oros', 0, 20 * H, 10, P);
    expect(JSON.stringify(s2)).toBe(JSON.stringify(s1));
  });

  it('위젯 스크립트 문법이 맞다', () => {
    // Scriptable은 최상위 await를 허용하므로 async 함수로 감싸서 문법만 확인
    expect(() => new vm.Script('(async () => {' + buildWidget() + '\n})')).not.toThrow();
  });
});
