# API Utilities Guide

This guide explains how to use the new API utilities to improve your personal money tracker API.

## 🚀 Quick Start

### 1. Fix the Double Currency Issue

The main issue you reported (double Rp display) has been fixed in the transaction update logic. The problem was that transaction amounts were being double-signed when updating.

**Fixed in:** `src/app/api/transactions/[id]/route.ts`

### 2. Use the New Transaction Utilities

Import the transaction utilities to prevent amount handling issues:

```typescript
import { 
  signAmount, 
  resignAmount, 
  createTransactionData,
  updateTransactionData,
  TransactionTypes,
  formatAmount 
} from '@/lib/transaction-utils';
```

## 📚 Available Utilities

### 1. API Response Standardization (`src/lib/api-response.ts`)

Standardizes all API responses with consistent format:

```typescript
import { createSuccessResponse, createErrorResponse, API_ERROR_CODES } from '@/lib/api-response';

// Success response
return createSuccessResponse(data, { pagination: {...} });

// Error response
return createErrorResponse(
  API_ERROR_CODES.NOT_FOUND,
  'Resource not found',
  { details: '...' }
);
```

### 2. Request Validation (`src/lib/validation-middleware.ts`)

Validate requests using Zod schemas:

```typescript
import { withValidation, ApiSchemas } from '@/lib/validation-middleware';

export const POST = withValidation(
  {
    body: ApiSchemas.transactionQuery,
    headers: ApiSchemas.headers,
  },
  async (req, validated, userId, householdId) => {
    // Use validated.data instead of req.json()
    const { amount, type } = validated.data;
    // Your logic here
  }
);
```

### 3. Rate Limiting (`src/lib/rate-limit.ts`)

Protect your endpoints from abuse:

```typescript
import { withRateLimit, RateLimitConfigs } from '@/lib/rate-limit';

export const GET = withRateLimit(
  RateLimitConfigs.read, // or create custom config
  async (req, userId, householdId) => {
    // Your logic here
  }
);
```

### 4. Request Logging (`src/lib/request-logger.ts`)

Add comprehensive logging:

```typescript
import { withLogging, LoggingConfigs } from '@/lib/request-logger';

export const POST = withLogging(
  LoggingConfigs.api, // or custom config
  async (req, userId, householdId) => {
    // Your logic here - automatically logged
  }
);
```

### 5. Response Caching (`src/lib/cache.ts`)

Cache GET requests for better performance:

```typescript
import { withCache, CacheConfigs } from '@/lib/cache';

export const GET = withCache(
  CacheConfigs.household, // 10 minute cache
  async (req, userId, householdId) => {
    // Your logic here - automatically cached
  }
);
```

### 6. Pagination (`src/lib/pagination.ts`)

Add pagination to list endpoints:

```typescript
import { parsePaginationParams, createPaginationMeta } from '@/lib/pagination';

export const GET = async (req, userId, householdId) => {
  const pagination = parsePaginationParams(req.url);
  
  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { /* your where clause */ },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.transaction.count({ where: { /* your where clause */ } }),
  ]);
  
  const meta = createPaginationMeta(pagination.page, pagination.limit, total);
  return createSuccessResponse(data, { pagination: meta });
};
```

### 7. Database Transactions (`src/lib/db-transaction.ts`)

Ensure data consistency with transaction helpers:

```typescript
import { TransactionHelper } from '@/lib/db-transaction';

export const POST = async (req, userId, householdId) => {
  const result = await TransactionHelper.execute(async (tx) => {
    // Multiple operations in single transaction
    const account = await tx.account.findFirst({ where: {...} });
    const transaction = await tx.transaction.create({ data: {...} });
    
    // All or nothing - if any fails, everything rolls back
    return { account, transaction };
  });
  
  return createSuccessResponse(result);
};
```

### 8. Transaction Utilities (`src/lib/transaction-utils.ts`)

Handle transaction amounts correctly:

```typescript
import { 
  signAmount, 
  resignAmount, 
  createTransactionData,
  formatAmount,
  TransactionTypes 
} from '@/lib/transaction-utils';

// Create new transaction with proper signing
const txnData = createTransactionData({
  amount: '50.00', // Positive amount
  type: 'EXPENSE',   // Will be signed as -50.00
  accountId: 'acc_123',
  categoryId: 'cat_123',
  description: 'Groceries',
});

// Update transaction with proper re-signing
const updates = updateTransactionData(
  { amount: '-50.00', type: 'EXPENSE' }, // Current
  { type: 'INCOME' } // New type - will re-sign to +50.00
);

// Format for display
const display = formatAmount('-50000', 'IDR'); // "Rp -50.000"
```

## 🔧 Migration Examples

### Upgrade Existing Endpoint

Here's how to upgrade an existing endpoint with all utilities:

```typescript
// BEFORE (your current code)
export const GET = withAuthAndTenancy(async (req, userId, householdId) => {
  const txns = await prisma.transaction.findMany({
    where: { /* your logic */ },
    include: { account: true, category: true },
  });
  return NextResponse.json(txns);
});

// AFTER (with all utilities)
export const GET = withRateLimit(
  RateLimitConfigs.read,
  withLogging(
    LoggingConfigs.api,
    withCache(
      CacheConfigs.household,
      withValidation(
        { query: ApiSchemas.transactionQuery, headers: ApiSchemas.headers },
        async (req, validated, userId, householdId) => {
          const pagination = parsePaginationParams(req.url);
          
          const [data, total] = await Promise.all([
            prisma.transaction.findMany({
              where: buildWhereClause(validated.query, householdId),
              include: { account: true, category: true },
              skip: pagination.skip,
              take: pagination.take,
            }),
            prisma.transaction.count({ where: buildWhereClause(validated.query, householdId) }),
          ]);
          
          const meta = createPaginationMeta(pagination.page, pagination.limit, total);
          return createSuccessResponse(data, { pagination: meta });
        }
      )
    )
  )
);
```

## 📊 Monitoring & Documentation

### Health Check

Visit `/api/health` to monitor system health:
- Database connectivity
- Memory usage
- Disk space
- API response times

### API Documentation

Visit `/api/docs` for interactive API documentation:
- OpenAPI 3.0 specification
- Try out endpoints
- View schemas and examples
- HTML version at `/api/docs?format=html`

## 🛡️ Security Improvements

### Rate Limiting
- Different limits for different endpoint types
- User and IP-based limiting
- Progressive rate limiting

### Input Validation
- Zod schema validation
- XSS protection
- Type safety

### Request Logging
- Security event tracking
- Performance monitoring
- Error tracking

## 🚀 Performance Improvements

### Caching
- In-memory caching with TTL
- Tag-based invalidation
- ETag support

### Database Optimization
- Transaction helpers with retry logic
- Batch operations
- Connection pooling awareness

## 🔧 Configuration

### Environment Variables

Add these to your `.env.local`:

```env
# Cache configuration
CACHE_TTL=300000
CACHE_MAX_SIZE=1000

# Rate limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_HEADERS=false
LOG_BODY=false

# API documentation
API_DOCS_ENABLED=true
```

### Custom Configurations

Create custom configurations for your needs:

```typescript
// Custom rate limit
const customRateLimit = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 10,
  message: 'Custom rate limit exceeded',
};

// Custom cache
const customCache = {
  ttl: 30 * 60 * 1000, // 30 minutes
  tags: ['custom', 'user-specific'],
};

// Custom logging
const customLogging = {
  logLevel: 'debug',
  logHeaders: true,
  excludePaths: ['/health', '/metrics'],
};
```

## 🐛 Troubleshooting

### Double Currency Issue
**Fixed**: The double Rp display issue has been resolved in the transaction update logic. The problem was in the `resignAmount` function which was not properly handling sign changes.

### Common Issues

1. **TypeScript Errors**: Make sure to import types correctly
2. **Cache Not Working**: Check that requests are GET methods
3. **Rate Limiting Too Strict**: Adjust configurations
4. **Validation Failing**: Check Zod schemas match request format

### Debug Mode

Enable debug logging:

```typescript
import { withLogging } from '@/lib/request-logger';

export const GET = withLogging(
  {
    ...LoggingConfigs.development,
    logLevel: 'debug',
    logHeaders: true,
    logBody: true,
  },
  yourHandler
);
```

## 📝 Best Practices

1. **Always use the transaction utilities** for amount handling
2. **Wrap endpoints with validation** to prevent bad data
3. **Add rate limiting** to public endpoints
4. **Use caching** for read-heavy endpoints
5. **Log security events** for monitoring
6. **Use transactions** for multi-step operations
7. **Document your endpoints** using the docs generator
8. **Handle errors consistently** using the response utilities

## 🔄 Next Steps

1. Gradually migrate existing endpoints to use new utilities
2. Add custom configurations for your specific needs
3. Set up monitoring alerts for health checks
4. Configure production logging levels
5. Set up cache invalidation strategies
6. Add comprehensive tests for new utilities

## 📞 Support

If you encounter issues:

1. Check the console logs for detailed error information
2. Visit `/api/health` to check system status
3. Review the API documentation at `/api/docs`
4. Enable debug logging for detailed troubleshooting

All utilities are designed to be backward compatible and can be adopted incrementally without breaking existing functionality.