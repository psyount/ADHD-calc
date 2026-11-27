import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, sessionValue, authConfigured } from './lib/auth';

const PUBLIC = ['/login', '/api/login', '/manifest.webmanifest', '/icon.svg', '/apple-icon.png'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  if (!authConfigured()) {
    // 로컬 개발에서는 통과, 배포 환경에서는 설정이 빠졌다고 막는다
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return new NextResponse('APP_PIN, API_TOKEN 환경변수를 설정하세요.', { status: 500 });
  }

  const isApi = pathname.startsWith('/api/');
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (isApi && bearer && bearer === process.env.API_TOKEN) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie && cookie === (await sessionValue())) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
