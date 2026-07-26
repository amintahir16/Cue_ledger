import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (sessionCookie && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tables/:path*",
    "/expenses/:path*",
    "/sessions/:path*",
    "/customers/:path*",
    "/products/:path*",
    "/settings/:path*",
    "/closing/:path*",
    "/login",
  ],
};
