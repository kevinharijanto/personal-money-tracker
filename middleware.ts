import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Add CORS headers to API responses
 */
function addCorsHeaders(response: NextResponse, origin?: string | null): NextResponse {
  // Allow requests from any origin during development
  // In production, you should specify allowed origins
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS?.split(',') || [])
    : ['*'];

  if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
  } else if (allowedOrigins.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Household-ID');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return response;
}

/**
 * Handle CORS preflight requests
 */
function handleCors(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    return addCorsHeaders(response, origin);
  }
  
  return null;
}

/**
 * Global auth gate:
 * - Unauthenticated users are redirected to /signin (with callbackUrl back to original)
 * - Authenticated users visiting /signin or /signup are redirected to Home (/)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signinPath = "/signin";
  const signupPath = "/signup";
  const origin = req.headers.get('origin');
  const isApiRoute = pathname.startsWith('/api/');

  // Handle CORS preflight requests for API routes
  if (isApiRoute && req.method === 'OPTIONS') {
    const corsResponse = handleCors(req);
    if (corsResponse) {
      return corsResponse;
    }
  }

  // Uses JWT strategy; NEXTAUTH_SECRET comes from env
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const isAuth = !!token;
  

  // Require auth for all non-public pages (except API routes which handle their own auth)
  if (!isAuth && !isApiRoute && pathname !== signinPath && pathname !== signupPath) {
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

  // Add CORS headers to API responses
  if (isApiRoute) {
    const response = NextResponse.next();
    return addCorsHeaders(response, origin);
  }

  return NextResponse.next();
}

/**
 * Apply middleware to all routes except:
 * - Next.js static/image assets
 * - favicon.ico
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};