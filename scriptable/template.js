// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: chart-line;

// FocusCurve 위젯 (Scriptable)
// 이 파일은 scripts/build-widget.mjs 가 만든다. 직접 고치지 말고 scriptable/template.js 를 고친 뒤
// npm run widget 으로 다시 만든다.

// ===== 여기 두 줄만 내 값으로 바꾸기 =====
const BASE_URL = 'https://내-앱-주소.vercel.app';
const API_TOKEN = '여기에-API_TOKEN';
// =========================================

const CACHE_KEY = 'focuscurve.widget.cache';
// H(1시간 ms)는 아래 약동학 계산 부분에 있다
const C = {
  bg: new Color('#0b0d12'),
  card: new Color('#151922'),
  text: new Color('#e9ecf2'),
  muted: new Color('#8b93a7'),
  blue: new Color('#6ea8ff'),
  amber: new Color('#f5b544'),
  red: new Color('#ff7a6b'),
  purple: new Color('#a78bfa'),
  grid: new Color('#222835'),
  thr: new Color('#9aa3ff'),
};
const PHASE_COLOR = { none: C.muted, rising: C.blue, peak: C.red, falling: C.purple, ended: C.muted };

/*__PK_CORE__*/

async function loadData() {
  try {
    const req = new Request(BASE_URL.replace(/\/$/, '') + '/api/widget');
    req.headers = { Authorization: 'Bearer ' + API_TOKEN };
    req.timeoutInterval = 10;
    const data = await req.loadJSON();
    if (!data || !data.params) throw new Error(data && data.error ? data.error : '응답 이상');
    Keychain.set(CACHE_KEY, JSON.stringify(data));
    return { data: data, stale: false };
  } catch (e) {
    if (Keychain.contains(CACHE_KEY)) return { data: JSON.parse(Keychain.get(CACHE_KEY)), stale: true };
    return { data: null, error: String(e) };
  }
}

// 점선
function dashed(ctx, x1, y1, x2, y2, color, dash) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.floor(len / (dash * 2));
  ctx.setStrokeColor(color);
  ctx.setLineWidth(1);
  for (let i = 0; i <= n; i++) {
    const a = (i * 2 * dash) / len;
    const b = Math.min(1, ((i * 2 + 1) * dash) / len);
    const p = new Path();
    p.move(new Point(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a));
    p.addLine(new Point(x1 + (x2 - x1) * b, y1 + (y2 - y1) * b));
    ctx.addPath(p);
    ctx.strokePath();
  }
}

// 곡선 그림. pts: [{t, v}], vMax: y축 최대
function drawCurve(opts) {
  const w = opts.w, h = opts.h, pts = opts.pts, from = opts.from, to = opts.to, now = opts.now;
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const pad = { l: 2, r: 2, t: 6, b: opts.labels ? 14 : 4 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const X = (t) => pad.l + ((t - from) / (to - from)) * iw;
  const Y = (v) => pad.t + ih - (Math.min(v, opts.vMax) / opts.vMax) * ih;

  // 바닥선과 시간 눈금
  ctx.setFillColor(C.grid);
  ctx.fillRect(new Rect(pad.l, pad.t + ih, iw, 1));
  if (opts.labels) {
    ctx.setFont(Font.systemFont(9));
    ctx.setTextColor(C.muted);
    const step = (to - from) / H > 20 ? 6 : 3;
    for (let t = Math.ceil((from + 9 * H) / (step * H)) * step * H - 9 * H; t <= to; t += step * H) {
      const hr = new Date(t + 9 * H).getUTCHours();
      const label = hr === 0 ? '0시' : hr === 12 ? '정오' : String(hr > 12 ? hr - 12 : hr);
      ctx.drawTextInRect(label, new Rect(X(t) - 15, pad.t + ih + 2, 30, 12));
    }
  }
  // 기준선
  if (opts.thr != null) dashed(ctx, pad.l, Y(opts.thr), w - pad.r, Y(opts.thr), C.thr, 3);

  // 효과 구간 색칠 (기준선 이상)
  if (opts.band) {
    // 연속 구간마다 다각형 하나로 칠한다 (85% 이상은 피크 색)
    const kindOf = (v) => (v < opts.thr ? null : v >= 85 ? 'peak' : 'on');
    let i = 0;
    while (i < pts.length) {
      const k = kindOf(pts[i].v);
      if (!k) { i++; continue; }
      let j = i;
      while (j + 1 < pts.length && kindOf(pts[j + 1].v) === k) j++;
      const end = Math.min(j + 1, pts.length - 1); // 다음 구간과 틈 없이 이어지게
      const path = new Path();
      path.move(new Point(X(pts[i].t), pad.t + ih));
      for (let q = i; q <= end; q++) path.addLine(new Point(X(pts[q].t), Y(pts[q].v)));
      path.addLine(new Point(X(pts[end].t), pad.t + ih));
      path.closeSubpath();
      ctx.addPath(path);
      ctx.setFillColor(new Color(k === 'peak' ? '#ff7a6b' : '#6ea8ff', 0.25));
      ctx.fillPath();
      i = j + 1;
    }
  }
  // 곡선: 지난 부분은 진하게, 앞으로는 흐리게
  const past = pts.filter((p) => p.t <= now);
  const fut = pts.filter((p) => p.t >= now);
  const stroke = (list, color, width) => {
    if (list.length < 2) return;
    const p = new Path();
    p.move(new Point(X(list[0].t), Y(list[0].v)));
    for (let i = 1; i < list.length; i++) p.addLine(new Point(X(list[i].t), Y(list[i].v)));
    ctx.addPath(p);
    ctx.setStrokeColor(color);
    ctx.setLineWidth(width);
    ctx.strokePath();
  };
  stroke(past, opts.color, 2.2);
  stroke(fut, new Color(opts.colorHex, 0.55), 1.6);
  // 지금 점
  if (now >= from && now <= to) {
    const nowV = levelNear(pts, now);
    ctx.setFillColor(C.text);
    ctx.fillRect(new Rect(X(now) - 0.5, pad.t, 1, ih));
    ctx.setFillColor(opts.color);
    ctx.fillEllipse(new Rect(X(now) - 3.5, Y(nowV) - 3.5, 7, 7));
  }
  return ctx.getImage();
}

function levelNear(pts, t) {
  let best = pts[0];
  for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i].t - t) < Math.abs(best.t - t)) best = pts[i];
  return best ? best.v : 0;
}

function hm(t) {
  const d = new Date(t + 9 * H);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  return (h < 12 ? '오전 ' : '오후 ') + (h % 12 === 0 ? 12 : h % 12) + ':' + String(m).padStart(2, '0');
}

function text(stack, s, size, color, bold) {
  const t = stack.addText(s);
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

function timer(stack, t, size, color) {
  const d = stack.addDate(new Date(t));
  d.applyTimerStyle();
  d.font = Font.boldMonospacedSystemFont(size);
  d.textColor = color;
  return d;
}

function mphInfo(stack, sum, data, size) {
  const name = sum.doseT && data.names[sum.doseT] === 'concerta' ? '콘서타' : '메틸페니데이트';
  const dose = data.doses.filter((d) => d.t === sum.doseT)[0];
  text(stack, sum.phase === 'none' ? '메틸페니데이트' : name + ' ' + (dose ? dose.mg + 'mg' : ''), size - 2, C.muted);
  text(stack, sum.label, size + 6, PHASE_COLOR[sum.phase], true);
  if (sum.phase !== 'none' && sum.endT && sum.endT > Date.now()) {
    const row = stack.addStack();
    row.centerAlignContent();
    text(row, '효과 끝까지 ', size - 2, C.muted);
    timer(row, sum.endT, size, C.text);
  } else if (sum.phase !== 'none') {
    text(stack, Math.round(sum.elapsedMin / 60) + '시간 경과', size - 2, C.muted);
  }
}

async function build() {
  const res = await loadData();
  const family = config.widgetFamily || 'large';
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.url = BASE_URL;
  w.refreshAfterDate = new Date(Date.now() + 20 * 60000);

  if (!res.data) {
    text(w, 'FocusCurve', 14, C.text, true);
    text(w, '불러오기 실패. 주소·토큰을 확인하세요.', 11, C.muted);
    return w;
  }
  const data = res.data;
  const now = Date.now();
  const p = data.params;
  const sum = summarize(data.doses, now, p);

  // 잠금화면 위젯
  if (family === 'accessoryInline') {
    text(w, sum.mph.phase === 'none' ? '오늘 복용 없음' : sum.mph.label + ' · ' + Math.round(sum.mph.pct) + '%', 12, C.text);
    return w;
  }
  if (family === 'accessoryCircular') {
    w.addSpacer();
    const s = w.addStack();
    s.addSpacer();
    text(s, sum.mph.phase === 'none' ? '–' : Math.round(sum.mph.pct) + '%', 16, Color.white(), true);
    s.addSpacer();
    const s2 = w.addStack();
    s2.addSpacer();
    text(s2, sum.mph.phase === 'none' ? '약' : sum.mph.label, 9, Color.white());
    s2.addSpacer();
    w.addSpacer();
    return w;
  }
  if (family === 'accessoryRectangular') {
    text(w, sum.mph.phase === 'none' ? '오늘 복용 없음' : sum.mph.label + ' · ' + Math.round(sum.mph.pct) + '%', 13, Color.white(), true);
    if (sum.mph.endT && sum.mph.endT > now) {
      const r = w.addStack();
      text(r, '끝까지 ', 11, Color.white());
      timer(r, sum.mph.endT, 11, Color.white());
    }
    if (sum.caf.aboveSleepLine && sum.caf.sleepOkT) text(w, '카페인 ' + hm(sum.caf.sleepOkT) + '까지', 11, Color.white());
    return w;
  }

  w.setPadding(12, 12, 10, 12);
  const from = now - 8 * H, to = now + 12 * H;
  const mphPts = series(data.doses, 'mph-oros', from, to, 10, p).map((x) => ({ t: x.t, v: x.pct }));

  if (family === 'small') {
    mphInfo(w, sum.mph, data, 12);
    w.addSpacer(6);
    w.addImage(drawCurve({ w: 140, h: 50, pts: mphPts, from: from, to: to, now: now, vMax: 105, thr: p.mphThresholdPct, band: true, color: C.blue, colorHex: '#6ea8ff' }));
    w.addSpacer();
    return w;
  }

  if (family === 'medium') {
    const row = w.addStack();
    const left = row.addStack();
    left.layoutVertically();
    left.size = new Size(110, 0);
    mphInfo(left, sum.mph, data, 12);
    left.addSpacer(6);
    const caf = left.addStack();
    caf.layoutVertically();
    text(caf, '카페인 ' + Math.round(sum.caf.ngml) + ' ng/mL', 10, C.amber);
    if (sum.caf.aboveSleepLine && sum.caf.sleepOkT) text(caf, '수면 ' + hm(sum.caf.sleepOkT) + '~', 10, C.muted);
    left.addSpacer();
    row.addSpacer(8);
    row.addImage(drawCurve({ w: 190, h: 120, pts: mphPts, from: from, to: to, now: now, vMax: 105, thr: p.mphThresholdPct, band: true, labels: true, color: C.blue, colorHex: '#6ea8ff' }));
    return w;
  }

  // large
  const top = w.addStack();
  const l = top.addStack();
  l.layoutVertically();
  mphInfo(l, sum.mph, data, 13);
  top.addSpacer();
  const r = top.addStack();
  r.layoutVertically();
  text(r, '카페인', 11, C.muted);
  text(r, Math.round(sum.caf.ngml) + ' ng/mL', 16, C.amber, true);
  text(r, '오늘 ' + data.cafTodayMg + '/' + data.cafLimitMg + 'mg', 10, data.cafTodayMg > data.cafLimitMg ? C.red : C.muted);
  w.addSpacer(8);
  w.addImage(drawCurve({ w: 300, h: 95, pts: mphPts, from: from, to: to, now: now, vMax: 105, thr: p.mphThresholdPct, band: true, labels: true, color: C.blue, colorHex: '#6ea8ff' }));
  w.addSpacer(6);
  const cafPts = series(data.doses, 'caffeine', from, to, 10, p).map((x) => ({ t: x.t, v: x.raw }));
  const cafMax = Math.max(1500, Math.max.apply(null, cafPts.map((x) => x.v))) * 1.1;
  w.addImage(drawCurve({ w: 300, h: 70, pts: cafPts, from: from, to: to, now: now, vMax: cafMax, thr: p.cafSleepNgMl, labels: true, color: C.amber, colorHex: '#f5b544' }));
  w.addSpacer(4);
  const foot = w.addStack();
  text(foot, sum.caf.aboveSleepLine && sum.caf.sleepOkT ? '카페인 수면선 아래로 ' + hm(sum.caf.sleepOkT) : '카페인 수면선 아래', 10, C.muted);
  foot.addSpacer();
  text(foot, (res.stale ? '오프라인 · ' : '') + '업데이트 ' + hm(now), 9, C.muted);
  return w;
}

const widget = await build();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentLarge();
}
Script.complete();
