import { URL } from 'url';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  maxLimit?: number;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Parse pagination parameters from a URL
 */
export function parsePaginationParams(
  url: string | URL,
  options: PaginationOptions = {}
): PaginationResult {
  const urlObj = typeof url === 'string' ? new URL(url) : url;
  
  // Get page and limit from query params, with defaults
  let page = parseInt(urlObj.searchParams.get('page') || '1');
  let limit = parseInt(urlObj.searchParams.get('limit') || '20');
  
  // Apply constraints
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = options.limit || 20;
  if (options.maxLimit && limit > options.maxLimit) limit = options.maxLimit;
  
  const skip = (page - 1) * limit;
  
  return {
    skip,
    take: limit,
    page,
    limit,
  };
}

/**
 * Create pagination metadata for responses
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Apply pagination to a Prisma query
 */
export function applyPagination<T extends Record<string, any>>(
  query: T,
  pagination: PaginationResult
): T {
  return {
    ...query,
    skip: pagination.skip,
    take: pagination.take,
  };
}

/**
 * Get pagination links for API responses
 */
export function getPaginationLinks(
  baseUrl: string,
  page: number,
  limit: number,
  totalPages: number
): Record<string, string | null> {
  const url = new URL(baseUrl);
  
  const setPage = (p: number) => {
    url.searchParams.set('page', p.toString());
    url.searchParams.set('limit', limit.toString());
    return url.toString();
  };
  
  return {
    first: page > 1 ? setPage(1) : null,
    prev: page > 1 ? setPage(page - 1) : null,
    self: setPage(page),
    next: page < totalPages ? setPage(page + 1) : null,
    last: page < totalPages ? setPage(totalPages) : null,
  };
}

/**
 * Cursor-based pagination utilities
 */
export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
  maxLimit?: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationResult {
  cursor?: string;
  take: number;
  skip?: number;
  orderBy: Record<string, 'asc' | 'desc'>;
}

/**
 * Parse cursor pagination parameters
 */
export function parseCursorPagination(
  url: string | URL,
  options: CursorPaginationOptions = {}
): CursorPaginationResult {
  const urlObj = typeof url === 'string' ? new URL(url) : url;
  
  const cursor = urlObj.searchParams.get('cursor') || undefined;
  let limit = parseInt(urlObj.searchParams.get('limit') || '20');
  const direction = urlObj.searchParams.get('direction') as 'forward' | 'backward' || 'forward';
  
  // Apply constraints
  if (isNaN(limit) || limit < 1) limit = options.limit || 20;
  if (options.maxLimit && limit > options.maxLimit) limit = options.maxLimit;
  
  // For cursor pagination, we fetch one extra record to determine if there are more
  const take = limit + 1;
  
  // Default ordering by createdAt
  const orderBy = { createdAt: direction === 'forward' ? 'desc' : 'asc' as const };
  
  return {
    cursor,
    take,
    orderBy: orderBy as Record<string, 'asc' | 'desc'>,
  };
}

/**
 * Process cursor pagination results
 */
export function processCursorResults<T extends { id: string }>(
  results: T[],
  limit: number,
  direction: 'forward' | 'backward'
): {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
  prevCursor?: string;
} {
  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, -1) : results;
  
  // Reverse results if going backward
  const orderedData = direction === 'backward' ? data.reverse() : data;
  
  const nextCursor = hasMore && direction === 'forward' ? 
    orderedData[orderedData.length - 1]?.id : undefined;
  const prevCursor = hasMore && direction === 'backward' ? 
    orderedData[0]?.id : undefined;
  
  return {
    data: orderedData,
    hasMore,
    nextCursor,
    prevCursor,
  };
}