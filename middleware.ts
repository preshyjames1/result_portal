import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import type { MasterSessionPayload } from '@/types';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

async function verifyJwt<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as T;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookies = request.cookies;

  // ── /result → requires result_session OR master_session (scope=student) ──
  if (pathname.startsWith('/result')) {
    const resultToken = cookies.get('result_session')?.value;
    const masterToken = cookies.get('master_session')?.value;

    const resultSession = await verifyJwt(resultToken);
    if (resultSession) return NextResponse.next();

    const masterSession = await verifyJwt<MasterSessionPayload>(masterToken);
    if (masterSession && masterSession.scope === 'student') return NextResponse.next();

    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── /master/browse → requires master_session (scope=all) ─────────────────
  if (pathname.startsWith('/master/browse')) {
    const masterToken = cookies.get('master_session')?.value;
    const masterSession = await verifyJwt<MasterSessionPayload>(masterToken);

    if (masterSession && masterSession.scope === 'all') return NextResponse.next();

    return NextResponse.redirect(new URL('/master', request.url));
  }

  // ── /admin/* (except /admin itself) → requires admin_session ─────────────
  if (
    pathname.startsWith('/admin/dashboard') ||
    pathname.startsWith('/admin/students') ||
    pathname.startsWith('/admin/results') ||
    pathname.startsWith('/admin/pins') ||
    pathname.startsWith('/admin/master-pins') ||
    pathname.startsWith('/admin/transactions') ||
    pathname.startsWith('/admin/publish')
  ) {
    const adminToken = cookies.get('admin_session')?.value;
    const adminSession = await verifyJwt(adminToken);

    if (adminSession) return NextResponse.next();

    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/result/:path*',
    '/master/browse/:path*',
    '/admin/dashboard/:path*',
    '/admin/students/:path*',
    '/admin/results/:path*',
    '/admin/pins/:path*',
    '/admin/master-pins/:path*',
    '/admin/transactions/:path*',
    '/admin/publish/:path*',
  ],
};
