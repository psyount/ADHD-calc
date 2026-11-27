'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin }) });
    if (r.ok) location.href = '/';
    else setErr((await r.json().catch(() => ({}))).error ?? '로그인 실패');
  }
  return (
    <div className="page login">
      <form className="card form" onSubmit={go}>
        <h1>FocusCurve</h1>
        <input type="password" inputMode="numeric" autoFocus placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
        <button className="primary" type="submit">들어가기</button>
        {err && <p className="err">{err}</p>}
      </form>
    </div>
  );
}
