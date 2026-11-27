import { NextResponse } from 'next/server';
import { loadAll } from '@/lib/api';
import { toPk, kstDate } from '@/lib/calibrate';

export const dynamic = 'force-dynamic';

// Scriptable 위젯용: 최근 48시간 복용 기록과 매개변수만 가볍게
export async function GET() {
  const { doses, settings, calibration } = await loadAll();
  const now = Date.now();
  const recent = doses.filter((d) => now - d.t < 48 * 3600000 && d.t <= now + 3600000);
  const today = kstDate(now);
  const cafTodayMg = doses.filter((d) => d.kind === 'caffeine' && kstDate(d.t) === today).reduce((s, d) => s + d.mg, 0);
  return NextResponse.json({
    now,
    params: calibration.params,
    doses: toPk(recent),
    names: Object.fromEntries(recent.map((d) => [d.t, d.drugId])),
    cafTodayMg,
    cafLimitMg: Math.round(settings.weightKg * 2.5),
    bedtime: settings.bedtime,
  });
}
