import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Add CORS headers to API responses
 */
export function addCorsHeaders(response: NextResponse, origin?: string | null): NextResponse {
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
export function handleCors(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    return addCorsHeaders(response, origin);
  }
  
  return null;
}

/**
 * Wrapper function for API handlers that adds CORS headers
 */
export function withCors<T extends any[]>(
  handler: (req: Request, ...args: T) => Promise<NextResponse>
) {
  return async (req: Request, ...args: T): Promise<NextResponse> => {
    const origin = (req as any).headers?.get('origin');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      return addCorsHeaders(response, origin);
    }
    
    // Execute the handler and add CORS headers to the response
    const response = await handler(req, ...args);
    return addCorsHeaders(response, origin);
  };
}