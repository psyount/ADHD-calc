'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Dose, EffectMark, PvtResult, SleepRecord, DayRecord, Settings } from './store';
import type { Calibration } from './calibrate';

export interface AppState {
  doses: Dose[];
  effects: EffectMark[];
  pvts: PvtResult[];
  sleeps: SleepRecord[];
  days: DayRecord[];
  settings: Settings;
  calibration: Calibration;
  storageMode: string;
  now: number;
}

export function useAppState() {
  const [data, setData] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (r.status === 401) {
        location.href = '/login';
        return;
      }
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    reload();
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);
  return { data, error, reload };
}

export async function api(path: string, method: string, payload?: unknown) {
  const r = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? '요청 실패');
  return j;
}

// 한국 시간 표시
const TZ = 'Asia/Seoul';
export function fmtTime(t: number) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(t);
}
export function fmtDateTime(t: number) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: TZ, month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit',
  }).format(t);
}
export function fmtDate(t: number) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, month: 'long', day: 'numeric', weekday: 'short' }).format(t);
}
export function fmtDur(min: number) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  return h ? `${h}시간 ${m % 60}분` : `${m}분`;
}
// datetime-local 입력값 <-> ms (한국 시간 기준)
export function toLocalInput(t: number) {
  return new Date(t + 9 * 3600000).toISOString().slice(0, 16);
}
export function fromLocalInput(v: string) {
  const [d, hm] = v.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  return Date.UTC(y, mo - 1, da, h - 9, mi);
}
export function kstHour(t: number) {
  return new Date(t + 9 * 3600000).getUTCHours();
}
