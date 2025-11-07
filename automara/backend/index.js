require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4000;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'automara',
  user: process.env.DB_USER || 'automara',
  password: process.env.DB_PASSWORD
});

// Middleware - MUST be before routes
app.use(cors());
app.use(express.json());

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test database connection
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'connected', 
      timestamp: result.rows[0].now 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ 
    service: 'Automara Backend',
    version: '1.0.0',
    status: 'running'
  });
});

// Tenants endpoint - hierarchical
app.get('/api/tenants', filterTenantsByRole, async (req, res) => {
  console.log('=== TENANTS API DEBUG ===');
  console.log('req.userRole:', req.userRole);
  console.log('req.tenantId:', req.tenantId);

  try {
    let query;
    let params = [];

    // Map roles
    const effectiveRole =
      req.userRole === 'admin'
        ? 'global_admin'
        : req.userRole === 'msp_admin'
        ? 'msp_admin'
        : req.userRole;

    if (effectiveRole === 'global_admin') {
      // Global admin sees ALL tenants
      query = 'SELECT * FROM client_tenants ORDER BY parent_tenant_id NULLS FIRST, created_at DESC';
      console.log('Global admin query:', query);
    } else if (effectiveRole === 'client_admin' || effectiveRole === 'msp_admin') {
      if (!req.tenantId) {
        return res.status(403).json({ error: 'Access denied - no tenant ID' });
      }

      // Client admin or MSP admin sees their own tenant and sub-tenants
      query = `
        SELECT * FROM client_tenants
        WHERE id = $1 OR parent_tenant_id = $1
        ORDER BY parent_tenant_id NULLS FIRST, created_at DESC
      `;
      params = [req.tenantId];
      console.log('Client/MSP admin query:', query, 'params:', params);
    } else {
      // Regular client sees only their own tenant
      if (!req.tenantId) {
        return res.status(403).json({ error: 'Access denied - no tenant ID' });
      }
      query = 'SELECT * FROM client_tenants WHERE id = $1';
      params = [req.tenantId];
      console.log('Client user query:', query, 'params:', params);
    }

    console.log('Executing query...');
    const result = await pool.query(query, params);
    console.log('Query result rows:', result.rows.length);
    console.log('Tenants:', result.rows);

    res.json({ tenants: result.rows });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});


// Create sub-tenant (for MSP tenants)
app.post('/api/tenants/:parentId/sub-tenants', filterTenantsByRole, async (req, res) => {
  const { parentId } = req.params;
  const { name, domain, owner_email } = req.body;
  const effectiveRole =
  req.userRole === 'admin' ? 'global_admin' :
  req.userRole === 'msp_admin' ? 'msp_admin' :
  req.userRole;

  
  // Only client_admin or msp_admin of the parent tenant, or global_admin, can create sub-tenants
if (
  effectiveRole !== 'global_admin' &&
  (effectiveRole !== 'client_admin' && effectiveRole !== 'msp_admin' || req.tenantId != parentId)
) {
  return res.status(403).json({ error: 'Access denied' });
}

  
  try {
    // Verify parent tenant exists and is MSP type
    const parentCheck = await pool.query(
      'SELECT id, tenant_type FROM client_tenants WHERE id = $1',
      [parentId]
    );
    
    if (parentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Parent tenant not found' });
    }
    
    if (parentCheck.rows[0].tenant_type !== 'msp') {
      return res.status(400).json({ error: 'Parent tenant must be MSP type to create sub-tenants' });
    }
    
    const result = await pool.query(
      `INSERT INTO client_tenants (name, domain, owner_email, status, parent_tenant_id, tenant_type, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [name, domain, owner_email, 'active', parentId, 'sub_tenant']
    );
    
    res.status(201).json({ 
      success: true,
      tenant: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creating sub-tenant:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Update tenant type (global admin only)
app.patch('/api/tenants/:id/type', filterTenantsByRole, async (req, res) => {
  const { id } = req.params;
  const { tenant_type } = req.body;
  const effectiveRole =
  req.userRole === 'admin' ? 'global_admin' :
  req.userRole === 'msp_admin' ? 'msp_admin' :
  req.userRole;

  
  if (effectiveRole !== 'global_admin') {
    return res.status(403).json({ error: 'Only global admin can change tenant type' });
  }
  
  try {
    const result = await pool.query(
      'UPDATE client_tenants SET tenant_type = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [tenant_type, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json({ success: true, tenant: result.rows[0] });
  } catch (error) {
    console.error('Error updating tenant type:', error);
    res.status(500).json({ error: error.message });
  }
});

/// Create tenant endpoint (for signup)
app.post('/api/tenants', filterTenantsByRole, async (req, res) => {
  const { name, domain, owner_email, owner_first_name, owner_last_name, tenant_type } = req.body;
  
  try {
    // Default to 'client' if not specified
    const finalTenantType = tenant_type || 'client';
    
    // Create tenant in database
    const result = await pool.query(
      'INSERT INTO client_tenants (name, domain, owner_email, status, tenant_type, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [name, domain, owner_email, 'active', finalTenantType]
    );
    
    const newTenant = result.rows[0];
    
    // Determine role based on tenant type
    const userRole = finalTenantType === 'msp' ? 'msp_admin' : 'client_admin';
    
    // Create owner user with appropriate role
    const userResult = await pool.query(
      'INSERT INTO users (email, first_name, last_name, role, tenant_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
      [owner_email, owner_first_name || owner_email.split('@')[0], owner_last_name || '', userRole, newTenant.id, 'active']
    );
    
    console.log(`Created ${userRole} user for tenant:`, newTenant.id);
    
    // Send to n8n webhook
    try {
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://n8n:5678/webhook/tenant-signup';
      
      await axios.post(n8nWebhookUrl, {
        tenant: {
          id: newTenant.id,
          name: newTenant.name,
          domain: newTenant.domain,
          owner_email: newTenant.owner_email,
          tenant_type: newTenant.tenant_type
        },
        owner: {
          email: owner_email,
          first_name: owner_first_name || owner_email.split('@')[0],
          last_name: owner_last_name || '',
          role: userRole
        }
      }, {
        timeout: 5000
      });
      
      console.log('Sent tenant signup to n8n');
    } catch (n8nError) {
      console.error('Failed to notify n8n:', n8nError.message);
    }
    
    res.status(201).json({ 
      success: true,
      tenant: newTenant,
      user: userResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Update tenant status
app.patch('/api/tenants/:id/status', filterTenantsByRole, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE client_tenants SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json({ success: true, tenant: result.rows[0] });
  } catch (error) {
    console.error('Error updating tenant status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete tenant
app.delete('/api/tenants/:id', filterTenantsByRole, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM client_tenants WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json({ success: true, message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Automara Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
