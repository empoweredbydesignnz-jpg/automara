// backend/src/server.js
// Main Express server with comprehensive multi-tenant architecture

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const supertokens = require('supertokens-node');
const Session = require('supertokens-node/recipe/session');
const EmailPassword = require('supertokens-node/recipe/emailpassword');
const ThirdParty = require('supertokens-node/recipe/thirdparty');
const MultiFactorAuth = require('supertokens-node/recipe/multifactorauth');
const { middleware, errorHandler } = require('supertokens-node/framework/express');
const swaggerUi = require('swagger-ui-express');
const { Pool } = require('pg');
const crypto = require('crypto');

// Import routes
const tenantRoutes = require('./routes/tenants');
const workflowRoutes = require('./routes/workflows');
const apiKeyRoutes = require('./routes/apiKeys');
const webhookRoutes = require('./routes/webhooks');
const stripeRoutes = require('./routes/stripe');
const m365Routes = require('./routes/m365');

// Import middleware
const { tenantMiddleware } = require('./middleware/tenant');
const { auditLogger } = require('./middleware/audit');

// Import services
const { initializeN8N } = require('./services/n8n');
const swaggerSpec = require('./config/swagger');

const app = express();
const PORT = process.env.PORT || 4000;

// Database connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Make pool available globally
global.db = pool;

// Initialize SuperTokens
supertokens.init({
    framework: 'express',
    supertokens: {
        connectionURI: process.env.SUPERTOKENS_CONNECTION_URI,
        apiKey: process.env.SUPERTOKENS_API_KEY,
    },
    appInfo: {
        appName: 'Automara',
        apiDomain: process.env.API_DOMAIN,
        websiteDomain: process.env.FRONTEND_URL,
        apiBasePath: '/auth',
        websiteBasePath: '/auth',
    },
    recipeList: [
        EmailPassword.init({
            signUpFeature: {
                formFields: [
                    { id: 'email' },
                    { id: 'password' },
                    { id: 'tenantId', optional: true },
                ],
            },
        }),
        ThirdParty.init({
            signInAndUpFeature: {
                providers: [
                    // Can add Google, Microsoft SSO later
                ],
            },
        }),
        MultiFactorAuth.init({
            firstFactors: ['emailpassword'],
        }),
        Session.init({
            jwt: {
                enable: true,
            },
            override: {
                functions: (originalImplementation) => ({
                    ...originalImplementation,
                    createNewSession: async function (input) {
                        // Add tenant_id to JWT payload
                        const tenantId = input.userContext?.tenantId;
                        input.accessTokenPayload = {
                            ...input.accessTokenPayload,
                            tenantId,
                        };
                        return originalImplementation.createNewSession(input);
                    },
                }),
            },
        }),
    ],
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));

// CORS configuration
app.use(cors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'rid', 'fdi-version', 'anti-csrf'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// SuperTokens middleware
app.use(middleware());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'Automara API',
    });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Automara API Documentation',
}));

// Routes with tenant middleware
app.use('/api/tenants', tenantRoutes);
app.use('/api/workflows', tenantMiddleware, auditLogger, workflowRoutes);
app.use('/api/keys', tenantMiddleware, auditLogger, apiKeyRoutes);
app.use('/api/m365', tenantMiddleware, auditLogger, m365Routes);
app.use('/api/stripe', stripeRoutes);

// Webhook routes (no auth required, but signature verification)
app.use('/webhooks', webhookRoutes);

// SuperTokens error handler
app.use(errorHandler());

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Don't expose internal errors in production
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : err.message;
    
    res.status(statusCode).json({
        error: {
            message,
            ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
        },
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP server');
    await pool.end();
    process.exit(0);
});

// Start server
const server = app.listen(PORT, async () => {
    console.log(`🚀 Automara API running on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    
    try {
        // Test database connection
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        client.release();
        
        // Initialize N8N connection
        await initializeN8N();
        console.log('✅ N8N service initialized');
    } catch (err) {
        console.error('❌ Startup error:', err);
    }
});

module.exports = { app, server };

