import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, API_ERROR_CODES } from "@/lib/api-response";
import { withRateLimit, RateLimitConfigs } from "@/lib/rate-limit";
import { withLogging, LoggingConfigs } from "@/lib/request-logger";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
    api: HealthCheck;
  };
  details?: {
    database?: {
      connectionPool?: any;
      responseTime?: number;
    };
    memory?: {
      used: number;
      total: number;
      percentage: number;
    };
    disk?: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
}

/**
 * Health check endpoint with comprehensive system monitoring
 */
export const GET = withRateLimit(
  RateLimitConfigs.healthCheck,
  withLogging(
    LoggingConfigs.production,
    async (req: Request): Promise<NextResponse> => {
      const startTime = Date.now();
      
      try {
        const healthResult = await performHealthCheck();
        const duration = Date.now() - startTime;
        
        // Determine HTTP status based on overall health
        let httpStatus = 200;
        if (healthResult.status === 'unhealthy') {
          httpStatus = 503;
        } else if (healthResult.status === 'degraded') {
          httpStatus = 200; // Still serve traffic but indicate issues
        }
        
        const response = createSuccessResponse(healthResult, undefined, httpStatus);
        response.headers.set('X-Health-Check-Duration', duration.toString());
        
        return response;
      } catch (error) {
        console.error('Health check failed:', error);
        
        const errorResponse = createErrorResponse(
          API_ERROR_CODES.INTERNAL_ERROR,
          'Health check failed',
          { error: (error as Error).message },
          503
        );
        
        return errorResponse;
      }
    }
  )
);

/**
 * Perform comprehensive health check
 */
async function performHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  // Initialize health result
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: { status: 'pass' },
      memory: { status: 'pass' },
      disk: { status: 'pass' },
      api: { status: 'pass' },
    },
  };

  // Perform checks in parallel
  const [dbCheck, memoryCheck, diskCheck] = await Promise.allSettled([
    checkDatabase(),
    checkMemory(),
    checkDisk(),
  ]);

  // Process database check
  if (dbCheck.status === 'fulfilled') {
    result.checks.database = dbCheck.value;
    result.details = result.details || {};
    result.details.database = dbCheck.value.details;
    
    if (dbCheck.value.status === 'fail') {
      result.status = 'unhealthy';
    } else if (dbCheck.value.status === 'warn') {
      result.status = 'degraded';
    }
  } else {
    result.checks.database = {
      status: 'fail',
      message: 'Database check failed',
    };
    result.status = 'unhealthy';
  }

  // Process memory check
  if (memoryCheck.status === 'fulfilled') {
    result.checks.memory = memoryCheck.value;
    result.details = result.details || {};
    result.details.memory = memoryCheck.value.details;
    
    if (memoryCheck.value.status === 'fail') {
      result.status = result.status === 'healthy' ? 'degraded' : 'unhealthy';
    }
  } else {
    result.checks.memory = {
      status: 'warn',
      message: 'Memory check failed',
    };
    if (result.status === 'healthy') {
      result.status = 'degraded';
    }
  }

  // Process disk check
  if (diskCheck.status === 'fulfilled') {
    result.checks.disk = diskCheck.value;
    result.details = result.details || {};
    result.details.disk = diskCheck.value.details;
    
    if (diskCheck.value.status === 'fail') {
      result.status = result.status === 'healthy' ? 'degraded' : 'unhealthy';
    }
  } else {
    result.checks.disk = {
      status: 'warn',
      message: 'Disk check failed',
    };
    if (result.status === 'healthy') {
      result.status = 'degraded';
    }
  }

  // API check (always passes if we can reach this point)
  result.checks.api = {
    status: 'pass',
    duration: Date.now() - startTime,
  };

  return result;
}

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<HealthCheck & { details?: any }> {
  const startTime = Date.now();
  
  try {
    // Simple connection test
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    // Check connection pool stats if available
    let connectionPool;
    try {
      // This might not be available in all Prisma versions
      connectionPool = (prisma as any)._engine?.config?.activeConnection;
    } catch {
      // Ignore if not available
    }
    
    const status = responseTime > 1000 ? 'warn' : 'pass';
    
    return {
      status,
      duration: responseTime,
      details: {
        responseTime,
        connectionPool,
      },
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Database connection failed: ${(error as Error).message}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): HealthCheck & { details?: any } {
  const memUsage = process.memoryUsage();
  const totalMemory = require('os').totalmem();
  const freeMemory = require('os').freemem();
  const usedMemory = totalMemory - freeMemory;
  
  const heapUsed = memUsage.heapUsed;
  const heapTotal = memUsage.heapTotal;
  const heapPercentage = (heapUsed / heapTotal) * 100;
  const systemPercentage = (usedMemory / totalMemory) * 100;
  
  let status: 'pass' | 'warn' | 'fail' = 'pass';
  let message: string | undefined;
  
  if (heapPercentage > 90) {
    status = 'fail';
    message = 'Heap memory usage critical';
  } else if (heapPercentage > 80) {
    status = 'warn';
    message = 'Heap memory usage high';
  } else if (systemPercentage > 90) {
    status = 'fail';
    message = 'System memory usage critical';
  } else if (systemPercentage > 80) {
    status = 'warn';
    message = 'System memory usage high';
  }
  
  return {
    status,
    message,
    details: {
      used: Math.round(heapUsed / 1024 / 1024), // MB
      total: Math.round(heapTotal / 1024 / 1024), // MB
      percentage: Math.round(heapPercentage * 100) / 100,
    },
  };
}

/**
 * Check disk usage (simplified version)
 */
function checkDisk(): HealthCheck & { details?: any } {
  // In a real implementation, you'd check actual disk usage
  // For now, we'll return a placeholder
  const usedPercentage = Math.random() * 100; // Placeholder
  
  let status: 'pass' | 'warn' | 'fail' = 'pass';
  let message: string | undefined;
  
  if (usedPercentage > 95) {
    status = 'fail';
    message = 'Disk usage critical';
  } else if (usedPercentage > 85) {
    status = 'warn';
    message = 'Disk usage high';
  }
  
  return {
    status,
    message,
    details: {
      used: Math.round(usedPercentage * 10), // Placeholder GB
      total: 100, // Placeholder GB
      percentage: Math.round(usedPercentage * 100) / 100,
    },
  };
}

/**
 * Simple health check endpoint (for load balancers)
 */
export const HEAD = withRateLimit(
  RateLimitConfigs.healthCheck,
  async (): Promise<NextResponse> => {
    try {
      // Quick database check
      await prisma.$queryRaw`SELECT 1`;
      
      return new NextResponse(null, { 
        status: 200,
        headers: {
          'X-Health': 'ok',
          'X-Timestamp': new Date().toISOString(),
        },
      });
    } catch (error) {
      return new NextResponse(null, { 
        status: 503,
        headers: {
          'X-Health': 'error',
          'X-Timestamp': new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * Readiness check endpoint
 */
export const POST = withRateLimit(
  RateLimitConfigs.healthCheck,
  async (req: Request): Promise<NextResponse> => {
    try {
      const body = await req.json().catch(() => ({}));
      const checks = body.checks || ['database'];
      
      const results: Record<string, HealthCheck> = {};
      
      if (checks.includes('database')) {
        results.database = await checkDatabase();
      }
      
      if (checks.includes('memory')) {
        results.memory = checkMemory();
      }
      
      if (checks.includes('disk')) {
        results.disk = checkDisk();
      }
      
      const allPassed = Object.values(results).every(check => check.status === 'pass');
      const status = allPassed ? 200 : 503;
      
      return createSuccessResponse({
        status: allPassed ? 'ready' : 'not-ready',
        timestamp: new Date().toISOString(),
        checks: results,
      }, undefined, status);
      
    } catch (error) {
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Readiness check failed',
        { error: (error as Error).message },
        503
      );
    }
  }
);
