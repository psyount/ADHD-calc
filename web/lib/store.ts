import { Redis } from '@upstash/redis';
import type { DrugKind } from './drugs';

export interface Dose {
  id: string;
  drugId: string;
  kind: DrugKind;
  mg: number;
  t: number; // 복용 시각(ms)
  withFood?: boolean;
}
export interface EffectMark {
  id: string;
  t: number;
  type: 'start' | 'end';
}
export interface PvtResult {
  id: string;
  t: number;
  medianMs: number;
  lapses: number; // 500ms 넘은 반응 수
  n: number;
}
export interface SleepRecord {
  id: string;
  t: number; // 잠든 시각
}
export interface DayRecord {
  date: string; // YYYY-MM-DD (한국 시간)
  condition?: number; // 1~5
  memo?: string;
}
export interface Settings {
  weightKg: number;
  bedtime: string; // HH:MM
  releaseH: number;
  useCalibration: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  weightKg: 85,
  bedtime: '00:30',
  releaseH: 7,
  useCalibration: true,
};

type Coll = 'doses' | 'effects' | 'pvts' | 'sleeps' | 'days';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// 환경변수가 없으면(로컬 개발) 메모리에 저장
const g = globalThis as unknown as { __mem?: Record<string, Record<string, unknown>> };
const mem = (g.__mem ??= {});

const PREFIX = 'fc:';

export async function all<T>(c: Coll): Promise<T[]> {
  if (!redis) return Object.values(mem[c] ?? {}) as T[];
  const h = await redis.hgetall<Record<string, T>>(PREFIX + c);
  return h ? Object.values(h) : [];
}

export async function put<T extends { id?: string; date?: string }>(c: Coll, item: T): Promise<T> {
  const key = (item.id ?? item.date) as string;
  if (!redis) {
    (mem[c] ??= {})[key] = item;
    return item;
  }
  await redis.hset(PREFIX + c, { [key]: item });
  return item;
}

export async function get<T>(c: Coll, key: string): Promise<T | null> {
  if (!redis) return ((mem[c] ?? {})[key] as T) ?? null;
  return (await redis.hget<T>(PREFIX + c, key)) ?? null;
}

export async function remove(c: Coll, key: string): Promise<void> {
  if (!redis) {
    delete (mem[c] ?? {})[key];
    return;
  }
  await redis.hdel(PREFIX + c, key);
}

export async function getSettings(): Promise<Settings> {
  const s = redis ? await redis.get<Settings>(PREFIX + 'settings') : (mem.settings as unknown as Settings);
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(s: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...s };
  if (redis) await redis.set(PREFIX + 'settings', next);
  else mem.settings = next as unknown as Record<string, unknown>;
  return next;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const storageMode = redis ? 'redis' : 'memory';
