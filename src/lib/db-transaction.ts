import { prisma } from "./prisma";
import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Transaction helper with error handling and retry logic
 */
export class TransactionHelper {
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_RETRY_DELAY = 100; // ms

  /**
   * Execute a function within a database transaction with retry logic
   */
  static async execute<T>(
    fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">) => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = this.DEFAULT_MAX_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await prisma.$transaction(fn, {
          isolationLevel: options.isolationLevel,
        });
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain error types
        if (this.shouldNotRetry(error as Error)) {
          throw error;
        }
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retrying
        await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }

    throw lastError!;
  }

  /**
   * Execute multiple operations in parallel within a transaction
   */
  static async executeParallel<T>(
    operations: Array<(tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">) => Promise<T>>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ): Promise<T[]> {
    return this.execute(async (tx) => {
      return Promise.all(operations.map(op => op(tx)));
    }, options);
  }

  /**
   * Batch operations for better performance
   */
  static async batch<T>(
    operations: Array<(tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">) => Promise<T>>,
    batchSize: number = 10,
    options: {
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await this.executeParallel(batch, options);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Create a savepoint within a transaction
   */
  static async withSavepoint<T>(
    fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, createSavepoint: () => Promise<string>) => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ): Promise<T> {
    return this.execute(async (tx) => {
      const savepoints: string[] = [];
      
      const createSavepoint = async () => {
        const name = `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await (tx as any).$executeRaw(`SAVEPOINT ${name}`);
        savepoints.push(name);
        return name;
      };
      
      try {
        return await fn(tx, createSavepoint);
      } catch (error) {
        // Rollback to the last savepoint if available
        if (savepoints.length > 0) {
          const lastSavepoint = savepoints[savepoints.length - 1];
          try {
            await (tx as any).$executeRaw(`ROLLBACK TO SAVEPOINT ${lastSavepoint}`);
          } catch (rollbackError) {
            // If rollback fails, we still want to throw the original error
            console.error('Failed to rollback to savepoint:', rollbackError);
          }
        }
        throw error;
      }
    }, options);
  }

  /**
   * Check if an error should not be retried
   */
  private static shouldNotRetry(error: Error): boolean {
    // Don't retry on validation errors, unique constraint violations, etc.
    const nonRetryableCodes = [
      'P2002', // Unique constraint violation
      'P2003', // Foreign key constraint violation
      'P2025', // Record not found
    ];
    
    const errorMessage = error.message;
    return nonRetryableCodes.some(code => errorMessage.includes(code));
  }

  /**
   * Delay helper for retry logic
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Common transaction patterns
 */
export const TransactionPatterns = {
  /**
   * Create multiple records with error handling
   */
  async createMany<T>(
    model: keyof PrismaClient,
    data: any[],
    options: {
      skipDuplicates?: boolean;
      batchSize?: number;
    } = {}
  ): Promise<{ created: T[]; errors: any[] }> {
    const { skipDuplicates = false, batchSize = 100 } = options;
    const created: T[] = [];
    const errors: any[] = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        const result = await TransactionHelper.execute(async (tx) => {
          const modelClient = (tx as any)[model];
          
          if (skipDuplicates) {
            // Try to create each record individually to skip duplicates
            const promises = batch.map(async (item) => {
              try {
                return await modelClient.create({ data: item });
              } catch (error: any) {
                if (error.code === 'P2002') {
                  return null; // Skip duplicate
                }
                throw error;
              }
            });
            
            const results = await Promise.all(promises);
            return results.filter(r => r !== null);
          } else {
            // Create all at once
            return await modelClient.createMany({ data: batch });
          }
        });
        
        if (Array.isArray(result)) {
          created.push(...result);
        }
      } catch (error) {
        errors.push({ batch: i / batchSize, error });
      }
    }
    
    return { created, errors };
  },

  /**
   * Update multiple records with conditions
   */
  async updateManyWhere<T>(
    model: keyof PrismaClient,
    where: any,
    data: any
  ): Promise<{ count: number }> {
    return TransactionHelper.execute(async (tx) => {
      const modelClient = (tx as any)[model];
      return await modelClient.updateMany({ where, data });
    });
  },

  /**
   * Soft delete pattern
   */
  async softDelete(
    model: keyof PrismaClient,
    where: any
  ): Promise<{ count: number }> {
    return TransactionHelper.execute(async (tx) => {
      const modelClient = (tx as any)[model];
      return await modelClient.updateMany({
        where,
        data: { deletedAt: new Date() },
      });
    });
  },

  /**
   * Transfer pattern (useful for financial operations)
   */
  async transfer<T>(
    fromModel: keyof PrismaClient,
    toModel: keyof PrismaClient,
    fromId: string,
    toId: string,
    amount: number,
    field: string = 'balance'
  ): Promise<void> {
    await TransactionHelper.execute(async (tx) => {
      const fromClient = (tx as any)[fromModel];
      const toClient = (tx as any)[toModel];
      
      // Decrement from source
      await fromClient.update({
        where: { id: fromId },
        data: { [field]: { decrement: amount } },
      });
      
      // Increment to destination
      await toClient.update({
        where: { id: toId },
        data: { [field]: { increment: amount } },
      });
    });
  },
};

/**
 * Transaction logging helper
 */
export class TransactionLogger {
  private static logs: Array<{
    timestamp: Date;
    operation: string;
    duration: number;
    success: boolean;
    error?: string;
  }> = [];

  static async logTransaction<T>(
    operation: string,
    fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await TransactionHelper.execute(fn);
      
      this.logs.push({
        timestamp: new Date(),
        operation,
        duration: Date.now() - startTime,
        success: true,
      });
      
      return result;
    } catch (error) {
      this.logs.push({
        timestamp: new Date(),
        operation,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      });
      
      throw error;
    }
  }

  static getLogs() {
    return [...this.logs];
  }

  static clearLogs() {
    this.logs = [];
  }
}