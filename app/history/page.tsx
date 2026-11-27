'use client';
import { useState } from 'react';
import { useAppState, api, fmtTime, fmtDate, toLocalInput, fromLocalInput } from '@/lib/client';
import { kstDate } from '@/lib/calibrate';
import { drugById } from '@/lib/drugs';

type Item =
  | { kind: 'dose'; id: string; t: number; text: string; mg: number }
  | { kind: 'effect' | 'pvt' | 'sleep'; id: string; t: number; text: string };

export default function HistoryPage() {
  const { data, reload } = useAppState();
  const [editing, setEditing] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editMg, setEditMg] = useState(0);
  if (!data) return <div className="page muted">불러오는 중…</div>;

  const items: Item[] = [
    ...data.doses.map((d) => ({ kind: 'dose' as const, id: d.id, t: d.t, mg: d.mg, text: `${drugById(d.drugId)?.name ?? d.drugId} ${d.mg}mg${d.withFood ? ' · 음식과 함께' : ''}` })),
    ...data.effects.map((e) => ({ kind: 'effect' as const, id: e.id, t: e.t, text: e.type === 'start' ? '효과 시작' : '효과 끝' })),
    ...data.pvts.map((p) => ({ kind: 'pvt' as const, id: p.id, t: p.t, text: `PVT ${Math.round(p.medianMs)}ms · 지연 ${p.lapses}회` })),
    ...data.sleeps.map((s) => ({ kind: 'sleep' as const, id: s.id, t: s.t, text: '잠듦' })),
  ].sort((a, b) => b.t - a.t);

  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const k = kstDate(it.t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  const path = { dose: '/api/dose', effect: '/api/effect', pvt: '/api/pvt', sleep: '/api/sleep' };

  return (
    <div className="page">
      <h1>내역</h1>
      {!items.length && <p className="muted">아직 기록이 없어요.</p>}
      {[...groups.entries()].map(([date, list]) => {
        const day = data.days.find((d) => d.date === date);
        return (
          <div key={date} className="card">
            <div className="row-between">
              <strong>{fmtDate(list[0].t)}</strong>
              {day?.condition && <span className="pill">컨디션 {day.condition}</span>}
            </div>
            {day?.memo && <p className="muted small">{day.memo}</p>}
            {list.map((it) => (
              <div key={it.id} className="hist-row">
                {editing === it.id && it.kind === 'dose' ? (
                  <div className="edit">
                    <input type="datetime-local" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                    <input type="number" className="num" value={editMg} onChange={(e) => setEditMg(Number(e.target.value))} />
                    <button className="primary sm" onClick={async () => { await api('/api/dose', 'PATCH', { id: it.id, time: fromLocalInput(editTime), mg: editMg }); setEditing(null); reload(); }}>저장</button>
                    <button className="sm" onClick={() => setEditing(null)}>취소</button>
                  </div>
                ) : (
                  <>
                    <span className="muted time">{fmtTime(it.t)}</span>
                    <span className={`tag ${it.kind}`}>{it.text}</span>
                    <span className="actions">
                      {it.kind === 'dose' && (
                        <button className="sm" onClick={() => { setEditing(it.id); setEditTime(toLocalInput(it.t)); setEditMg(it.mg); }}>수정</button>
                      )}
                      <button className="sm danger" onClick={async () => { if (confirm('삭제할까요?')) { await api(`${path[it.kind]}?id=${it.id}`, 'DELETE'); reload(); } }}>삭제</button>
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
