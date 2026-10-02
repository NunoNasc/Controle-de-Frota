import { NextRequest, NextResponse } from 'next/server';
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith('/checklist/') || path.startsWith('/api/checklist/')){const response=NextResponse.next();response.headers.set('Referrer-Policy','no-referrer');response.headers.set('Cache-Control','private, no-store, max-age=0');response.headers.set('X-Robots-Tag','noindex, nofollow');return response;}
  if(path==='/favicon.svg')return NextResponse.next();
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_ADMIN !== 'true') return new NextResponse('Acesso administrativo indisponível. Configure autenticação antes da implantação em produção.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
