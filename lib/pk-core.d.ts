export type Kind = 'mph-oros' | 'caffeine';

export interface PkDose {
  t: number;
  mg: number;
  kind: Kind;
  withFood?: boolean;
}

export interface Params {
  weightKg: number;
  releaseH: number;
  mphThresholdPct: number;
  cafSleepNgMl: number;
}

export interface Point {
  t: number;
  raw: number;
  pct?: number;
}

export interface MphSummary {
  phase: 'none' | 'rising' | 'peak' | 'falling' | 'ended';
  label: string;
  pct?: number;
  doseT?: number;
  elapsedMin?: number;
  peakT?: number;
  startT?: number | null;
  endT?: number | null;
}

export interface CafSummary {
  ngml: number;
  aboveSleepLine: boolean;
  sleepOkT: number | null;
}

export const PK: any;
export const DEFAULT_PARAMS: Params;
export function bateman(t: number, ka: number, ke: number): number;
export function batemanIntegral(t: number, ka: number, ke: number): number;
export function mphConc(tH: number, mg: number, weightKg: number, releaseH: number): number;
export function cafConc(tH: number, mg: number, weightKg: number, withFood: boolean): number;
export function levelAt(ms: number, doses: PkDose[], kind: Kind, params: Params): number;
export function series(doses: PkDose[], kind: Kind, fromMs: number, toMs: number, stepMin: number, params: Params): Point[];
export function singleDosePeak(mg: number, params: Params): number;
export function summarize(doses: PkDose[], nowMs: number, params: Params): { mph: MphSummary; caf: CafSummary };
