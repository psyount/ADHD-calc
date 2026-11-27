'use client';
import { useEffect, useState } from 'react';
import { useAppState, api } from '@/lib/client';

export default function SettingsPage() {
  const { data, reload } = useAppState();
  const [weight, setWeight] = useState('');
  const [bedtime, setBedtime] = useState('');
  const [releaseH, setReleaseH] = useState(7);
  const [msg, setMsg] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(location.origin);
    if (data) {
      setWeight(String(data.settings.weightKg));
      setBedtime(data.settings.bedtime);
      setReleaseH(data.settings.releaseH);
    }
  }, [data]);

  if (!data) return <div className="page muted">불러오는 중…</div>;
  const c = data.calibration;

  async function save(patch: Record<string, unknown>) {
    try {
      await api('/api/settings', 'POST', patch);
      setMsg('저장했어요');
      reload();
    } catch (e) {
      setMsg(String(e));
    }
    setTimeout(() => setMsg(null), 2000);
  }

  return (
    <div className="page">
      <h1>설정</h1>

      <div className="card form">
        <label>체중 (kg)
          <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} onBlur={() => save({ weightKg: Number(weight) })} />
        </label>
        <p className="muted small">카페인 농도 계산과 하루 권고량(체중×2.5mg = {Math.round(Number(weight || 0) * 2.5)}mg)에 써요.</p>
        <label>취침 시각
          <input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} onBlur={() => save({ bedtime })} />
        </label>
        <label>콘서타 방출 시간: {releaseH}시간
          <input type="range" min={4} max={11} step={0.5} value={releaseH} onChange={(e) => setReleaseH(Number(e.target.value))} onPointerUp={() => save({ releaseH })} onKeyUp={() => save({ releaseH })} />
        </label>
        <p className="muted small">길수록 피크가 늦고 완만해져요. 기본 7시간이면 복용 후 약 7시간에 피크.</p>
      </div>

      <div className="card">
        <div className="row-between">
          <div className="section-title">개인 보정</div>
          <label className="switch">
            <input type="checkbox" checked={data.settings.useCalibration} onChange={(e) => save({ useCalibration: e.target.checked })} />
            <span>{data.settings.useCalibration ? '사용 중' : '기본값 사용'}</span>
          </label>
        </div>
        <p className="muted small">
          기록이 쌓일수록 기본값에서 내 값으로 옮겨 가요. 계산: (기본값×5 + 내 값×일수) ÷ (5 + 일수). 끄면 바로 기본값으로 돌아가요.
        </p>
        <table className="cal">
          <thead><tr><th></th><th>기본</th><th>내 값</th><th>적용</th><th>일수</th></tr></thead>
          <tbody>
            <tr>
              <td>효과 기준선</td>
              <td>{c.mph.def}%</td>
              <td>{c.mph.personal != null ? `${Math.round(c.mph.personal)}%` : '–'}</td>
              <td><strong>{Math.round(c.params.mphThresholdPct)}%</strong></td>
              <td>{c.mph.days.length}</td>
            </tr>
            <tr>
              <td>카페인 수면선</td>
              <td>{c.caf.def}</td>
              <td>{c.caf.personal != null ? Math.round(c.caf.personal) : '–'}</td>
              <td><strong>{Math.round(c.params.cafSleepNgMl)}</strong></td>
              <td>{c.caf.days.length}</td>
            </tr>
          </tbody>
        </table>
        <p className="muted small">
          PVT 평소 기준: {c.mph.pvtBaselineMs ? `${Math.round(c.mph.pvtBaselineMs)}ms` : '기록 부족'} · 이보다 5% 이상 빠르면 효과 있는 구간으로 봐요.
          하루에 PVT 3번 이상 한 날만 써요.
        </p>
        {[...c.mph.days].reverse().slice(0, 7).map((d) => (
          <div key={'m' + d.date} className="hist-row small"><span className="muted time">{d.date.slice(5)}</span><span>기준선 {Math.round(d.value)}%</span><span className="muted">{d.from}</span></div>
        ))}
        {[...c.caf.days].reverse().slice(0, 7).map((d) => (
          <div key={'c' + d.date} className="hist-row small"><span className="muted time">{d.date.slice(5)}</span><span>잠든 때 카페인 {Math.round(d.value)} ng/mL</span></div>
        ))}
      </div>

      <div className="card">
        <div className="section-title">위젯·단축어 연결</div>
        <p className="small">주소: <code>{origin}</code></p>
        <p className="muted small">토큰은 Vercel 환경변수 API_TOKEN 값이에요. 설정법은 레포의 docs/scriptable.md, docs/shortcuts.md를 보세요.</p>
        <p className="muted small">저장소: {data.storageMode === 'redis' ? 'Upstash Redis 연결됨' : '메모리 (배포 전 Redis 연결 필요)'}</p>
      </div>

      <button className="danger wide" onClick={async () => { await api('/api/logout', 'POST'); location.href = '/login'; }}>로그아웃</button>
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
