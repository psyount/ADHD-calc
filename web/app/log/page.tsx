'use client';
import { useEffect, useState } from 'react';
import { DRUGS, drugById } from '@/lib/drugs';
import { api, useAppState, toLocalInput, fromLocalInput } from '@/lib/client';
import { kstDate } from '@/lib/calibrate';

const FACES = ['아주 나쁨', '나쁨', '보통', '좋음', '아주 좋음'];

export default function LogPage() {
  const { data, reload } = useAppState();
  const [drugId, setDrugId] = useState(DRUGS[0].id);
  const [mg, setMg] = useState(DRUGS[0].defaultMg);
  const [time, setTime] = useState(() => toLocalInput(Date.now()));
  const [withFood, setWithFood] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const [sleep, setSleep] = useState('');
  const today = kstDate(Date.now());
  const day = data?.days.find((d) => d.date === today);

  useEffect(() => {
    if (day?.memo !== undefined) setMemo(day.memo);
  }, [day?.memo]);

  const drug = drugById(drugId)!;
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  };

  async function save() {
    try {
      await api('/api/dose', 'POST', { drugId, mg, time: fromLocalInput(time), withFood });
      flash(`${drug.name} ${mg}mg 기록했어요`);
      setTime(toLocalInput(Date.now()));
      reload();
    } catch (e) {
      flash(String(e));
    }
  }

  return (
    <div className="page">
      <h1>기록</h1>

      <div className="card form">
        <div className="section-title">복용</div>
        <label>약
          <select value={drugId} onChange={(e) => { const d = drugById(e.target.value)!; setDrugId(d.id); setMg(d.defaultMg); }}>
            {DRUGS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label>용량 (mg)
          <div className="chips">
            {drug.doses.map((v) => (
              <button key={v} className={`chip ${mg === v ? 'on' : ''}`} onClick={() => setMg(v)}>{v}</button>
            ))}
            <input type="number" inputMode="decimal" value={mg} onChange={(e) => setMg(Number(e.target.value))} className="num" />
          </div>
        </label>
        <label>시각
          <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={withFood} onChange={(e) => setWithFood(e.target.checked)} /> 음식과 함께
          {drug.kind === 'mph-oros' && <span className="muted small"> (콘서타는 음식 영향 없음으로 계산)</span>}
        </label>
        <button className="primary" onClick={save}>기록하기</button>
      </div>

      <div className="card form">
        <div className="section-title">오늘 컨디션</div>
        <div className="faces">
          {FACES.map((f, i) => (
            <button key={f} className={`face ${day?.condition === i + 1 ? 'on' : ''}`}
              onClick={async () => { await api('/api/day', 'POST', { date: today, condition: i + 1 }); reload(); }}>
              <span className="face-n">{i + 1}</span>
              <span className="small">{f}</span>
            </button>
          ))}
        </div>
        <textarea placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} />
        <button onClick={async () => { await api('/api/day', 'POST', { date: today, memo }); flash('메모 저장했어요'); reload(); }}>메모 저장</button>
      </div>

      <div className="card form">
        <div className="section-title">어젯밤 잠든 시각</div>
        <p className="muted small">카페인 수면 기준선 보정에 써요. 단축어로 자동 입력할 수도 있어요.</p>
        <input type="datetime-local" value={sleep} onChange={(e) => setSleep(e.target.value)} />
        <button disabled={!sleep} onClick={async () => { await api('/api/sleep', 'POST', { sleepStart: fromLocalInput(sleep) }); flash('잠든 시각 저장했어요'); setSleep(''); reload(); }}>저장</button>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
