import { NextResponse } from "next/server";
import { z } from "zod";
import { createErrorResponse, API_ERROR_CODES } from "./api-response";

export interface ValidationOptions {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
  strict?: boolean; // If true, reject unknown fields
}

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: any;
}

/**
 * Validate request data against schemas
 */
export class RequestValidator {
  /**
   * Parse and validate JSON body
   */
  static async parseBody(req: Request): Promise<any> {
    try {
      return await req.json();
    } catch (error) {
      throw new Error("Invalid JSON in request body");
    }
  }

  /**
   * Parse and validate query parameters
   */
  static parseQuery(req: Request): Record<string, any> {
    const url = new URL(req.url);
    const query: Record<string, any> = {};
    
    url.searchParams.forEach((value, key) => {
      // Try to parse as JSON, fallback to string
      try {
        query[key] = JSON.parse(value);
      } catch {
        query[key] = value;
      }
    });
    
    return query;
  }

  /**
   * Parse and validate headers
   */
  static parseHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};
    
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    return headers;
  }

  /**
   * Validate request against provided schemas
   */
  static async validate<T = any>(
    req: Request,
    options: ValidationOptions
  ): Promise<ValidationResult<T>> {
    const result: any = {};
    const errors: any = {};

    try {
      // Validate body if schema provided
      if (options.body) {
        const body = await this.parseBody(req);
        const bodyResult = options.body.safeParse(body);
        
        if (!bodyResult.success) {
          errors.body = bodyResult.error.flatten();
        } else {
          result.body = bodyResult.data;
        }
      }

      // Validate query if schema provided
      if (options.query) {
        const query = this.parseQuery(req);
        const queryResult = options.query.safeParse(query);
        
        if (!queryResult.success) {
          errors.query = queryResult.error.flatten();
        } else {
          result.query = queryResult.data;
        }
      }

      // Validate headers if schema provided
      if (options.headers) {
        const headers = this.parseHeaders(req);
        const headersResult = options.headers.safeParse(headers);
        
        if (!headersResult.success) {
          errors.headers = headersResult.error.flatten();
        } else {
          result.headers = headersResult.data;
        }
      }

      // Return validation result
      if (Object.keys(errors).length > 0) {
        return {
          success: false,
          errors,
        };
      }

      return {
        success: true,
        data: result as T,
      };
    } catch (error) {
      return {
        success: false,
        errors: {
          general: (error as Error).message,
        },
      };
    }
  }
}

/**
 * Validation middleware factory
 */
export function withValidation<T = any>(
  options: ValidationOptions,
  handler: (req: Request, validatedData: T, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: Request, ...args: any[]): Promise<NextResponse> => {
    const validation = await RequestValidator.validate<T>(req, options);
    
    if (!validation.success) {
      return createErrorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Request validation failed",
        validation.errors,
        400
      );
    }

    try {
      return await handler(req, validation.data!, ...args);
    } catch (error) {
      console.error("Validation middleware error:", error);
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        "Internal server error",
        undefined,
        500
      );
    }
  };
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  // Date range
  dateRange: z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),

  // Search
  search: z.object({
    q: z.string().optional(),
    search: z.string().optional(),
  }),

  // Sorting
  sorting: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  // ID
  id: z.string().cuid(),

  // Household ID (common header)
  householdId: z.string().cuid(),

  // Common filters
  filters: z.object({
    status: z.string().optional(),
    type: z.string().optional(),
    category: z.string().optional(),
  }),
};

/**
 * Specialized validation schemas for your API
 */
export const ApiSchemas = {
  // Transaction queries
  transactionQuery: z.object({
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT']).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  // Account queries
  accountQuery: z.object({
    groupId: z.string().optional(),
    scope: z.enum(['HOUSEHOLD', 'PERSONAL']).optional(),
    isArchived: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  // Category queries
  categoryQuery: z.object({
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  // Common headers
  headers: z.object({
    'x-household-id': z.string().cuid(),
    'content-type': z.string().optional(),
    authorization: z.string().optional(),
  }),
};

/**
 * Validation helpers
 */
export const ValidationHelpers = {
  /**
   * Validate household ID from headers
   */
  validateHouseholdId(req: Request): string | null {
    const householdId = req.headers.get('x-household-id');
    return householdId;
  },

  /**
   * Validate content type
   */
  validateContentType(req: Request, expectedType = 'application/json'): boolean {
    const contentType = req.headers.get('content-type');
    return contentType?.includes(expectedType) ?? false;
  },

  /**
   * Validate file upload
   */
  validateFileUpload(req: Request): {
    isValid: boolean;
    error?: string;
    maxSize?: number;
    allowedTypes?: string[];
  } {
    const contentType = req.headers.get('content-type');
    
    if (!contentType?.includes('multipart/form-data')) {
      return {
        isValid: false,
        error: 'Content-Type must be multipart/form-data',
      };
    }

    // Add more file validation logic as needed
    return {
      isValid: true,
      maxSize: 5 * 1024 * 1024, // 5MB default
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    };
  },

  /**
   * Sanitize input data
   */
  sanitize(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized: any = Array.isArray(data) ? [] : {};

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const value = data[key];
        
        if (typeof value === 'string') {
          // Basic XSS protection
          sanitized[key] = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .trim();
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  },
};

/**
 * Error response formatter for validation errors
 */
export function formatValidationErrors(errors: any): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  const formatError = (error: any, prefix = ''): void => {
    if (error.issues) {
      error.issues.forEach((issue: any) => {
        const path = [...(prefix ? [prefix] : []), ...issue.path].join('.');
        if (!formatted[path]) {
          formatted[path] = [];
        }
        formatted[path].push(issue.message);
      });
    } else if (typeof error === 'object') {
      Object.entries(error).forEach(([key, value]) => {
        formatError(value, prefix ? `${prefix}.${key}` : key);
      });
    }
  };

  formatError(errors);
  return formatted;
}