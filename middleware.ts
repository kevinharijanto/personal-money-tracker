import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Global auth gate:
 * - Unauthenticated users are redirected to /signin (with callbackUrl back to original)
 * - Authenticated users visiting /signin or /signup are redirected to Home (/)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signinPath = "/signin";
  const signupPath = "/signup";

  // Uses JWT strategy; NEXTAUTH_SECRET comes from env
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const isAuth = !!token;
  

  // Require auth for all non-public pages
  if (!isAuth && pathname !== signinPath && pathname !== signupPath) {
    const url = req.nextUrl.clone();
    url.pathname = signinPath;
    // Use a relative callbackUrl to preserve the current origin/host/port
    const relativeCallback = req.nextUrl.pathname + req.nextUrl.search;
    url.searchParams.set("callbackUrl", relativeCallback);
    return NextResponse.redirect(url);
  }

  // Prevent signed-in users from accessing auth pages
  if (isAuth && (pathname === signinPath || pathname === signupPath)) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    
    // Preserve original port from request (no manual override)
    
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Apply middleware to all routes except:
 * - /api/*
 * - Next.js static/image assets
 * - favicon.ico
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};