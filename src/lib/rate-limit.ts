import { NextResponse } from "next/server";
import { createErrorResponse, API_ERROR_CODES } from "./api-response";

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  message?: string; // Custom error message
  headers?: boolean; // Include rate limit headers in response
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

/**
 * In-memory rate limiter (for development/single instance)
 */
class MemoryRateLimiter {
  private static instance: MemoryRateLimiter;
  private requests: Map<string, Array<{ timestamp: number }>> = new Map();

  static getInstance(): MemoryRateLimiter {
    if (!MemoryRateLimiter.instance) {
      MemoryRateLimiter.instance = new MemoryRateLimiter();
    }
    return MemoryRateLimiter.instance;
  }

  isAllowed(key: string, options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    // Get existing requests for this key
    let requests = this.requests.get(key) || [];
    
    // Filter out old requests outside the window
    requests = requests.filter(req => req.timestamp > windowStart);
    
    // Check if limit exceeded
    const success = requests.length < options.maxRequests;
    
    if (success) {
      // Add current request
      requests.push({ timestamp: now });
    }
    
    // Update stored requests
    this.requests.set(key, requests);
    
    // Calculate reset time
    const oldestRequest = requests[0];
    const resetTime = new Date(oldestRequest ? oldestRequest.timestamp + options.windowMs : now + options.windowMs);
    
    return {
      success,
      limit: options.maxRequests,
      remaining: Math.max(0, options.maxRequests - requests.length),
      resetTime,
      retryAfter: success ? undefined : Math.ceil((resetTime.getTime() - now) / 1000),
    };
  }

  // Cleanup old entries periodically
  cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, requests] of this.requests.entries()) {
      const filtered = requests.filter(req => now - req.timestamp < maxAge);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
  }
}

// Start cleanup interval
if (typeof window === 'undefined') { // Only run on server
  setInterval(() => {
    MemoryRateLimiter.getInstance().cleanup();
  }, 60000); // Cleanup every minute
}

/**
 * Rate limiting middleware
 */
export function withRateLimit(
  options: RateLimitOptions,
  handler: (req: Request, ...args: any[]) => Promise<NextResponse>
) {
  const limiter = MemoryRateLimiter.getInstance();
  
  return async (req: Request, ...args: any[]): Promise<NextResponse> => {
    // Generate key for rate limiting
    const key = options.keyGenerator ? 
      options.keyGenerator(req) : 
      generateDefaultKey(req);
    
    // Check rate limit
    const result = limiter.isAllowed(key, options);
    
    // Add rate limit headers if enabled
    const addHeaders = (response: NextResponse) => {
      if (options.headers !== false) {
        response.headers.set('X-RateLimit-Limit', result.limit.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.resetTime.toISOString());
        
        if (result.retryAfter) {
          response.headers.set('Retry-After', result.retryAfter.toString());
        }
      }
      return response;
    };
    
    // If rate limit exceeded, return error
    if (!result.success) {
      const errorResponse = createErrorResponse(
        API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        options.message || 'Rate limit exceeded',
        {
          limit: result.limit,
          resetTime: result.resetTime,
          retryAfter: result.retryAfter,
        },
        429
      );
      
      return addHeaders(errorResponse);
    }
    
    try {
      // Execute the handler
      const response = await handler(req, ...args);
      
      // Don't count successful requests if configured
      if (options.skipSuccessfulRequests) {
        // We would need to implement decrement logic here
        // For now, we'll just count all requests
      }
      
      return addHeaders(response);
    } catch (error) {
      // Don't count failed requests if configured
      if (options.skipFailedRequests) {
        // We would need to implement decrement logic here
        // For now, we'll just count all requests
      }
      
      const errorResponse = createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Internal server error',
        undefined,
        500
      );
      
      return addHeaders(errorResponse);
    }
  };
}

/**
 * Default key generator
 */
function generateDefaultKey(req: Request): string {
  // Try to get user ID from various sources
  const userId = req.headers.get('x-user-id') ||
                 req.headers.get('authorization')?.replace('Bearer ', '') ||
                 req.headers.get('x-forwarded-for') ||
                 'anonymous';
  
  // Combine with IP and endpoint
  const url = new URL(req.url);
  const endpoint = `${req.method}:${url.pathname}`;
  
  return `${userId}:${endpoint}`;
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfigs = {
  // Very permissive for health checks
  healthCheck: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    headers: true,
  },
  
  // Strict for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later',
    headers: true,
  },
  
  // Moderate for general API
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    headers: true,
  },
  
  // Lenient for read operations
  read: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 200,
    headers: true,
  },
  
  // Strict for write operations
  write: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50,
    headers: true,
  },
  
  // Very strict for sensitive operations
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Too many sensitive operations, please try again later',
    headers: true,
  },
};

/**
 * Rate limiting utilities
 */
export const RateLimitUtils = {
  /**
   * Create a rate limiter for specific user
   */
  forUser(userId: string, options: RateLimitOptions) {
    return withRateLimit({
      ...options,
      keyGenerator: (req) => `user:${userId}:${new URL(req.url).pathname}`,
    });
  },
  
  /**
   * Create a rate limiter for IP address
   */
  forIP(options: RateLimitOptions) {
    return withRateLimit({
      ...options,
      keyGenerator: (req) => {
        const ip = req.headers.get('x-forwarded-for') || 
                  req.headers.get('x-real-ip') || 
                  'unknown';
        return `ip:${ip}:${new URL(req.url).pathname}`;
      },
    });
  },
  
  /**
   * Create a rate limiter for specific endpoint
   */
  forEndpoint(endpoint: string, options: RateLimitOptions) {
    return withRateLimit({
      ...options,
      keyGenerator: (req) => `endpoint:${endpoint}:${req.headers.get('authorization') || 'anonymous'}`,
    });
  },
  
  /**
   * Create a progressive rate limiter (increases restrictions over time)
   */
  progressive(baseOptions: RateLimitOptions) {
    return withRateLimit({
      ...baseOptions,
      keyGenerator: (req) => {
        const key = generateDefaultKey(req);
        const limiter = MemoryRateLimiter.getInstance();
        
        // Get current request count
        const current = limiter.isAllowed(key, {
          windowMs: baseOptions.windowMs,
          maxRequests: baseOptions.maxRequests,
        });
        
        // If approaching limit, make it stricter
        if (current.remaining < baseOptions.maxRequests * 0.2) {
          return `${key}:strict`;
        }
        
        return key;
      },
    });
  },
};

/**
 * Rate limiting middleware for different HTTP methods
 */
export const withMethodRateLimit = {
  get: (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withRateLimit(RateLimitConfigs.read, handler),
  
  post: (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withRateLimit(RateLimitConfigs.write, handler),
  
  put: (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withRateLimit(RateLimitConfigs.write, handler),
  
  delete: (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withRateLimit(RateLimitConfigs.sensitive, handler),
  
  patch: (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withRateLimit(RateLimitConfigs.write, handler),
};

/**
 * Rate limiting for specific API routes
 */
export const createApiRateLimit = (
  route: string,
  options: Partial<RateLimitOptions> = {}
) => {
  const config = { ...RateLimitConfigs.api, ...options };
  
  return (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withRateLimit({
      ...config,
      keyGenerator: (req) => {
        const url = new URL(req.url);
        return `route:${route}:${req.headers.get('authorization') || 'anonymous'}`;
      },
    }, handler);
};