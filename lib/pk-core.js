// ===== 약동학 계산 핵심 =====
// 이 파일은 웹앱과 Scriptable 위젯이 함께 쓴다.
// scripts/build-widget.mjs 가 이 파일을 위젯 스크립트에 그대로 붙여 넣으므로
// import 없이 순수 함수만 둔다. (export 키워드는 생성할 때 지워진다)

export const PK = {
  // d-메틸페니데이트 (FocusCurve 모델 소개 수치)
  mph: { F: 0.22, t12: 3.0, vdPerKg: 2.65, ka: 1.5, activeFraction: 0.5 },
  // 카페인
  caf: { F: 0.99, t12: 5.0, vdPerKg: 0.7, ka: 4.0, foodKa: 0.8 },
  // 콘서타 OROS: 22% 즉시, 78% 일정 시간 동안 균등 방출
  oros: { immediate: 0.22 },
};

export const DEFAULT_PARAMS = {
  weightKg: 85,
  releaseH: 7, // OROS 78% 방출 시간 (복용 후 7시간쯤 피크)
  mphThresholdPct: 50, // 이 % 이상이면 효과 구간
  cafSleepNgMl: 1000, // 이 아래로 내려가면 수면 방해 적음
};

const H = 3600000; // 1시간(ms)

// 단위 복용량 1이 들어갔을 때의 베이트만 곡선 (F/Vd 제외)
export function bateman(t, ka, ke) {
  if (t <= 0) return 0;
  return (ka / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t));
}

// 베이트만 곡선을 0~t 동안 적분한 값 (일정 속도 방출 계산용)
export function batemanIntegral(t, ka, ke) {
  if (t <= 0) return 0;
  return (ka / (ka - ke)) * ((1 - Math.exp(-ke * t)) / ke - (1 - Math.exp(-ka * t)) / ka);
}

// 콘서타 OROS 복용 후 t시간의 d-MPH 농도(mg/L)
export function mphConc(tH, mg, weightKg, releaseH) {
  if (tH <= 0) return 0;
  const p = PK.mph;
  const ke = Math.LN2 / p.t12;
  const amount = mg * p.activeFraction * p.F; // 몸에 들어가는 d-MPH(mg)
  const vd = p.vdPerKg * weightKg;
  const imm = PK.oros.immediate;
  const rate = (1 - imm) / releaseH; // 시간당 방출 비율
  const shape =
    imm * bateman(tH, p.ka, ke) +
    rate * (batemanIntegral(tH, p.ka, ke) - batemanIntegral(tH - releaseH, p.ka, ke));
  return (amount / vd) * shape;
}

// 카페인 복용 후 t시간의 농도(ng/mL)
export function cafConc(tH, mg, weightKg, withFood) {
  if (tH <= 0) return 0;
  const p = PK.caf;
  const ke = Math.LN2 / p.t12;
  const ka = withFood ? p.ka * p.foodKa : p.ka;
  const vd = p.vdPerKg * weightKg;
  return ((mg * p.F) / vd) * bateman(tH, ka, ke) * 1000; // mg/L → ng/mL
}

// doses: [{ t: 복용시각(ms), mg, kind: 'mph-oros'|'caffeine', withFood }]
// 여러 번 복용하면 곡선을 더한다.
export function levelAt(ms, doses, kind, params) {
  let sum = 0;
  for (let i = 0; i < doses.length; i++) {
    const d = doses[i];
    if (d.kind !== kind) continue;
    const tH = (ms - d.t) / H;
    if (tH <= 0 || tH > 72) continue;
    sum +=
      kind === 'mph-oros'
        ? mphConc(tH, d.mg, params.weightKg, params.releaseH)
        : cafConc(tH, d.mg, params.weightKg, !!d.withFood);
  }
  return sum;
}

// 메틸페니데이트를 % 로 보여 줄 때의 기준:
// 각 시각 앞뒤 15시간 안의 최고치를 100%로 본다. (그날 복용 주기의 최고치 대비 %)
const NORM_WINDOW_H = 15;

// from~to 구간을 stepMin 간격으로 계산한 배열
// mph: { t, raw, pct }  caffeine: { t, raw(ng/mL) }
export function series(doses, kind, fromMs, toMs, stepMin, params) {
  const step = stepMin * 60000;
  if (kind !== 'mph-oros') {
    const out = [];
    for (let t = fromMs; t <= toMs; t += step) out.push({ t: t, raw: levelAt(t, doses, kind, params) });
    return out;
  }
  const pad = NORM_WINDOW_H * H;
  const raws = [];
  for (let t = fromMs - pad; t <= toMs + pad; t += step) raws.push({ t: t, raw: levelAt(t, doses, kind, params) });
  const w = Math.round(pad / step);
  // 아주 작은 잔여량이 100%로 부풀지 않도록 최소 기준(18mg 최고치의 5%)
  const floor = singleDosePeak(18, params) * 0.05;
  const out = [];
  for (let i = w; i < raws.length - w; i++) {
    let m = 0;
    for (let j = i - w; j <= i + w; j++) if (raws[j].raw > m) m = raws[j].raw;
    const pct = m < floor ? 0 : (raws[i].raw / m) * 100;
    out.push({ t: raws[i].t, raw: raws[i].raw, pct: pct });
  }
  return out;
}

// 콘서타 한 번 복용했을 때의 최고 농도(mg/L)
export function singleDosePeak(mg, params) {
  let m = 0;
  for (let tH = 0; tH <= 24; tH += 0.1) {
    const c = mphConc(tH, mg, params.weightKg, params.releaseH);
    if (c > m) m = c;
  }
  return m;
}

// 지금 상태 요약
// 반환: { mph: {...}, caf: {...} }
export function summarize(doses, nowMs, params) {
  return { mph: summarizeMph(doses, nowMs, params), caf: summarizeCaf(doses, nowMs, params) };
}

function summarizeMph(doses, nowMs, params) {
  const recent = doses.filter((d) => d.kind === 'mph-oros' && d.t <= nowMs && nowMs - d.t < 24 * H);
  if (!recent.length) return { phase: 'none', label: '오늘 복용 없음' };
  const first = Math.min.apply(null, recent.map((d) => d.t));
  const last = Math.max.apply(null, recent.map((d) => d.t));
  const s = series(doses, 'mph-oros', first, last + 24 * H, 5, params);
  let peakIdx = 0;
  for (let i = 0; i < s.length; i++) if (s[i].raw > s[peakIdx].raw) peakIdx = i;
  const thr = params.mphThresholdPct;
  let startT = null;
  let endT = null;
  for (let i = 0; i <= peakIdx; i++) if (s[i].pct >= thr) { startT = s[i].t; break; }
  for (let i = peakIdx; i < s.length; i++) if (s[i].pct < thr) { endT = s[i].t; break; }
  const nowPt = nearest(s, nowMs);
  const pct = nowPt ? nowPt.pct : 0;
  const peakT = s[peakIdx].t;
  let phase;
  let label;
  if (nowMs < peakT) {
    phase = pct >= 85 ? 'peak' : 'rising';
  } else if (pct >= 85) {
    phase = 'peak';
  } else if (endT && nowMs < endT) {
    phase = 'falling';
  } else {
    phase = 'ended';
  }
  label = { rising: '상승 중', peak: '피크', falling: '감소 중', ended: '효과 끝' }[phase];
  return {
    phase: phase,
    label: label,
    pct: pct,
    doseT: last,
    elapsedMin: Math.round((nowMs - last) / 60000),
    peakT: peakT,
    startT: startT,
    endT: endT,
  };
}

function summarizeCaf(doses, nowMs, params) {
  const now = levelAt(nowMs, doses, 'caffeine', params);
  const thr = params.cafSleepNgMl;
  let sleepOkT = null;
  if (now >= thr) {
    // 지금부터 48시간 안에서 기준선 아래로 내려가는 첫 시각 (5분 → 1분 정밀)
    let t = nowMs;
    for (; t < nowMs + 48 * H; t += 5 * 60000) if (levelAt(t, doses, 'caffeine', params) < thr) break;
    for (let u = t - 5 * 60000; u <= t; u += 60000) {
      if (levelAt(u, doses, 'caffeine', params) < thr) { sleepOkT = u; break; }
    }
  }
  return { ngml: now, aboveSleepLine: now >= thr, sleepOkT: sleepOkT };
}

function nearest(s, ms) {
  let best = null;
  for (let i = 0; i < s.length; i++) {
    if (!best || Math.abs(s[i].t - ms) < Math.abs(best.t - ms)) best = s[i];
  }
  return best;
}
// ===== 약동학 계산 끝 =====
