// backend/src/config/swagger.js
// OpenAPI/Swagger configuration for API documentation

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Automara API',
            version: '1.0.0',
            description: 'Multi-tenant SaaS platform for MSP workflow automation',
            contact: {
                name: 'Empowered by Design',
                url: 'https://empoweredbydesign.co.nz',
                email: 'support@empoweredbydesign.co.nz',
            },
            license: {
                name: 'Proprietary',
            },
        },
        servers: [
            {
                url: process.env.API_DOMAIN || 'http://localhost:4000',
                description: 'API Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtained from SuperTokens authentication',
                },
                tenantId: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-Tenant-ID',
                    description: 'Tenant UUID for multi-tenant isolation',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                        },
                        details: {
                            type: 'string',
                            description: 'Additional error details',
                        },
                    },
                },
                Tenant: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        name: {
                            type: 'string',
                        },
                        subdomain: {
                            type: 'string',
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'active', 'suspended', 'canceled'],
                        },
                        subscription_status: {
                            type: 'string',
                            enum: ['active', 'past_due', 'canceled', 'incomplete'],
                        },
                        subscription_plan: {
                            type: 'string',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                Workflow: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        n8n_workflow_id: {
                            type: 'string',
                        },
                        workflow_type: {
                            type: 'string',
                            enum: ['m365_onboarding', 'm365_offboarding', 'm365_conditional_access'],
                        },
                        name: {
                            type: 'string',
                        },
                        description: {
                            type: 'string',
                        },
                        webhook_url: {
                            type: 'string',
                            format: 'uri',
                        },
                        is_active: {
                            type: 'boolean',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        last_executed: {
                            type: 'string',
                            format: 'date-time',
                        },
                        execution_count: {
                            type: 'integer',
                        },
                    },
                },
                APIKey: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        service_name: {
                            type: 'string',
                        },
                        key_name: {
                            type: 'string',
                        },
                        is_active: {
                            type: 'boolean',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        last_used: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                WorkflowExecution: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        workflow_id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        n8n_execution_id: {
                            type: 'string',
                        },
                        status: {
                            type: 'string',
                            enum: ['running', 'success', 'error', 'waiting'],
                        },
                        started_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        finished_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        error_message: {
                            type: 'string',
                        },
                    },
                },
            },
            responses: {
                UnauthorizedError: {
                    description: 'Authentication required',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                ForbiddenError: {
                    description: 'Insufficient permissions',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                NotFoundError: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                ValidationError: {
                    description: 'Invalid request parameters',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
                tenantId: [],
            },
        ],
        tags: [
            {
                name: 'Tenants',
                description: 'Tenant management and registration',
            },
            {
                name: 'Workflows',
                description: 'Workflow automation and execution',
            },
            {
                name: 'API Keys',
                description: 'API key management',
            },
            {
                name: 'Webhooks',
                description: 'Webhook endpoints for workflow triggers',
            },
            {
                name: 'M365',
                description: 'Microsoft 365 integration endpoints',
            },
        ],
    },
    apis: ['./src/routes/*.js', './src/server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;


// backend/package.json
{
  "name": "automara-backend",
  "version": "1.0.0",
  "description": "Automara Multi-Tenant SaaS Backend API",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --coverage"
  },
  "keywords": ["automation", "msp", "multi-tenant", "saas"],
  "author": "Empowered by Design",
  "license": "PROPRIETARY",
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "supertokens-node": "^17.0.0",
    "stripe": "^14.9.0",
    "axios": "^1.6.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "express-rate-limit": "^7.1.5",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}


// backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/server.js"]


// backend/.dockerignore
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
.DS_Store
coverage
.vscode
