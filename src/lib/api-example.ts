/**
 * Example of how to use the new API utilities to improve an existing endpoint
 * This demonstrates best practices for API development
 */

import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { withAuthAndTenancy } from "./hybrid-auth";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createPaginatedResponse,
  API_ERROR_CODES 
} from "./api-response";
import { withValidation, ApiSchemas } from "./validation-middleware";
import { withRateLimit, RateLimitConfigs } from "./rate-limit";
import { withLogging, LoggingConfigs } from "./request-logger";
import { withCache, CacheConfigs } from "./cache";
import { parsePaginationParams, createPaginationMeta } from "./pagination";
import { TransactionHelper } from "./db-transaction";
import { z } from "zod";
import { createTxnSchemaV2 } from "./validations";

const BatchTransactionsSchema = z.object({
  transactions: z.array(createTxnSchemaV2).min(1).max(100),
});
type BatchTransaction = z.infer<typeof createTxnSchemaV2>;

/**
 * Enhanced GET /api/transactions example
 * Shows how to combine all the new utilities
 */
export const GET = withRateLimit(
  RateLimitConfigs.read,
  withLogging(
    LoggingConfigs.api,
    withCache(
      CacheConfigs.household,
      withValidation(
        {
          query: ApiSchemas.transactionQuery,
          headers: ApiSchemas.headers,
        },
        async (req: Request, validated, userId: string, householdId: string) => {
          try {
            // Parse pagination
            const pagination = parsePaginationParams(req.url);
            
            // Build where clause with validated data
            const where: any = {
              account: {
                AND: [
                  { group: { householdId } },
                  { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
                ],
              },
            };
            
            // Apply filters from validated query
            if (validated.query.accountId) {
              where.accountId = validated.query.accountId;
            }
            if (validated.query.categoryId) {
              where.categoryId = validated.query.categoryId;
            }
            if (validated.query.type) {
              where.type = validated.query.type;
            }
            if (validated.query.dateFrom || validated.query.dateTo) {
              where.date = {};
              if (validated.query.dateFrom) {
                where.date.gte = new Date(validated.query.dateFrom);
              }
              if (validated.query.dateTo) {
                where.date.lte = new Date(validated.query.dateTo);
              }
            }
            if (validated.query.q) {
              where.description = { contains: validated.query.q, mode: "insensitive" };
            }

            // Get total count for pagination
            const total = await prisma.transaction.count({ where });

            // Get paginated results
            const txns = await prisma.transaction.findMany({
              where,
              include: { account: true, category: true },
              orderBy: { date: "desc" },
              skip: pagination.skip,
              take: pagination.take,
            });

            // Return paginated response
            const meta = createPaginationMeta(pagination.page, pagination.limit, total);
            return createPaginatedResponse(txns, pagination.page, pagination.limit, total);

          } catch (error) {
            console.error('Failed to fetch transactions:', error);
            return createErrorResponse(
              API_ERROR_CODES.INTERNAL_ERROR,
              'Failed to fetch transactions',
              { error: (error as Error).message }
            );
          }
        }
      )
    )
  )
);

/**
 * Enhanced POST /api/transactions example
 * Shows transaction handling with proper error handling and validation
 */
export const POST = withRateLimit(
  RateLimitConfigs.write,
  withLogging(
    LoggingConfigs.api,
    withValidation(
      {
        body: ApiSchemas.transactionQuery, // Using transaction schema for body validation
        headers: ApiSchemas.headers,
      },
      async (req: Request, validated, userId: string, householdId: string) => {
        try {
          // Use transaction helper for data consistency
          const result = await TransactionHelper.execute(async (tx) => {
            const { amount, type, accountId, categoryId, description, date } = validated.body;

            // Validate account exists and is accessible
            const account = await tx.account.findFirst({
              where: {
                id: accountId,
                AND: [
                  { group: { householdId } },
                  { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
                ],
              },
            });

            if (!account) {
              throw new Error('Account not found or not accessible');
            }

            // Validate category belongs to household
            const category = await tx.category.findFirst({
              where: { id: categoryId, householdId },
            });

            if (!category) {
              throw new Error('Category not found in this household');
            }

            // Validate category type matches transaction type
            if (type === "INCOME" && category.type !== "INCOME") {
              throw new Error('Income transactions must use an INCOME category');
            }
            if ((type === "EXPENSE" || type === "TRANSFER_OUT") && category.type !== "EXPENSE") {
              throw new Error('Expense transactions must use an EXPENSE category');
            }

            // Create transaction with proper signing
            const isNegative = type === "EXPENSE" || type === "TRANSFER_OUT";
            const signed = isNegative ? `-${amount}` : amount;

            const txn = await tx.transaction.create({
              data: {
                amount: signed,
                type,
                accountId,
                categoryId,
                description,
                ...(date ? { date: new Date(date) } : {}),
              },
            });

            return txn;
          }
        );

          // Invalidate relevant cache
          // CacheInvalidation.invalidateTransactions(householdId);
          // CacheInvalidation.invalidateAccounts(householdId);

          return createSuccessResponse(result, undefined, 201);

        } catch (error) {
          console.error('Failed to create transaction:', error);
          
          // Handle specific error types
          if ((error as Error).message.includes('not found')) {
            return createErrorResponse(
              API_ERROR_CODES.NOT_FOUND,
              (error as Error).message
            );
          }
          
          if ((error as Error).message.includes('must use')) {
            return createErrorResponse(
              API_ERROR_CODES.VALIDATION_ERROR,
              (error as Error).message
            );
          }

          return createErrorResponse(
            API_ERROR_CODES.INTERNAL_ERROR,
            'Failed to create transaction',
            { error: (error as Error).message }
          );
        }
      }
    )
  )
);

/**
 * Example of a batch operation using transaction helper
 */
export const BATCH_CREATE = withRateLimit(
  RateLimitConfigs.write,
  withLogging(
    LoggingConfigs.api,
    withValidation(
      {
        body: BatchTransactionsSchema,
        headers: ApiSchemas.headers,
      },
      async (req: Request, validated, userId: string, householdId: string) => {
        try {
          const { transactions } = validated.body as { transactions: BatchTransaction[] };

          // Use batch transaction helper
          const results = await TransactionHelper.batch(
            transactions.map((txn: BatchTransaction) => 
              async (tx) => {
                // Validation logic similar to single transaction
                const account = await tx.account.findFirst({
                  where: {
                    id: txn.accountId,
                    AND: [
                      { group: { householdId } },
                      { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
                    ],
                  },
                });

                if (!account) {
                  throw new Error(`Account ${txn.accountId} not found or not accessible`);
                }

                return tx.transaction.create({
                  data: {
                    amount: txn.amount,
                    type: txn.type,
                    accountId: txn.accountId,
                    categoryId: txn.categoryId,
                    description: txn.description,
                    ...(txn.date ? { date: new Date(txn.date) } : {}),
                  },
                });
              }
            ),
            10 // Process in batches of 10
          );

          return createSuccessResponse({
            created: results.length,
            transactions: results,
          }, undefined, 201);

        } catch (error) {
          console.error('Failed to create batch transactions:', error);
          return createErrorResponse(
            API_ERROR_CODES.INTERNAL_ERROR,
            'Failed to create batch transactions',
            { error: (error as Error).message }
          );
        }
      }
    )
  )
);

/**
 * Example of how to use the utilities in existing routes
 * This shows a migration path for current endpoints
 */
export const migrateExistingRoute = (existingHandler: Function) => {
  return withRateLimit(
    RateLimitConfigs.api,
    withLogging(
      LoggingConfigs.api,
      async (req: Request, ...args: any[]) => {
        try {
          // Add standard error handling
          const result = await existingHandler(req, ...args);
          
          // Ensure response has proper headers
          if (result instanceof NextResponse) {
            result.headers.set('X-API-Version', '2.0');
            result.headers.set('X-Response-Time', Date.now().toString());
          }
          
          return result;
        } catch (error) {
          console.error('Route error:', error);
          
          // Convert existing error responses to standardized format
          if (error instanceof NextResponse) {
            return error;
          }
          
          return createErrorResponse(
            API_ERROR_CODES.INTERNAL_ERROR,
            'Internal server error',
            { error: (error as Error).message }
          );
        }
      }
    )
  );
};

/**
 * Usage examples and best practices
 */
export const API_USAGE_EXAMPLES = {
  // How to add caching to existing GET endpoint
  addCaching: `
    export const GET = withCache(
      CacheConfigs.medium,
      withAuthAndTenancy(async (req, userId, householdId) => {
        // Your existing GET logic here
        const data = await fetchData(userId, householdId);
        return NextResponse.json(data);
      })
    );
  `,

  // How to add rate limiting
  addRateLimiting: `
    export const POST = withRateLimit(
      RateLimitConfigs.write,
      withAuthAndTenancy(async (req, userId, householdId) => {
        // Your existing POST logic here
        const result = await createData(req, userId, householdId);
        return NextResponse.json(result, { status: 201 });
      })
    );
  `,

  // How to add validation
  addValidation: `
    export const PUT = withValidation(
      {
        body: updateSchema,
        headers: ApiSchemas.headers,
      },
      withAuthAndTenancy(async (req, validated, userId, householdId) => {
        // Use validated.data instead of req.json()
        const result = await updateData(validated.data, userId, householdId);
        return NextResponse.json(result);
      })
    );
  `,

  // How to add logging
  addLogging: `
    export const DELETE = withLogging(
      LoggingConfigs.api,
      withAuthAndTenancy(async (req, userId, householdId) => {
        // Your existing DELETE logic here
        await deleteData(req, userId, householdId);
        return new NextResponse(null, { status: 204 });
      })
    );
  `,

  // How to combine multiple utilities
  combineUtilities: `
    export const GET = withRateLimit(
      RateLimitConfigs.read,
      withLogging(
        LoggingConfigs.api,
        withCache(
          CacheConfigs.household,
          withValidation(
            { query: querySchema, headers: ApiSchemas.headers },
            withAuthAndTenancy(async (req, validated, userId, householdId) => {
              // All utilities are now applied!
              const pagination = parsePaginationParams(req.url);
              const data = await fetchData(validated.query, pagination);
              return createPaginatedResponse(data, pagination.page, pagination.limit, total);
            })
          )
        )
      )
    );
  `,
};
