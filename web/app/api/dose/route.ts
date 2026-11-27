import { NextResponse } from 'next/server';
import { body, bad, parseTime } from '@/lib/api';
import { put, get, remove, newId, type Dose } from '@/lib/store';
import { drugById } from '@/lib/drugs';

// 단축어에서도 쓰기 쉽게: { drug: "concerta" | "caffeine", mg, time?, withFood? }
export async function POST(req: Request) {
  const b = await body(req);
  const drug = drugById(String(b.drugId ?? b.drug ?? ''));
  if (!drug) return bad('drug는 concerta 또는 caffeine');
  const mg = Number(b.mg ?? drug.defaultMg);
  if (!(mg > 0 && mg < 2000)) return bad('mg 값이 이상해요');
  const t = parseTime(b.time);
  if (t == null) return bad('time 형식을 못 읽었어요');
  const dose: Dose = { id: newId(), drugId: drug.id, kind: drug.kind, mg, t, withFood: !!b.withFood };
  await put('doses', dose);
  return NextResponse.json({ ok: true, dose, message: `${drug.name} ${mg}mg 기록했어요` });
}

export async function PATCH(req: Request) {
  const b = await body(req);
  const cur = await get<Dose>('doses', String(b.id ?? ''));
  if (!cur) return bad('기록을 못 찾았어요', 404);
  const t = b.time !== undefined ? parseTime(b.time) : cur.t;
  if (t == null) return bad('time 형식을 못 읽었어요');
  const next: Dose = {
    ...cur,
    t,
    mg: b.mg !== undefined ? Number(b.mg) : cur.mg,
    withFood: b.withFood !== undefined ? !!b.withFood : cur.withFood,
  };
  await put('doses', next);
  return NextResponse.json({ ok: true, dose: next });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return bad('id 필요');
  await remove('doses', id);
  return NextResponse.json({ ok: true });
}
