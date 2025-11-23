import { NextResponse } from "next/server";
import { createErrorResponse, API_ERROR_CODES } from "./api-response";

export interface LogEntry {
  timestamp: string;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  householdId?: string;
  duration?: number;
  statusCode?: number;
  error?: string;
  requestId?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, any>;
}

export interface LoggerOptions {
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  logHeaders?: boolean;
  logBody?: boolean;
  logQuery?: boolean;
  excludePaths?: string[];
  includePaths?: string[];
  maxLogSize?: number;
  customLogger?: (entry: LogEntry) => void;
}

/**
 * Request logger middleware
 */
export class RequestLogger {
  private static instance: RequestLogger;
  private logs: LogEntry[] = [];
  private options: LoggerOptions;
  private maxLogs: number = 1000;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      logLevel: 'info',
      logHeaders: false,
      logBody: false,
      logQuery: true,
      excludePaths: ['/health', '/metrics'],
      maxLogSize: 10000,
      ...options,
    };
  }

  static getInstance(options?: Partial<LoggerOptions>): RequestLogger {
    if (!RequestLogger.instance) {
      RequestLogger.instance = new RequestLogger(options);
    }
    return RequestLogger.instance;
  }

  /**
   * Create a log entry for a request
   */
  createLogEntry(req: Request): LogEntry {
    const url = new URL(req.url);
    const requestId = this.generateRequestId();
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      requestId,
      userAgent: req.headers.get('user-agent') || undefined,
      ip: this.getClientIP(req),
      userId: this.extractUserId(req),
      householdId: this.extractHouseholdId(req),
    };

    // Add headers if enabled
    if (this.options.logHeaders) {
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        // Skip sensitive headers
        if (!this.isSensitiveHeader(key)) {
          headers[key] = value;
        }
      });
      entry.headers = headers;
    }

    // Add query parameters if enabled
    if (this.options.logQuery) {
      const query: Record<string, any> = {};
      url.searchParams.forEach((value, key) => {
        query[key] = value;
      });
      entry.query = query;
    }

    return entry;
  }

  /**
   * Complete a log entry with response information
   */
  completeLogEntry(entry: LogEntry, response: NextResponse, startTime: number): void {
    entry.duration = Date.now() - startTime;
    entry.statusCode = response.status;

    // Log the entry
    this.log(entry);
  }

  /**
   * Log an error for a request
   */
  logError(entry: LogEntry, error: Error): void {
    entry.error = error.message;
    entry.statusCode = 500;
    this.log(entry);
  }

  /**
   * Write log entry to storage
   */
  private log(entry: LogEntry): void {
    // Check if we should log this request
    if (!this.shouldLog(entry)) {
      return;
    }

    // Add to in-memory logs
    this.logs.push(entry);

    // Trim logs if too many
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Call custom logger if provided
    if (this.options.customLogger) {
      this.options.customLogger(entry);
    }

    // Default console logging
    this.consoleLog(entry);
  }

  /**
   * Console logging with colors and formatting
   */
  private consoleLog(entry: LogEntry): void {
    const { logLevel } = this.options;
    
    if (logLevel === 'none') return;

    const status = entry.statusCode || 0;
    const method = entry.method;
    const url = new URL(entry.url);
    const path = url.pathname;
    const duration = entry.duration || 0;
    const isError = status >= 400;

    let logMessage = `[${entry.timestamp}] ${method} ${path} ${status} ${duration}ms`;
    
    if (entry.userId) {
      logMessage += ` user:${entry.userId}`;
    }
    
    if (entry.ip) {
      logMessage += ` ip:${entry.ip}`;
    }

    if (isError) {
      logMessage += ` ERROR: ${entry.error || 'Unknown error'}`;
    }

    // Choose log level based on status
    if (status >= 500) {
      if (logLevel === 'error' || logLevel === 'warn' || logLevel === 'info' || logLevel === 'debug') {
        console.error(`\x1b[31m${logMessage}\x1b[0m`); // Red
      }
    } else if (status >= 400) {
      if (logLevel === 'warn' || logLevel === 'info' || logLevel === 'debug') {
        console.warn(`\x1b[33m${logMessage}\x1b[0m`); // Yellow
      }
    } else if (status >= 300) {
      if (logLevel === 'info' || logLevel === 'debug') {
        console.info(`\x1b[36m${logMessage}\x1b[0m`); // Cyan
      }
    } else {
      if (logLevel === 'info' || logLevel === 'debug') {
        console.log(`\x1b[32m${logMessage}\x1b[0m`); // Green
      }
    }
  }

  /**
   * Check if request should be logged
   */
  private shouldLog(entry: LogEntry): boolean {
    const url = new URL(entry.url);
    const path = url.pathname;

    // Check excluded paths
    if (this.options.excludePaths?.some(excluded => path.includes(excluded))) {
      return false;
    }

    // Check included paths (if specified)
    if (this.options.includePaths && this.options.includePaths.length > 0) {
      return this.options.includePaths.some(included => path.includes(included));
    }

    return true;
  }

  /**
   * Check if header is sensitive
   */
  private isSensitiveHeader(key: string): boolean {
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
      'x-auth-token',
      'password',
      'token',
    ];
    
    return sensitiveHeaders.some(sensitive => 
      key.toLowerCase().includes(sensitive.toLowerCase())
    );
  }

  /**
   * Extract user ID from request
   */
  private extractUserId(req: Request): string | undefined {
    // Try various sources of user ID
    return req.headers.get('x-user-id') ||
           req.headers.get('authorization')?.replace('Bearer ', '') ||
           undefined;
  }

  /**
   * Extract household ID from request
   */
  private extractHouseholdId(req: Request): string | undefined {
    return req.headers.get('x-household-id') || undefined;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string | undefined {
    return req.headers.get('x-forwarded-for') ||
           req.headers.get('x-real-ip') ||
           req.headers.get('cf-connecting-ip') ||
           undefined;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by criteria
   */
  getFilteredLogs(filters: {
    method?: string;
    path?: string;
    statusCode?: number;
    userId?: string;
    from?: Date;
    to?: Date;
  }): LogEntry[] {
    return this.logs.filter(log => {
      if (filters.method && log.method !== filters.method) return false;
      if (filters.path && !log.url.includes(filters.path)) return false;
      if (filters.statusCode && log.statusCode !== filters.statusCode) return false;
      if (filters.userId && log.userId !== filters.userId) return false;
      if (filters.from && new Date(log.timestamp) < filters.from) return false;
      if (filters.to && new Date(log.timestamp) > filters.to) return false;
      return true;
    });
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number;
    errors: number;
    avgDuration: number;
    methodCounts: Record<string, number>;
    statusCounts: Record<string, number>;
  } {
    const total = this.logs.length;
    const errors = this.logs.filter(log => (log.statusCode || 0) >= 400).length;
    const avgDuration = total > 0 
      ? this.logs.reduce((sum, log) => sum + (log.duration || 0), 0) / total 
      : 0;

    const methodCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    this.logs.forEach(log => {
      methodCounts[log.method] = (methodCounts[log.method] || 0) + 1;
      const status = log.statusCode?.toString() || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return {
      total,
      errors,
      avgDuration,
      methodCounts,
      statusCounts,
    };
  }
}

/**
 * Logging middleware factory
 */
export function withLogging(
  options: Partial<LoggerOptions> = {},
  handler: (req: Request, ...args: any[]) => Promise<NextResponse>
) {
  const logger = RequestLogger.getInstance(options);
  
  return async (req: Request, ...args: any[]): Promise<NextResponse> => {
    const startTime = Date.now();
    const logEntry = logger.createLogEntry(req);

    try {
      const response = await handler(req, ...args);
      logger.completeLogEntry(logEntry, response, startTime);
      return response;
    } catch (error) {
      logger.logError(logEntry, error as Error);
      
      // Return standardized error response
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Internal server error',
        undefined,
        500
      );
    }
  };
}

/**
 * Predefined logging configurations
 */
export const LoggingConfigs = {
  // Production: minimal logging
  production: {
    logLevel: 'error' as const,
    logHeaders: false,
    logBody: false,
    logQuery: false,
    excludePaths: ['/health', '/metrics', '/favicon.ico'],
  },

  // Development: verbose logging
  development: {
    logLevel: 'debug' as const,
    logHeaders: true,
    logBody: true,
    logQuery: true,
    excludePaths: [],
  },

  // API: balanced logging
  api: {
    logLevel: 'info' as const,
    logHeaders: false,
    logBody: false,
    logQuery: true,
    excludePaths: ['/health'],
  },

  // Security: focused on security events
  security: {
    logLevel: 'warn' as const,
    logHeaders: true,
    logBody: false,
    logQuery: true,
    excludePaths: [],
    includePaths: ['/auth', '/login', '/api/auth'],
  },
};

/**
 * Logging utilities
 */
export const LoggingUtils = {
  /**
   * Log security events
   */
  logSecurityEvent: (
    event: string,
    req: Request,
    details?: any
  ) => {
    const logger = RequestLogger.getInstance();
    const entry = logger.createLogEntry(req);
    entry.error = `SECURITY: ${event}`;
    if (details) {
      entry.query = { ...entry.query, securityDetails: details };
    }
    (logger as any).log(entry);
  },

  /**
   * Log performance events
   */
  logPerformanceEvent: (
    operation: string,
    duration: number,
    req?: Request
  ) => {
    const logger = RequestLogger.getInstance();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      method: 'PERF',
      url: operation,
      duration,
      requestId: (logger as any).generateRequestId(),
    };

    if (req) {
      entry.userId = (logger as any).extractUserId(req);
      entry.ip = (logger as any).getClientIP(req);
    }

    (logger as any).log(entry);
  },

  /**
   * Export logs to JSON
   */
  exportLogs: (format: 'json' | 'csv' = 'json'): string => {
    const logger = RequestLogger.getInstance();
    const logs = logger.getLogs();

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = [
      'timestamp', 'method', 'url', 'statusCode', 'duration',
      'userId', 'householdId', 'ip', 'error'
    ];
    
    const csvRows = [headers.join(',')];
    
    logs.forEach(log => {
      const row = headers.map(header => {
        const value = (log as any)[header];
        return value ? `"${value.toString().replace(/"/g, '""')}"` : '';
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  },
};