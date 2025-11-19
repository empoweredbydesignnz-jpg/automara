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
const { middleware, errorHandler } = require('supertokens-node/framework/express');
const swaggerUi = require('swagger-ui-express');
const { Pool } = require('pg');
const axios = require('axios');
const crypto = require('crypto');
const userRoutes = require('./routes/users');

app.use('/api/users', userRoutes);

// Import routes
const tenantRoutes = require('./routes/tenants');
const workflowRoutes = require('./routes/workflows');
const workflowActivationRoutes = require('./routes/workflow-activation');
const webhookRoutes = require('./routes/webhooks');

// Import middleware
const { tenantMiddleware } = require('./middleware/tenant');
const { auditLogger } = require('./middleware/audit');

// Import services
const { initializeN8N } = require('./services/n8n');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize SuperTokens
supertokens.init({
  framework: 'express',
  supertokens: {
    connectionURI: process.env.SUPERTOKENS_URI || 'http://localhost:3567',
    apiKey: process.env.SUPERTOKENS_API_KEY,
  },
  appInfo: {
    appName: 'Automara',
    apiDomain: process.env.API_DOMAIN || 'http://localhost:4000',
    websiteDomain: process.env.WEBSITE_DOMAIN || 'http://localhost:3000',
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
          // add providers later
        ],
      },
    }),
    Session.init({
      jwt: {
        enable: true,
      },
      override: {
        functions: (originalImplementation) => ({
          ...originalImplementation,
          createNewSession: async function (input) {
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

// Database connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'automara',
    user: process.env.DB_USER || 'automara',
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
}); 

// Make pool available globally
global.db = pool;

// Middleware to filter by role
const filterTenantsByRole = (req, res, next) => {
  console.log('=== MIDDLEWARE DEBUG ===');
  console.log('Headers received:', req.headers);
  console.log('x-user-role:', req.headers['x-user-role']);
  
  req.userRole = req.headers['x-user-role'] || 'client_user';
  req.tenantId = req.headers['x-tenant-id'];
  
  console.log('Set req.userRole to:', req.userRole);
  console.log('Set req.tenantId to:', req.tenantId);
  console.log('=== END MIDDLEWARE ===');
  next();
};

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
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-User-Role', 'rid', 'fdi-version', 'anti-csrf'],
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
app.use('/auth', middleware());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'Automara API',
    });
});

// API Documentation
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
//    customCss: '.swagger-ui .topbar { display: none }',
//    customSiteTitle: 'Automara API Documentation',
//}));

// DEBUG ONLY
app.get('/debug/workflows-test', (req, res) => {
    res.json({ ok: true, ts: Date.now() });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password, tenantDomain } = req.body;
  
  try {
    // Check if admin login
    if (email === 'admin@automara.com' && password === 'admin123') {
      // Check if admin user exists in DB
      let adminUser = await pool.query(
        'SELECT id, email, first_name, last_name, role FROM users WHERE email = $1',
        [email]
      );
      
      // If not exists, create the admin user
      if (adminUser.rows.length === 0) {
        adminUser = await pool.query(
          'INSERT INTO users (email, first_name, last_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, role',
          [email, 'Admin', 'User', 'global_admin']
        );
      }
      
      return res.json({
        success: true,
        user: adminUser.rows[0],
        isAdmin: true,
        tenant: null
      });
    }
    
    // Regular client login - check tenant exists and is active
    const tenantResult = await pool.query(
      'SELECT * FROM client_tenants WHERE domain = $1',
      [tenantDomain]
    );
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tenant not found' 
      });
    }
    
    const tenant = tenantResult.rows[0];
    
    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        suspended: true,
        error: 'This account has been suspended. Please contact support.'
      });
    }
    
    // Check if user exists for this tenant
    const userResult = await pool.query(
      'SELECT id, email, first_name, last_name, role, tenant_id FROM users WHERE email = $1 AND tenant_id = $2',
      [email, tenant.id]
    );
    
    let user;
    if (userResult.rows.length === 0) {
      // Auto-create user for this tenant (for now)
      const newUser = await pool.query(
        'INSERT INTO users (email, first_name, last_name, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role, tenant_id',
        [email, email.split('@')[0], '', 'client_user', tenant.id]
      );
      user = newUser.rows[0];
    } else {
      user = userResult.rows[0];
    }
    
    res.json({
      success: true,
      user: user,
      isAdmin: false,
      tenant: tenant
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API Routes

// Get all roles
app.get('/api/roles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles ORDER BY id');
    res.json({ roles: result.rows });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users (admin only)
app.get('/api/users', filterTenantsByRole, async (req, res) => {
  const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
  
  if (effectiveRole !== 'global_admin' && effectiveRole !== 'client_admin' && effectiveRole !== 'msp_admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    let query;
    let params = [];
    
    if (effectiveRole === 'global_admin') {
  query = `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.tenant_id, u.status, t.name as tenant_name
    FROM users u
    LEFT JOIN client_tenants t ON u.tenant_id = t.id
    ORDER BY u.created_at DESC
  `;
} else if (effectiveRole === 'msp_admin') {
  if (!req.tenantId) return res.status(403).json({ error: 'Access denied - no tenant ID' });

  query = `
    WITH RECURSIVE sub_tenants AS (
      SELECT id FROM client_tenants WHERE id = $1
      UNION ALL
      SELECT ct.id FROM client_tenants ct
      INNER JOIN sub_tenants st ON ct.parent_tenant_id = st.id
    )
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.tenant_id, u.status, t.name as tenant_name
    FROM users u
    JOIN sub_tenants st ON u.tenant_id = st.id
    LEFT JOIN client_tenants t ON u.tenant_id = t.id
    ORDER BY u.created_at DESC
  `;
  params = [req.tenantId];
} else if (effectiveRole === 'client_admin') {
  query = `
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.tenant_id, u.status, t.name as tenant_name
    FROM users u
    LEFT JOIN client_tenants t ON u.tenant_id = t.id
    WHERE u.tenant_id = $1
    ORDER BY u.created_at DESC
  `;
  params = [req.tenantId];
}

    
    const result = await pool.query(query, params);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user role (admin only)
app.patch('/api/users/:id/role', filterTenantsByRole, async (req, res) => {
  const effectiveRole = req.userRole === 'admin' ? 'global_admin': req.userRole;
  const { id } = req.params;
  const { role } = req.body;
  
  // Only global_admin and client_admin can change roles
  if (effectiveRole !== 'global_admin' && effectiveRole !== 'client_admin' && effectiveRole !== 'msp_admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Client admins can't assign global_admin role
  if (effectiveRole === 'client_admin' && role === 'global_admin') {
    return res.status(403).json({ error: 'Cannot assign global admin role' });
  }
  
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [role, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE user endpoint
app.delete('/api/users/:id', filterTenantsByRole, async (req, res) => {
  const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
  const { id } = req.params;
  
  // Only global admins can delete users
  if (effectiveRole !== 'global_admin') {
    return res.status(403).json({ error: 'Access denied - insufficient permissions' });
  }
  
  try {
    // Check if user exists
    const existingUser = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user (this will cascade to related records)
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create user endpoint
app.post('/api/users', filterTenantsByRole, async (req, res) => {
  const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
  const { client_name, first_name, last_name, email, role } = req.body;
  
  // Only global admins can create users
  if (effectiveRole !== 'global_admin') {
    return res.status(403).json({ error: 'Access denied - insufficient permissions' });
  }
  
  try {
    // Validate required fields
    if (!client_name || !first_name || !last_name || !email || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate email format
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Check if role exists
    const roleResult = await pool.query('SELECT * FROM roles WHERE name = $1', [role]);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Create user without tenant association for now
    const result = await pool.query(
      `INSERT INTO users (email, first_name, last_name, role, status, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW()) 
       RETURNING *`,
      [email, first_name, last_name, role]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'User created successfully',
      user: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Routes
app.use('/api/tenants', tenantRoutes);
app.use('/api/workflows', workflowRoutes);

// Webhook routes (no auth required, but signature verification)
app.use('/webhooks', webhookRoutes);

// IMPORTANT: This catches all /api/* routes, so must be LAST
// app.use('/api', workflowActivationRoutes);

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