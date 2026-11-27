// 약 목록. 새 약은 여기에 추가하면 된다.
// kind: 'mph-oros' = 콘서타(OROS), 'caffeine' = 카페인
export type DrugKind = 'mph-oros' | 'caffeine';

export interface Drug {
  id: string;
  name: string;
  kind: DrugKind;
  doses: number[]; // 자주 쓰는 용량(mg)
  defaultMg: number;
}

export interface Preset {
  label: string;
  drugId: string;
  mg: number;
}

export const DRUGS: Drug[] = [
  { id: 'concerta', name: '콘서타', kind: 'mph-oros', doses: [18, 27, 36, 54], defaultMg: 18 },
  { id: 'caffeine', name: '카페인', kind: 'caffeine', doses: [50, 100, 150, 200], defaultMg: 100 },
];

export const PRESETS: Preset[] = [
  { label: '콘서타 18mg', drugId: 'concerta', mg: 18 },
  { label: '몬스터 100mg', drugId: 'caffeine', mg: 100 },
  { label: '아메리카노 150mg', drugId: 'caffeine', mg: 150 },
];

export function drugById(id: string): Drug | undefined {
  return DRUGS.find((d) => d.id === id);
}
