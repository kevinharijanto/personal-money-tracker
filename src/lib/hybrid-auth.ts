import { NextResponse } from "next/server";
import { requireSession } from "@/lib/tenancy";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { getToken } from "next-auth/jwt";
import { addCorsHeaders, handleCors } from "@/lib/cors";

/**
 * Hybrid authentication function that supports both web (cookies) and mobile (JWT) authentication
 * Returns userId if authentication succeeds, or throws an error if it fails
 */
export async function authenticateRequest(req: Request): Promise<{ userId: string }> {
  // First try web authentication (cookies)
  try {
    const { userId } = await requireSession();
    return { userId };
  } catch (webAuthError) {
    // If web auth fails, try mobile authentication (JWT)
    const mobileUser = await verifyMobileToken(req as any);
    if (mobileUser) {
      return { userId: mobileUser.id };
    }
    // If both fail, throw the web auth error
    throw webAuthError;
  }
}

/**
 * Hybrid authentication function that supports both web (cookies) and mobile (JWT) authentication
 * Returns userId if authentication succeeds, or throws an error if it fails
 * Alternative implementation using getToken for compatibility with existing authenticate() function
 */
export async function authenticateRequestAlt(req: Request): Promise<string> {
  // First try web authentication (cookies)
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    if (token?.uid && typeof token.uid === 'string') {
      return token.uid;
    }
  } catch (webAuthError) {
    // Continue to mobile auth
  }
  
  // If web auth fails, try mobile authentication (JWT)
  const mobileUser = await verifyMobileToken(req as any);
  if (mobileUser) {
    return mobileUser.id;
  }
  
  // If both fail, throw an error
  throw new Error('Unauthorized');
}

/**
 * Hybrid authentication with tenancy (requires X-Household-ID header)
 * Returns { userId, householdId } if authentication succeeds, or throws an error if it fails
 */
export async function authenticateWithTenancy(req: Request): Promise<{ userId: string; householdId: string }> {
  // First authenticate the user
  const { userId } = await authenticateRequest(req);
  
  // Extract household ID from headers
  const householdId = req.headers.get("x-household-id");
  if (!householdId) {
    throw NextResponse.json({ error: "X-Household-ID header is required" }, { status: 400 });
  }
  
  return { userId, householdId };
}

/**
 * Helper function to check if authentication failed and return an error response
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof NextResponse) {
    return error;
  }
  
  console.error(error);
  
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * Wrapper function for API handlers that need authentication only
 */
export function withAuth<T extends any[]>(
  handler: (req: Request, userId: string, ...args: T) => Promise<NextResponse>
) {
  return async (req: Request, ...args: T): Promise<NextResponse> => {
    const origin = (req as any).headers?.get('origin');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      return addCorsHeaders(response, origin);
    }
    
    try {
      const { userId } = await authenticateRequest(req);
      const response = await handler(req, userId, ...args);
      return addCorsHeaders(response, origin);
    } catch (error) {
      const errorResponse = handleAuthError(error);
      return addCorsHeaders(errorResponse, origin);
    }
  };
}

/**
 * Wrapper function for API handlers that need authentication + tenancy
 */
export function withAuthAndTenancy<T extends any[]>(
  handler: (req: Request, userId: string, householdId: string, ...args: T) => Promise<NextResponse>
) {
  return async (req: Request, ...args: T): Promise<NextResponse> => {
    const origin = (req as any).headers?.get('origin');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      return addCorsHeaders(response, origin);
    }
    
    try {
      const { userId, householdId } = await authenticateWithTenancy(req);
      const response = await handler(req, userId, householdId, ...args);
      return addCorsHeaders(response, origin);
    } catch (error) {
      const errorResponse = handleAuthError(error);
      return addCorsHeaders(errorResponse, origin);
    }
  };
}

/**
 * Export OPTIONS handler for routes that use withAuth
 */
export function withAuthOptions<T extends any[]>(
  handler: (req: Request, userId: string, ...args: T) => Promise<NextResponse>
) {
  return async (req: Request, ...args: T): Promise<NextResponse> => {
    const origin = (req as any).headers?.get('origin');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      return addCorsHeaders(response, origin);
    }
    
    try {
      const { userId } = await authenticateRequest(req);
      const response = await handler(req, userId, ...args);
      return addCorsHeaders(response, origin);
    } catch (error) {
      const errorResponse = handleAuthError(error);
      return addCorsHeaders(errorResponse, origin);
    }
  };
}

/**
 * Export OPTIONS handler for routes that use withAuthAndTenancy
 */
export function withAuthAndTenancyOptions<T extends any[]>(
  handler: (req: Request, userId: string, householdId: string, ...args: T) => Promise<NextResponse>
) {
  return async (req: Request, ...args: T): Promise<NextResponse> => {
    const origin = (req as any).headers?.get('origin');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      return addCorsHeaders(response, origin);
    }
    
    try {
      const { userId, householdId } = await authenticateWithTenancy(req);
      const response = await handler(req, userId, householdId, ...args);
      return addCorsHeaders(response, origin);
    } catch (error) {
      const errorResponse = handleAuthError(error);
      return addCorsHeaders(errorResponse, origin);
    }
  };
}