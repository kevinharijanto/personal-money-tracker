import { NextResponse } from "next/server";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  };
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: ApiResponse<T>['meta'],
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }, { status });
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  status: number = 400
): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }, { status });
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  status: number = 200
): NextResponse<ApiResponse<T[]>> {
  const totalPages = Math.ceil(total / limit);
  
  return createSuccessResponse(data, {
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    timestamp: new Date().toISOString(),
  }, status);
}

/**
 * Common error codes
 */
export const API_ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Business logic errors
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INVALID_OPERATION: 'INVALID_OPERATION',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

/**
 * Handle common error scenarios
 */
export const handleApiErrors = {
  unauthorized: (message = 'Unauthorized') => 
    createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, message, undefined, 401),
  
  forbidden: (message = 'Forbidden') => 
    createErrorResponse(API_ERROR_CODES.FORBIDDEN, message, undefined, 403),
  
  notFound: (resource = 'Resource') => 
    createErrorResponse(API_ERROR_CODES.NOT_FOUND, `${resource} not found`, undefined, 404),
  
  validationError: (details: any) => 
    createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Validation failed', details, 400),
  
  conflict: (message = 'Resource conflict') => 
    createErrorResponse(API_ERROR_CODES.CONFLICT, message, undefined, 409),
  
  internalError: (message = 'Internal server error') => 
    createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, message, undefined, 500),
  
  rateLimitExceeded: (message = 'Rate limit exceeded') => 
    createErrorResponse(API_ERROR_CODES.RATE_LIMIT_EXCEEDED, message, undefined, 429),
};