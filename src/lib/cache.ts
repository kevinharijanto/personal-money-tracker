import { NextResponse } from "next/server";

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  keyGenerator?: (req: Request) => string;
  vary?: string[]; // Headers to vary cache by
  revalidate?: number; // Revalidate interval in milliseconds
  tags?: string[]; // Cache tags for invalidation
  staleWhileRevalidate?: number; // Serve stale while revalidating
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
  headers?: Record<string, string>;
  tags?: string[];
}

/**
 * In-memory cache implementation
 */
class MemoryCache {
  private static instance: MemoryCache;
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 1000;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  static getInstance(): MemoryCache {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache();
    }
    return MemoryCache.instance;
  }

  set<T>(key: string, entry: CacheEntry<T>): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, entry);
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  invalidateByTag(tag: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for this
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * Cache middleware factory
 */
export function withCache<T = any>(
  options: CacheOptions = {},
  handler: (req: Request, ...args: any[]) => Promise<NextResponse>
) {
  const cache = MemoryCache.getInstance();
  const defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes default

  return async (req: Request, ...args: any[]): Promise<NextResponse> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return handler(req, ...args);
    }

    // Generate cache key
    const key = options.keyGenerator ? 
      options.keyGenerator(req) : 
      generateDefaultCacheKey(req, options.vary);

    // Check cache
    const cached = cache.get<NextResponse>(key);
    
    if (cached) {
      const response = new NextResponse(cached.data.body, {
        status: cached.data.status,
        statusText: cached.data.statusText,
        headers: cached.data.headers,
      });

      // Add cache headers
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('X-Cache-Age', Math.floor((Date.now() - cached.timestamp) / 1000).toString());
      
      if (cached.etag) {
        response.headers.set('ETag', cached.etag);
      }

      return response;
    }

    // Generate response
    const startTime = Date.now();
    const response = await handler(req, ...args);
    const duration = Date.now() - startTime;

    // Only cache successful responses
    if (response.status >= 200 && response.status < 300) {
      const responseData = await response.clone().json().catch(() => null);
      
      if (responseData !== null) {
        // Generate ETag
        const etag = generateETag(responseData);
        
        // Store in cache
        cache.set(key, {
          data: response,
          timestamp: Date.now(),
          ttl: defaultTTL,
          etag,
          headers: Object.fromEntries(response.headers.entries()),
          tags: options.tags,
        });

        // Add cache headers to response
        response.headers.set('X-Cache', 'MISS');
        response.headers.set('X-Cache-Duration', duration.toString());
        response.headers.set('Cache-Control', `max-age=${Math.floor(defaultTTL / 1000)}`);
        
        if (etag) {
          response.headers.set('ETag', etag);
        }
      }
    } else {
      response.headers.set('X-Cache', 'BYPASS');
    }

    return response;
  };
}

/**
 * Generate default cache key
 */
function generateDefaultCacheKey(req: Request, vary?: string[]): string {
  const url = new URL(req.url);
  let key = `${req.method}:${url.pathname}:${url.search}`;
  
  // Add vary headers to key
  if (vary) {
    vary.forEach(headerName => {
      const value = req.headers.get(headerName);
      if (value) {
        key += `:${headerName}=${value}`;
      }
    });
  }
  
  return key;
}

/**
 * Generate ETag for response data
 */
function generateETag(data: any): string {
  const hash = require('crypto')
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  
  return `"${hash}"`;
}

/**
 * Cache utilities
 */
export const CacheUtils = {
  /**
   * Invalidate cache by tags
   */
  invalidateByTag: (tag: string): number => {
    const cache = MemoryCache.getInstance();
    return cache.invalidateByTag(tag);
  },

  /**
   * Clear all cache
   */
  clear: (): void => {
    const cache = MemoryCache.getInstance();
    cache.clear();
  },

  /**
   * Get cache statistics
   */
  getStats: () => {
    const cache = MemoryCache.getInstance();
    return cache.getStats();
  },

  /**
   * Create a cache key with custom parameters
   */
  createKey: (
    parts: string[],
    params?: Record<string, any>
  ): string => {
    let key = parts.join(':');
    
    if (params) {
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');
      
      if (sortedParams) {
        key += `?${sortedParams}`;
      }
    }
    
    return key;
  },

  /**
   * Check if request supports caching
   */
  isCacheable: (req: Request): boolean => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return false;
    }

    // Don't cache requests with authorization headers
    if (req.headers.get('authorization')) {
      return false;
    }

    // Don't cache requests with cache-control: no-cache
    const cacheControl = req.headers.get('cache-control');
    if (cacheControl?.includes('no-cache')) {
      return false;
    }

    return true;
  },
};

/**
 * Predefined cache configurations
 */
export const CacheConfigs = {
  // Short-lived cache for frequently changing data
  short: {
    ttl: 60 * 1000, // 1 minute
    tags: ['short'],
  },

  // Medium cache for relatively stable data
  medium: {
    ttl: 15 * 60 * 1000, // 15 minutes
    tags: ['medium'],
  },

  // Long cache for rarely changing data
  long: {
    ttl: 60 * 60 * 1000, // 1 hour
    tags: ['long'],
  },

  // Cache for user-specific data
  user: {
    ttl: 5 * 60 * 1000, // 5 minutes
    vary: ['authorization'],
    tags: ['user'],
  },

  // Cache for household-specific data
  household: {
    ttl: 10 * 60 * 1000, // 10 minutes
    vary: ['x-household-id'],
    tags: ['household'],
  },

  // Cache for static/reference data
  static: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    tags: ['static'],
  },
};

/**
 * Cache decorators for specific use cases
 */
export const withCacheByDuration = {
  // 1 minute cache
  oneMinute: (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withCache({ ttl: 60 * 1000 }, handler),

  // 5 minutes cache
  fiveMinutes: (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withCache({ ttl: 5 * 60 * 1000 }, handler),

  // 15 minutes cache
  fifteenMinutes: (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withCache({ ttl: 15 * 60 * 1000 }, handler),

  // 1 hour cache
  oneHour: (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withCache({ ttl: 60 * 60 * 1000 }, handler),

  // 1 day cache
  oneDay: (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withCache({ ttl: 24 * 60 * 60 * 1000 }, handler),
};

/**
 * Cache invalidation helpers
 */
export const CacheInvalidation = {
  /**
   * Invalidate user-specific cache
   */
  invalidateUser: (userId: string): number => {
    return CacheUtils.invalidateByTag(`user:${userId}`);
  },

  /**
   * Invalidate household-specific cache
   */
  invalidateHousehold: (householdId: string): number => {
    return CacheUtils.invalidateByTag(`household:${householdId}`);
  },

  /**
   * Invalidate transaction-related cache
   */
  invalidateTransactions: (householdId: string): number => {
    return CacheUtils.invalidateByTag(`transactions:${householdId}`);
  },

  /**
   * Invalidate account-related cache
   */
  invalidateAccounts: (householdId: string): number => {
    return CacheUtils.invalidateByTag(`accounts:${householdId}`);
  },

  /**
   * Invalidate category-related cache
   */
  invalidateCategories: (householdId: string): number => {
    return CacheUtils.invalidateByTag(`categories:${householdId}`);
  },
};

/**
 * Cache middleware for API routes
 */
export const withApiCache = (
  route: string,
  options: Partial<CacheOptions> = {}
) => {
  const config = { ...CacheConfigs.medium, ...options };
  
  return (handler: (req: Request, ...args: any[]) => Promise<NextResponse>) =>
    withCache({
      ...config,
      keyGenerator: (req) => {
        const url = new URL(req.url);
        return `api:${route}:${url.pathname}${url.search}`;
      },
      tags: [`api:${route}`, ...(config.tags || [])],
    }, handler);
};