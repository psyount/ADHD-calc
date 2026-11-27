'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { median } from '@/lib/calibrate';

const DURATION = 60000; // 1분
type Phase = 'idle' | 'wait' | 'go' | 'done';

export default function PvtPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [rt, setRt] = useState<number | null>(null);
  const [left, setLeft] = useState(DURATION);
  const [result, setResult] = useState<{ medianMs: number; lapses: number; n: number; falseStarts: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const rts = useRef<number[]>([]);
  const falseStarts = useRef(0);
  const startAt = useRef(0);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (tick.current) clearInterval(tick.current); }, []);

  function schedule() {
    if (performance.now() - startAt.current >= DURATION) return finish();
    setP('wait');
    const delay = 2000 + Math.random() * 8000;
    timer.current = setTimeout(() => {
      goAt.current = performance.now();
      setP('go');
      // 3초 안에 안 누르면 지연으로 기록하고 넘어감
      timer.current = setTimeout(() => {
        if (phaseRef.current === 'go') { rts.current.push(3000); setRt(3000); schedule(); }
      }, 3000);
    }, delay);
  }

  function start() {
    rts.current = [];
    falseStarts.current = 0;
    setRt(null);
    setResult(null);
    setSaved(false);
    startAt.current = performance.now();
    setLeft(DURATION);
    tick.current = setInterval(() => setLeft(Math.max(0, DURATION - (performance.now() - startAt.current))), 250);
    schedule();
  }

  function finish() {
    if (timer.current) clearTimeout(timer.current);
    if (tick.current) clearInterval(tick.current);
    const list = rts.current;
    setP('done');
    if (list.length) {
      setResult({ medianMs: median(list)!, lapses: list.filter((v) => v > 500).length, n: list.length, falseStarts: falseStarts.current });
    }
  }

  function tap() {
    const p = phaseRef.current;
    if (p === 'go') {
      const v = performance.now() - goAt.current;
      if (timer.current) clearTimeout(timer.current);
      rts.current.push(v);
      setRt(v);
      schedule();
    } else if (p === 'wait') {
      falseStarts.current++;
      if (timer.current) clearTimeout(timer.current);
      setRt(-1);
      schedule();
    }
  }

  return (
    <div className="page">
      <h1>반응속도 테스트</h1>
      <p className="muted small">1분 동안 화면이 빨갛게 바뀌면 최대한 빨리 누르세요. 느낌과 상관없이 정해진 시각에 하는 게 중요해요.</p>

      {phase === 'idle' || phase === 'done' ? (
        <div className="card">
          {result && (
            <div className="pvt-result">
              <div className="big">{Math.round(result.medianMs)} ms</div>
              <div className="muted">반응시간 중앙값 · {result.n}회 · 지연(500ms 초과) {result.lapses}회 · 먼저 누름 {result.falseStarts}회</div>
              {!saved ? (
                <button className="primary" onClick={async () => { await api('/api/pvt', 'POST', result); setSaved(true); }}>저장</button>
              ) : (
                <p className="ok">저장했어요</p>
              )}
            </div>
          )}
          {phase === 'done' && !result && <p className="muted">반응이 없었어요. 다시 해 주세요.</p>}
          <button className={result ? '' : 'primary'} onClick={start}>{result ? '다시 하기' : '시작'}</button>
        </div>
      ) : (
        <div className={`pvt-pad ${phase}`} onPointerDown={tap}>
          <div className="pvt-left">{Math.ceil(left / 1000)}초</div>
          <div className="pvt-msg">
            {phase === 'go' ? '지금!' : rt === -1 ? '너무 빨라요' : rt != null ? `${Math.round(rt)} ms` : '기다리세요'}
          </div>
        </div>
      )}
    </div>
  );
}
