'use client';
import { useEffect, useRef, useState } from 'react';
import { fmtTime, kstHour } from '@/lib/client';

export interface ChartProps {
  title: string;
  subtitle?: string;
  color: string;
  from: number;
  to: number;
  points: { t: number; v: number }[];
  yMax: number;
  yTicks: number[];
  yFmt: (v: number) => string;
  now: number;
  threshold?: { v: number; label: string };
  doses: { t: number; label: string }[];
  bedtimes: number[];
  band?: { from: number; to: number }[]; // 효과 구간
  scrubT: number | null;
  onScrub: (t: number | null) => void;
}

const PAD = { l: 44, r: 12, t: 30, b: 26 };
const HEIGHT = 210;
const H = 3600000;

export default function Chart(p: ChartProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver((e) => setW(Math.max(280, e[0].contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const iw = w - PAD.l - PAD.r;
  const ih = HEIGHT - PAD.t - PAD.b - (p.band ? 14 : 0);
  const x = (t: number) => PAD.l + ((t - p.from) / (p.to - p.from)) * iw;
  const y = (v: number) => PAD.t + ih - (Math.min(v, p.yMax * 1.05) / p.yMax) * ih;

  const past = p.points.filter((pt) => pt.t <= p.now);
  const future = p.points.filter((pt) => pt.t >= p.now);
  const line = (pts: typeof p.points) => pts.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.t).toFixed(1)},${y(pt.v).toFixed(1)}`).join('');
  const area = past.length
    ? `${line(past)}L${x(past[past.length - 1].t).toFixed(1)},${y(0)}L${x(past[0].t).toFixed(1)},${y(0)}Z`
    : '';

  // x축 눈금 간격
  // 눈금 사이가 최소 38px 되도록 간격을 고른다
  const span = (p.to - p.from) / H;
  const stepH = [1, 2, 3, 4, 6, 12, 24].find((s) => (iw / span) * s >= 38) ?? 24;
  const ticks: number[] = [];
  const startHour = Math.ceil((p.from + 9 * H) / (stepH * H)) * stepH * H - 9 * H;
  for (let t = startHour; t <= p.to; t += stepH * H) ticks.push(t);
  const tickLabel = (t: number) => {
    const h = kstHour(t);
    if (stepH === 24 || h === 0) {
      const d = new Date(t + 9 * H);
      return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    }
    if (h === 12) return '정오';
    return h < 12 ? `${h}` : `${h - 12}`;
  };

  const scrubPt = p.scrubT != null ? nearest(p.points, p.scrubT) : null;
  const nowPt = nearest(p.points, p.now);

  const handle = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    if (px < PAD.l || px > w - PAD.r) return;
    p.onScrub(p.from + ((px - PAD.l) / iw) * (p.to - p.from));
  };

  return (
    <div className="card chart" ref={wrap}>
      <div className="chart-title" style={{ color: p.color }}>
        {p.title}
        {p.subtitle && <span className="muted small"> · {p.subtitle}</span>}
      </div>
      <svg
        width={w}
        height={HEIGHT}
        onPointerDown={handle}
        onPointerMove={(e) => e.buttons && handle(e)}
        style={{ touchAction: 'pan-y' }}
      >
        <defs>
          <linearGradient id={`g-${p.title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={p.color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {p.yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.l - 6} y={y(v) + 4} className="axis" textAnchor="end">{p.yFmt(v)}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={PAD.t} y2={PAD.t + ih} className="grid faint" />
            <text x={x(t)} y={HEIGHT - 8} className="axis" textAnchor="middle">{tickLabel(t)}</text>
          </g>
        ))}
        {p.bedtimes.filter((t) => t > p.from && t < p.to).map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={PAD.t} y2={PAD.t + ih} className="bed" />
            {stepH < 24 && <text x={x(t) + 3} y={PAD.t - 6} className="axis small">취침</text>}
          </g>
        ))}
        {p.threshold && (
          <g>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(p.threshold.v)} y2={y(p.threshold.v)} className="thr" />
            <text x={w - PAD.r - 2} y={y(p.threshold.v) - 5} className="axis thr-label" textAnchor="end">{p.threshold.label}</text>
          </g>
        )}
        {area && <path d={area} fill={`url(#g-${p.title})`} />}
        <path d={line(past)} stroke={p.color} strokeWidth={2.2} fill="none" />
        <path d={line(future)} stroke={p.color} strokeWidth={1.6} fill="none" strokeDasharray="4 4" opacity={0.75} />
        {p.doses.filter((d) => d.t >= p.from && d.t <= p.to).map((d) => (
          <g key={d.t}>
            <line x1={x(d.t)} x2={x(d.t)} y1={y(0)} y2={y(0) - 14} stroke={p.color} strokeWidth={2} />
            <circle cx={x(d.t)} cy={y(0) - 16} r={3.5} fill={p.color} />
          </g>
        ))}
        {p.now >= p.from && p.now <= p.to && (
          <g>
            <line x1={x(p.now)} x2={x(p.now)} y1={PAD.t} y2={PAD.t + ih} className="now" />
            {nowPt && <circle cx={x(nowPt.t)} cy={y(nowPt.v)} r={5} fill={p.color} stroke="#0b0d12" strokeWidth={2} />}
          </g>
        )}
        {scrubPt && (
          <g>
            <line x1={x(scrubPt.t)} x2={x(scrubPt.t)} y1={PAD.t} y2={PAD.t + ih} className="scrub" />
            <circle cx={x(scrubPt.t)} cy={y(scrubPt.v)} r={4} fill="#fff" />
            <text x={clamp(x(scrubPt.t), PAD.l + 50, w - PAD.r - 50)} y={PAD.t - 8} className="scrub-label" textAnchor="middle">
              {fmtTime(scrubPt.t)} · {p.yFmt(scrubPt.v)}
            </text>
          </g>
        )}
        {p.band && (
          <g>
            <line x1={PAD.l} x2={w - PAD.r} y1={PAD.t + ih + 12} y2={PAD.t + ih + 12} stroke="#2a2f3a" strokeWidth={3} strokeLinecap="round" />
            {p.band.map((b, i) => (
              <line key={i} x1={x(Math.max(b.from, p.from))} x2={x(Math.min(b.to, p.to))} y1={PAD.t + ih + 12} y2={PAD.t + ih + 12}
                stroke={p.color} strokeWidth={4} strokeLinecap="round" />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

function nearest(pts: { t: number; v: number }[], t: number) {
  let best: { t: number; v: number } | null = null;
  for (const p of pts) if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
  return best;
}
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
