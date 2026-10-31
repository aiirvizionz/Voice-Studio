import { NextRequest, NextResponse } from 'next/server';

/** Protect the entire studio in production, including paid API routes. */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();
  const username = process.env.STUDIO_USERNAME;
  const password = process.env.STUDIO_PASSWORD;
  if (!username || !password) {
    return new NextResponse('Studio access is not configured.', { status: 503 });
  }
  const header = request.headers.get('authorization');
  let candidate = '';
  if (header?.startsWith('Basic ')) {
    try { candidate = atob(header.slice(6)); } catch { /* malformed header */ }
  }
  if (candidate !== `${username}:${password}`) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Voice Studio"', 'Cache-Control': 'no-store' },
    });
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
