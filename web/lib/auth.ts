// PIN 로그인 쿠키와 API 토큰 확인 (Edge·Node 둘 다에서 동작)
export const COOKIE = 'fc_session';

export async function sessionValue(): Promise<string | null> {
  const pin = process.env.APP_PIN;
  const token = process.env.API_TOKEN;
  if (!pin || !token) return null;
  const data = new TextEncoder().encode(`${pin}:${token}:focus-curve`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function authConfigured(): boolean {
  return !!(process.env.APP_PIN && process.env.API_TOKEN);
}
