import { NextResponse } from 'next/server';
import { body, bad } from '@/lib/api';
import { getSettings, saveSettings, type Settings } from '@/lib/store';

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function POST(req: Request) {
  const b = await body(req);
  const patch: Partial<Settings> = {};
  if (b.weightKg !== undefined) {
    const w = Number(b.weightKg);
    if (!(w >= 25 && w <= 200)) return bad('체중은 25~200kg');
    patch.weightKg = w;
  }
  if (b.releaseH !== undefined) {
    const r = Number(b.releaseH);
    if (!(r >= 3 && r <= 12)) return bad('방출 시간은 3~12시간');
    patch.releaseH = r;
  }
  if (b.bedtime !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(String(b.bedtime))) return bad('취침 시각 형식은 HH:MM');
    patch.bedtime = String(b.bedtime);
  }
  if (b.useCalibration !== undefined) patch.useCalibration = !!b.useCalibration;
  return NextResponse.json(await saveSettings(patch));
}
