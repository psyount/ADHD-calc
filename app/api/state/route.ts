import { NextResponse } from 'next/server';
import { loadAll } from '@/lib/api';
import { storageMode } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await loadAll();
  return NextResponse.json({ ...data, storageMode, now: Date.now() });
}
