import { NextResponse } from "next/server";
import { z } from "zod";

export interface ApiEndpoint {
  path: string;
  method: string;
  description?: string;
  summary?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
  security?: Security[];
  deprecated?: boolean;
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  type: string;
  schema?: any;
  example?: any;
  format?: string;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  contentType?: string;
  schema?: any;
  example?: any;
}

export interface Response {
  description?: string;
  contentType?: string;
  schema?: any;
  example?: any;
  $ref?: string;
}

export interface Security {
  type: 'apiKey' | 'bearer' | 'oauth2';
  description?: string;
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  bearerAuth?: any[];
  householdAuth?: any[];
}

export interface ApiDocumentation {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, Record<string, ApiEndpoint>>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, Security>;
    responses?: Record<string, Response>;
    parameters?: Record<string, Parameter>;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

/**
 * API Documentation Generator
 */
export class ApiDocsGenerator {
  private static instance: ApiDocsGenerator;
  private endpoints: ApiEndpoint[] = [];
  private schemas: Record<string, any> = {};

  static getInstance(): ApiDocsGenerator {
    if (!ApiDocsGenerator.instance) {
      ApiDocsGenerator.instance = new ApiDocsGenerator();
    }
    return ApiDocsGenerator.instance;
  }

  /**
   * Register an API endpoint
   */
  register(endpoint: ApiEndpoint): void {
    this.endpoints.push(endpoint);
  }

  /**
   * Register a schema
   */
  registerSchema(name: string, schema: any): void {
    this.schemas[name] = schema;
  }

  /**
   * Generate OpenAPI documentation
   */
  generateOpenApi(): ApiDocumentation {
    const paths: Record<string, Record<string, ApiEndpoint>> = {};

    // Group endpoints by path and method
    this.endpoints.forEach(endpoint => {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }
      paths[endpoint.path][endpoint.method.toLowerCase()] = endpoint;
    });

    return {
      openapi: '3.0.0',
      info: {
        title: 'Personal Money Tracker API',
        description: 'API for managing personal finances, transactions, accounts, and households',
        version: process.env.npm_package_version || '1.0.0',
        contact: {
          name: 'API Support',
          email: 'support@example.com',
        },
      },
      servers: [
        {
          url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777',
          description: 'Development server',
        },
      ],
      paths,
      components: {
        schemas: this.schemas,
        securitySchemes: {
          bearerAuth: {
            type: 'bearer',
            description: 'JWT token or session token',
          },
          householdAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Household-ID',
            description: 'Household ID for multi-tenant access',
          },
        },
        responses: {
          BadRequest: {
            description: 'Bad request - validation error',
            contentType: 'application/json',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    details: { type: 'object' },
                  },
                },
              },
            },
          },
          Unauthorized: {
            description: 'Unauthorized - authentication required',
            contentType: 'application/json',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'UNAUTHORIZED' },
                    message: { type: 'string', example: 'Authentication required' },
                  },
                },
              },
            },
          },
          Forbidden: {
            description: 'Forbidden - insufficient permissions',
            contentType: 'application/json',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'FORBIDDEN' },
                    message: { type: 'string', example: 'Insufficient permissions' },
                  },
                },
              },
            },
          },
          NotFound: {
            description: 'Resource not found',
            contentType: 'application/json',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'NOT_FOUND' },
                    message: { type: 'string', example: 'Resource not found' },
                  },
                },
              },
            },
          },
        },
      },
      tags: [
        {
          name: 'Authentication',
          description: 'Authentication and authorization endpoints',
        },
        {
          name: 'Households',
          description: 'Household management endpoints',
        },
        {
          name: 'Accounts',
          description: 'Account and account group management',
        },
        {
          name: 'Transactions',
          description: 'Transaction management endpoints',
        },
        {
          name: 'Categories',
          description: 'Category management endpoints',
        },
        {
          name: 'Transfers',
          description: 'Money transfer endpoints',
        },
        {
          name: 'Invitations',
          description: 'Household invitation management',
        },
      ],
    };
  }

  /**
   * Generate HTML documentation page
   */
  generateHtml(): string {
    const docs = this.generateOpenApi();
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${docs.info.title} - API Documentation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { border-bottom: 2px solid #e1e5e9; padding-bottom: 20px; margin-bottom: 30px; }
        .endpoint { border: 1px solid #e1e5e9; border-radius: 6px; margin-bottom: 20px; overflow: hidden; }
        .endpoint-header { padding: 15px; border-bottom: 1px solid #e1e5e9; background: #f8f9fa; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 3px; color: white; font-weight: bold; margin-right: 10px; }
        .get { background: #28a745; }
        .post { background: #007bff; }
        .put { background: #ffc107; color: #000; }
        .delete { background: #dc3545; }
        .path { font-family: monospace; font-weight: bold; }
        .endpoint-body { padding: 15px; }
        .description { margin-bottom: 15px; }
        .parameters, .responses { margin-bottom: 15px; }
        .parameter, .response { margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .param-name { font-weight: bold; font-family: monospace; }
        .param-type { color: #6c757d; font-size: 0.9em; }
        .code { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; overflow-x: auto; }
        .json { background: #282c34; color: #abb2bf; padding: 15px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${docs.info.title}</h1>
            <p>${docs.info.description}</p>
            <p><strong>Version:</strong> ${docs.info.version}</p>
        </div>
        
        <h2>Authentication</h2>
        <p>This API uses two authentication methods:</p>
        <ul>
            <li><strong>Bearer Token:</strong> Include in Authorization header: <code>Authorization: Bearer <token></code></li>
            <li><strong>Household ID:</strong> Include in X-Household-ID header for multi-tenant access: <code>X-Household-ID: <household-id></code></li>
        </ul>
        
        <h2>Endpoints</h2>
        ${Object.entries(docs.paths).map(([path, methods]) => `
            <div class="endpoint">
                ${Object.entries(methods).map(([method, endpoint]) => `
                    <div class="endpoint-header">
                        <span class="method ${method}">${method.toUpperCase()}</span>
                        <span class="path">${path}</span>
                        ${endpoint.deprecated ? '<span style="color: #dc3545; margin-left: 10px;">DEPRECATED</span>' : ''}
                    </div>
                    <div class="endpoint-body">
                        ${endpoint.summary ? `<h3>${endpoint.summary}</h3>` : ''}
                        ${endpoint.description ? `<p class="description">${endpoint.description}</p>` : ''}
                        
                        ${endpoint.tags && endpoint.tags.length > 0 ? `
                            <p><strong>Tags:</strong> ${endpoint.tags.join(', ')}</p>
                        ` : ''}
                        
                        ${endpoint.security && endpoint.security.length > 0 ? `
                            <p><strong>Security:</strong> ${endpoint.security.map(s => s.type).join(', ')}</p>
                        ` : ''}
                        
                        ${endpoint.parameters && endpoint.parameters.length > 0 ? `
                            <div class="parameters">
                                <h4>Parameters</h4>
                                ${endpoint.parameters.map(param => `
                                    <div class="parameter">
                                        <span class="param-name">${param.name}</span>
                                        <span class="param-type">${param.in} ${param.type}${param.required ? ' (required)' : ''}</span>
                                        ${param.description ? `<p>${param.description}</p>` : ''}
                                        ${param.example ? `<p><strong>Example:</strong> <code>${JSON.stringify(param.example)}</code></p>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        
                        ${endpoint.requestBody ? `
                            <div class="request-body">
                                <h4>Request Body</h4>
                                ${endpoint.requestBody.description ? `<p>${endpoint.requestBody.description}</p>` : ''}
                                ${endpoint.requestBody.example ? `
                                    <div class="json">
                                        <pre>${JSON.stringify(endpoint.requestBody.example, null, 2)}</pre>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                        
                        ${endpoint.responses ? `
                            <div class="responses">
                                <h4>Responses</h4>
                                ${Object.entries(endpoint.responses).map(([code, response]) => `
                                    <div class="response">
                                        <strong>${code}</strong> ${response.description ? `- ${response.description}` : ''}
                                        ${response.example ? `
                                            <div class="json">
                                                <pre>${JSON.stringify(response.example, null, 2)}</pre>
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }

  /**
   * Clear all registered endpoints and schemas
   */
  clear(): void {
    this.endpoints = [];
    this.schemas = {};
  }

  /**
   * Get all registered endpoints
   */
  getEndpoints(): ApiEndpoint[] {
    return [...this.endpoints];
  }

  /**
   * Get all registered schemas
   */
  getSchemas(): Record<string, any> {
    return { ...this.schemas };
  }
}

/**
 * Decorator for documenting API endpoints
 */
export function DocumentApi(endpoint: Partial<ApiEndpoint>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    // Store endpoint metadata
    const fullEndpoint: ApiEndpoint = {
      path: endpoint.path || '',
      method: endpoint.method || 'GET',
      description: endpoint.description,
      summary: endpoint.summary,
      tags: endpoint.tags,
      parameters: endpoint.parameters,
      requestBody: endpoint.requestBody,
      responses: endpoint.responses,
      security: endpoint.security,
      deprecated: endpoint.deprecated,
    };
    
    // Register with documentation generator
    ApiDocsGenerator.getInstance().register(fullEndpoint);
    
    return descriptor;
  };
}

/**
 * Convert Zod schema to OpenAPI schema
 */
export function zodToOpenApi(schema: z.ZodSchema): any {
  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }
  
  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }
  
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  
  if (schema instanceof z.ZodDate) {
    return { type: 'string', format: 'date-time' };
  }
  
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToOpenApi(schema._def.type as unknown as z.ZodSchema),
    };
  }
  
  if (schema instanceof z.ZodObject) {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    Object.entries(schema.shape).forEach(([key, value]) => {
      properties[key] = zodToOpenApi(value as z.ZodSchema);
      if (!(value as any).isOptional()) {
        required.push(key);
      }
    });
    
    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
  
  if (schema instanceof z.ZodUnion) {
    return {
      anyOf: (schema as any)._def.options.map((opt: z.ZodSchema) => zodToOpenApi(opt)),
    };
  }
  
  if (schema instanceof z.ZodOptional) {
    return zodToOpenApi((schema as any)._def.innerType);
  }
  
  if (schema instanceof z.ZodDefault) {
    return zodToOpenApi((schema as any)._def.innerType);
  }
  
  return { type: 'unknown' };
}

/**
 * API documentation endpoint
 */
export const GET = async (): Promise<NextResponse> => {
  const generator = ApiDocsGenerator.getInstance();
  const docs = generator.generateOpenApi();
  
  return NextResponse.json(docs, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

/**
 * HTML documentation endpoint
 */
export const POST = async (req: Request): Promise<NextResponse> => {
  const body = await req.json().catch(() => ({}));
  const format = body.format || 'json';
  
  const generator = ApiDocsGenerator.getInstance();
  
  if (format === 'html') {
    const html = generator.generateHtml();
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
  
  const docs = generator.generateOpenApi();
  
  return NextResponse.json(docs, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
