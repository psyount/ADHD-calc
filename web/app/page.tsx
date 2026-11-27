'use client';
import { useEffect, useMemo, useState } from 'react';
import Chart from '@/components/Chart';
import { useAppState, api, fmtTime, fmtDur, fmtDate } from '@/lib/client';
import { series, summarize } from '@/lib/pk-core.js';
import { toPk, kstDate } from '@/lib/calibrate';
import { PRESETS, drugById } from '@/lib/drugs';

const H = 3600000;
type Range = 'now' | '2d' | '1w';

export default function Dashboard() {
  const { data, error, reload } = useAppState();
  const [now, setNow] = useState(() => Date.now());
  const [range, setRange] = useState<Range>('now');
  const [scrubT, setScrubT] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const params = data.calibration.params;
    const pk = toPk(data.doses);
    const [from, to] =
      range === 'now' ? [now - 14 * H, now + 16 * H] : range === '2d' ? [now - 36 * H, now + 12 * H] : [now - 7 * 24 * H, now + 12 * H];
    const step = range === '1w' ? 20 : range === '2d' ? 10 : 5;
    const mph = series(pk, 'mph-oros', from, to, step, params);
    const caf = series(pk, 'caffeine', from, to, step, params);
    const sum = summarize(pk, now, params);
    // 효과 구간 (기준선 이상)
    const band: { from: number; to: number }[] = [];
    let cur: { from: number; to: number } | null = null;
    for (const p of mph) {
      if ((p.pct ?? 0) >= params.mphThresholdPct) {
        if (!cur) cur = { from: p.t, to: p.t };
        cur.to = p.t;
      } else if (cur) {
        band.push(cur);
        cur = null;
      }
    }
    if (cur) band.push(cur);
    // 취침 시각 선
    const [bh, bm] = data.settings.bedtime.split(':').map(Number);
    const bedtimes: number[] = [];
    for (let d = from - 24 * H; d <= to + 24 * H; d += 24 * H) {
      const ds = kstDate(d);
      const [y, mo, da] = ds.split('-').map(Number);
      bedtimes.push(Date.UTC(y, mo - 1, da, bh - 9, bm));
    }
    const cafMax = Math.max(1500, ...caf.map((p) => p.raw)) * 1.1;
    const today = kstDate(now);
    const cafToday = data.doses.filter((d) => d.kind === 'caffeine' && kstDate(d.t) === today).reduce((s, d) => s + d.mg, 0);
    const lastMph = [...data.doses].reverse().find((d) => d.kind === 'mph-oros' && d.t <= now);
    return { params, from, to, mph, caf, sum, band, bedtimes, cafMax, cafToday, lastMph };
  }, [data, range, now]);

  async function quick(drugId: string, mg: number, label: string) {
    setBusy(label);
    try {
      await api('/api/dose', 'POST', { drugId, mg });
      setToast(`${label} 기록했어요`);
      await reload();
    } catch (e) {
      setToast(String(e));
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 2500);
    }
  }
  async function mark(type: 'start' | 'end') {
    await api('/api/effect', 'POST', { type });
    setToast(type === 'start' ? '효과 시작을 기록했어요' : '효과 끝을 기록했어요');
    setTimeout(() => setToast(null), 2500);
    reload();
  }

  if (error) return <div className="page"><div className="card err">불러오기 실패: {error}</div></div>;
  if (!data || !view) return <div className="page muted">불러오는 중…</div>;

  const { sum, params } = view;
  const limit = Math.round(data.settings.weightKg * 2.5);
  const phaseColor = { none: '#8b93a7', rising: '#6ea8ff', peak: '#ff7a6b', falling: '#a78bfa', ended: '#8b93a7' }[sum.mph.phase];

  return (
    <div className="page">
      <header className="top">
        <h1>{fmtDate(now)}</h1>
        {data.storageMode === 'memory' && <span className="pill warn">저장소 미연결 (메모리)</span>}
      </header>

      <section className="status-grid">
        <div className="card status">
          <div className="muted small">{view.lastMph ? `${drugById(view.lastMph.drugId)?.name} ${view.lastMph.mg}mg` : '메틸페니데이트'}</div>
          <div className="big" style={{ color: phaseColor }}>{sum.mph.label}</div>
          {sum.mph.phase !== 'none' && (
            <div className="rows">
              <div><span className="muted">경과</span> {fmtDur(sum.mph.elapsedMin!)}</div>
              {sum.mph.endT && sum.mph.endT > now && (
                <div><span className="muted">효과 끝까지</span> {fmtDur((sum.mph.endT - now) / 60000)} ({fmtTime(sum.mph.endT)})</div>
              )}
              <div><span className="muted">지금</span> {Math.round(sum.mph.pct ?? 0)}%</div>
            </div>
          )}
        </div>
        <div className="card status">
          <div className="muted small">카페인</div>
          <div className="big" style={{ color: '#f5b544' }}>{Math.round(sum.caf.ngml)} <span className="unit">ng/mL</span></div>
          <div className="rows">
            <div>
              <span className="muted">수면</span>{' '}
              {sum.caf.aboveSleepLine ? (sum.caf.sleepOkT ? `${fmtTime(sum.caf.sleepOkT)} 이후 방해 적음` : '계산 중') : '기준선 아래'}
            </div>
            <div>
              <span className="muted">오늘</span> {view.cafToday}mg / 권고 {limit}mg
              <div className="meter"><div style={{ width: `${Math.min(100, (view.cafToday / limit) * 100)}%`, background: view.cafToday > limit ? '#ff6b6b' : '#f5b544' }} /></div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-title">빠른 기록</div>
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p.label} className={`chip ${drugById(p.drugId)?.kind === 'caffeine' ? 'caf' : 'mph'}`} disabled={!!busy} onClick={() => quick(p.drugId, p.mg, p.label)}>
              + {p.label}
            </button>
          ))}
          <button className="chip ghost" onClick={() => mark('start')}>효과 시작</button>
          <button className="chip ghost" onClick={() => mark('end')}>효과 끝</button>
        </div>
      </section>

      <section>
        <div className="row-between">
          <div className="section-title">예상 수준</div>
          <div className="seg">
            {(['now', '2d', '1w'] as Range[]).map((r) => (
              <button key={r} className={range === r ? 'on' : ''} onClick={() => { setRange(r); setScrubT(null); }}>
                {{ now: '현재', '2d': '2일', '1w': '1주' }[r]}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">곡선을 누르거나 끌면 그 시각 값을 볼 수 있어요. 점선은 앞으로의 예상이에요.</p>
        <Chart
          title="메틸페니데이트"
          subtitle={`효과 기준 ${Math.round(params.mphThresholdPct)}%`}
          color="#6ea8ff"
          from={view.from}
          to={view.to}
          points={view.mph.map((p) => ({ t: p.t, v: p.pct ?? 0 }))}
          yMax={100}
          yTicks={[0, 25, 50, 75, 100]}
          yFmt={(v) => `${Math.round(v)}%`}
          now={now}
          threshold={{ v: params.mphThresholdPct, label: '효과 기준' }}
          doses={data.doses.filter((d) => d.kind === 'mph-oros').map((d) => ({ t: d.t, label: `${d.mg}mg` }))}
          bedtimes={view.bedtimes}
          band={view.band}
          scrubT={scrubT}
          onScrub={setScrubT}
        />
        <Chart
          title="카페인"
          color="#f5b544"
          from={view.from}
          to={view.to}
          points={view.caf.map((p) => ({ t: p.t, v: p.raw }))}
          yMax={view.cafMax}
          yTicks={niceTicks(view.cafMax)}
          yFmt={(v) => `${Math.round(v)}`}
          now={now}
          threshold={{ v: params.cafSleepNgMl, label: `수면 기준선 ${Math.round(params.cafSleepNgMl)}` }}
          doses={data.doses.filter((d) => d.kind === 'caffeine').map((d) => ({ t: d.t, label: `${d.mg}mg` }))}
          bedtimes={view.bedtimes}
          scrubT={scrubT}
          onScrub={setScrubT}
        />
      </section>

      <p className="disclaimer">추정치일 뿐이며 실제 수준은 사람마다 달라요. 의료기기가 아니에요. 복용 시간·용량은 의사와 상의하세요.</p>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function niceTicks(max: number) {
  const step = max > 3000 ? 1000 : 500;
  const out = [];
  for (let v = 0; v < max; v += step) out.push(v);
  return out;
}
