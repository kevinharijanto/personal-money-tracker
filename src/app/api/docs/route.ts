import { NextResponse } from "next/server";
import { ApiDocsGenerator, zodToOpenApi } from "@/lib/api-docs";
import { createTxnSchemaV2, createCategorySchema, upsertAccountSchema, createHouseholdSchema } from "@/lib/validations";
import { withRateLimit, RateLimitConfigs } from "@/lib/rate-limit";
import { withCache, CacheConfigs } from "@/lib/cache";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


// Register schemas for documentation
const docsGenerator = ApiDocsGenerator.getInstance();

// Register Zod schemas
docsGenerator.registerSchema('TransactionCreate', zodToOpenApi(createTxnSchemaV2));
docsGenerator.registerSchema('CategoryCreate', zodToOpenApi(createCategorySchema));
docsGenerator.registerSchema('AccountCreate', zodToOpenApi(upsertAccountSchema));
docsGenerator.registerSchema('HouseholdCreate', zodToOpenApi(createHouseholdSchema));

// Register API endpoints
docsGenerator.register({
  path: '/api/transactions',
  method: 'GET',
  summary: 'Get transactions',
  description: 'Retrieve transactions for the authenticated user\'s household',
  tags: ['Transactions'],
  parameters: [
    {
      name: 'accountId',
      in: 'query',
      description: 'Filter by account ID',
      type: 'string',
    },
    {
      name: 'categoryId',
      in: 'query',
      description: 'Filter by category ID',
      type: 'string',
    },
    {
      name: 'type',
      in: 'query',
      description: 'Filter by transaction type',
      type: 'string',
      example: 'EXPENSE',
    },
    {
      name: 'dateFrom',
      in: 'query',
      description: 'Filter transactions from this date',
      type: 'string',
      format: 'date-time',
    },
    {
      name: 'dateTo',
      in: 'query',
      description: 'Filter transactions to this date',
      type: 'string',
      format: 'date-time',
    },
    {
      name: 'page',
      in: 'query',
      description: 'Page number for pagination',
      type: 'number',
      example: 1,
    },
    {
      name: 'limit',
      in: 'query',
      description: 'Number of items per page',
      type: 'number',
      example: 20,
    },
  ],
  responses: {
    '200': {
      description: 'Transactions retrieved successfully',
      example: {
        success: true,
        data: [
          {
            id: 'txn_123',
            amount: '-50.00',
            type: 'EXPENSE',
            date: '2023-01-01T00:00:00.000Z',
            description: 'Grocery shopping',
            account: { id: 'acc_123', name: 'Main Account' },
            category: { id: 'cat_123', name: 'Groceries', type: 'EXPENSE' },
          },
        ],
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 100,
            totalPages: 5,
          },
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
    '400': { $ref: '#/components/responses/BadRequest' },
    '401': { $ref: '#/components/responses/Unauthorized' },
    '403': { $ref: '#/components/responses/Forbidden' },
  },
  security: [{ type: 'bearer' }, { type: 'apiKey', in: 'header', name: 'X-Household-ID' }],
});

docsGenerator.register({
  path: '/api/transactions',
  method: 'POST',
  summary: 'Create transaction',
  description: 'Create a new transaction in the household',
  tags: ['Transactions'],
  requestBody: {
    description: 'Transaction data',
    required: true,
    contentType: 'application/json',
    schema: { $ref: '#/components/schemas/TransactionCreate' },
    example: {
      amount: '50.00',
      type: 'EXPENSE',
      accountId: 'acc_123',
      categoryId: 'cat_123',
      description: 'Grocery shopping',
      date: '2023-01-01T00:00:00.000Z',
    },
  },
  responses: {
    '201': {
      description: 'Transaction created successfully',
      example: {
        success: true,
        data: {
          id: 'txn_123',
          amount: '-50.00',
          type: 'EXPENSE',
          date: '2023-01-01T00:00:00.000Z',
          description: 'Grocery shopping',
          accountId: 'acc_123',
          categoryId: 'cat_123'
        },
        meta: {
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
    '400': { $ref: '#/components/responses/BadRequest' },
    '401': { $ref: '#/components/responses/Unauthorized' },
    '403': { $ref: '#/components/responses/Forbidden' },
  },
  security: [{ type: 'bearer' }, { type: 'apiKey', in: 'header', name: 'X-Household-ID' }],
});

docsGenerator.register({
  path: '/api/accounts',
  method: 'GET',
  summary: 'Get accounts',
  description: 'Retrieve accounts for the authenticated user\'s household',
  tags: ['Accounts'],
  parameters: [
    {
      name: 'groupId',
      in: 'query',
      description: 'Filter by account group ID',
      type: 'string',
    },
    {
      name: 'scope',
      in: 'query',
      description: 'Filter by account scope',
      type: 'string',
      example: 'HOUSEHOLD',
    },
    {
      name: 'isArchived',
      in: 'query',
      description: 'Filter by archived status',
      type: 'boolean',
    },
  ],
  responses: {
    '200': {
      description: 'Accounts retrieved successfully',
      example: {
        success: true,
        data: [
          {
            id: 'acc_123',
            name: 'Main Account',
            groupId: 'group_123',
            currency: 'IDR',
            startingBalance: '1000.00',
            isArchived: false,
            scope: 'HOUSEHOLD',
            balance: '950.00',
          },
        ],
        meta: {
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
    '400': { $ref: '#/components/responses/BadRequest' },
    '401': { $ref: '#/components/responses/Unauthorized' },
    '403': { $ref: '#/components/responses/Forbidden' },
  },
  security: [{ type: 'bearer' }, { type: 'apiKey', in: 'header', name: 'X-Household-ID' }],
});

docsGenerator.register({
  path: '/api/accounts',
  method: 'POST',
  summary: 'Create account',
  description: 'Create a new account in the household',
  tags: ['Accounts'],
  requestBody: {
    description: 'Account data',
    required: true,
    contentType: 'application/json',
    schema: { $ref: '#/components/schemas/AccountCreate' },
    example: {
      name: 'Savings Account',
      groupId: 'group_123',
      currency: 'IDR',
      startingBalance: '5000.00',
      scope: 'HOUSEHOLD',
    },
  },
  responses: {
    '201': {
      description: 'Account created successfully',
      example: {
        success: true,
        data: {
          id: 'acc_456',
          name: 'Savings Account',
          groupId: 'group_123',
          currency: 'IDR',
          startingBalance: '5000.00',
          isArchived: false,
          scope: 'HOUSEHOLD',
          createdById: 'user_123',
        },
        meta: {
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
    '400': { $ref: '#/components/responses/BadRequest' },
    '401': { $ref: '#/components/responses/Unauthorized' },
    '403': { $ref: '#/components/responses/Forbidden' },
  },
  security: [{ type: 'bearer' }, { type: 'apiKey', in: 'header', name: 'X-Household-ID' }],
});

docsGenerator.register({
  path: '/api/categories',
  method: 'GET',
  summary: 'Get categories',
  description: 'Retrieve categories for the authenticated user\'s household',
  tags: ['Categories'],
  parameters: [
    {
      name: 'type',
      in: 'query',
      description: 'Filter by category type',
      type: 'string',
      example: 'EXPENSE',
    },
  ],
  responses: {
    '200': {
      description: 'Categories retrieved successfully',
      example: {
        success: true,
        data: [
          {
            id: 'cat_123',
            name: 'Groceries',
            type: 'EXPENSE',
            householdId: 'household_123',
          },
        ],
        meta: {
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
    '400': { $ref: '#/components/responses/BadRequest' },
    '401': { $ref: '#/components/responses/Unauthorized' },
    '403': { $ref: '#/components/responses/Forbidden' },
  },
  security: [{ type: 'bearer' }, { type: 'apiKey', in: 'header', name: 'X-Household-ID' }],
});

docsGenerator.register({
  path: '/api/categories',
  method: 'POST',
  summary: 'Create category',
  description: 'Create a new category in the household',
  tags: ['Categories'],
  requestBody: {
    description: 'Category data',
    required: true,
    contentType: 'application/json',
    schema: { $ref: '#/components/schemas/CategoryCreate' },
    example: {
      name: 'Entertainment',
      type: 'EXPENSE',
    },
  },
  responses: {
    '201': {
      description: 'Category created successfully',
      example: {
        success: true,
        data: {
          id: 'cat_456',
          name: 'Entertainment',
          type: 'EXPENSE',
          householdId: 'household_123',
        },
        meta: {
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
    '400': { $ref: '#/components/responses/BadRequest' },
    '401': { $ref: '#/components/responses/Unauthorized' },
    '403': { $ref: '#/components/responses/Forbidden' },
    '409': {
      description: 'Category name already exists in this household',
      example: {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Category name already exists in this household',
        },
        meta: {
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
  },
  security: [{ type: 'bearer' }, { type: 'apiKey', in: 'header', name: 'X-Household-ID' }],
});

docsGenerator.register({
  path: '/api/households',
  method: 'GET',
  summary: 'Get households',
  description: 'Retrieve households for the authenticated user',
  tags: ['Households'],
  responses: {
    '200': {
      description: 'Households retrieved successfully',
      example: {
        success: true,
        data: [
          {
            id: 'household_123',
            name: 'Family Household',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
    '401': { $ref: '#/components/responses/Unauthorized' },
  },
  security: [{ type: 'bearer' }],
});

docsGenerator.register({
  path: '/api/households',
  method: 'POST',
  summary: 'Create household',
  description: 'Create a new household',
  tags: ['Households'],
  requestBody: {
    description: 'Household data',
    required: true,
    contentType: 'application/json',
    schema: { $ref: '#/components/schemas/HouseholdCreate' },
    example: {
      name: 'My Household',
    },
  },
  responses: {
    '201': {
      description: 'Household created successfully',
      example: {
        success: true,
        data: {
          id: 'household_456',
          name: 'My Household',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        meta: {
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
    '400': { $ref: '#/components/responses/BadRequest' },
    '401': { $ref: '#/components/responses/Unauthorized' },
  },
  security: [{ type: 'bearer' }],
});

docsGenerator.register({
  path: '/api/health',
  method: 'GET',
  summary: 'Health check',
  description: 'Check the health status of the API and its dependencies',
  tags: ['System'],
  responses: {
    '200': {
      description: 'System is healthy',
      example: {
        success: true,
        data: {
          status: 'healthy',
          timestamp: '2023-01-01T00:00:00.000Z',
          uptime: 3600,
          version: '1.0.0',
          environment: 'production',
          checks: {
            database: { status: 'pass', duration: 50 },
            memory: { status: 'pass' },
            disk: { status: 'pass' },
            api: { status: 'pass', duration: 10 },
          },
        },
        meta: {
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
    '503': {
      description: 'System is unhealthy',
      example: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Health check failed',
        },
        meta: {
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      },
    },
  },
});

/**
 * API documentation endpoint
 */
export const GET = withRateLimit(
  RateLimitConfigs.read,
  withCache(CacheConfigs.long, async (req: Request): Promise<NextResponse> => {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';
    
    if (format === 'html') {
      const html = docsGenerator.generateHtml();
      
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }
    
    const docs = docsGenerator.generateOpenApi();
    
    return NextResponse.json(docs, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  })
);

/**
 * API documentation endpoint with POST for format selection
 */
export const POST = withRateLimit(
  RateLimitConfigs.read,
  async (req: Request): Promise<NextResponse> => {
    const body = await req.json().catch(() => ({}));
    const format = body.format || 'json';
    
    if (format === 'html') {
      const html = docsGenerator.generateHtml();
      
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }
    
    const docs = docsGenerator.generateOpenApi();
    
    return NextResponse.json(docs, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
);