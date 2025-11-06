require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

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

// Tenants endpoint - hierarchical with STRICT MSP isolation
app.get('/api/tenants', filterTenantsByRole, async (req, res) => {
  console.log('=== TENANTS API DEBUG ===');
  console.log('req.userRole:', req.userRole);
  console.log('req.tenantId:', req.tenantId);

  try {
    let query;
    let params = [];

    // Map 'admin' to 'global_admin' for backward compatibility
    const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;

    if (effectiveRole === 'global_admin') {
      // Global admin sees ALL tenants across ALL MSPs (including sub-tenants)
      query = `
        SELECT
          t.*,
          (SELECT COUNT(*) FROM client_tenants WHERE parent_tenant_id = t.id) as sub_tenant_count,
          (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count
        FROM client_tenants t
        ORDER BY
          COALESCE(t.msp_root_id, t.id),
          CASE WHEN t.parent_tenant_id IS NULL THEN 0 ELSE 1 END,
          t.created_at DESC
      `;
      console.log('Global admin query: ALL tenants across all MSPs');
    } else if (effectiveRole === 'client_admin') {
      // Client admin sees ONLY tenants within their MSP hierarchy (strict isolation)
      if (!req.tenantId) {
        console.log('Client admin but no tenantId - returning 403');
        return res.status(403).json({ error: 'Access denied - no tenant ID' });
      }

      // First get the user's MSP root ID
      const mspRootResult = await pool.query(
        'SELECT msp_root_id FROM client_tenants WHERE id = $1',
        [req.tenantId]
      );

      if (mspRootResult.rows.length === 0) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const mspRootId = mspRootResult.rows[0].msp_root_id;

      // Return all tenants within this MSP hierarchy ONLY
      query = `
        SELECT
          t.*,
          (SELECT COUNT(*) FROM client_tenants WHERE parent_tenant_id = t.id) as sub_tenant_count,
          (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count
        FROM client_tenants t
        WHERE t.msp_root_id = $1
        ORDER BY
          CASE WHEN t.parent_tenant_id IS NULL THEN 0 ELSE 1 END,
          t.created_at DESC
      `;
      params = [mspRootId];
      console.log('Client admin query: tenants with msp_root_id =', mspRootId);
    } else {
      // Client user sees only their own tenant
      if (!req.tenantId) {
        console.log('Client user but no tenantId - returning 403');
        return res.status(403).json({ error: 'Access denied - no tenant ID' });
      }
      query = `
        SELECT
          t.*,
          (SELECT COUNT(*) FROM client_tenants WHERE parent_tenant_id = t.id) as sub_tenant_count,
          (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count
        FROM client_tenants t
        WHERE t.id = $1
      `;
      params = [req.tenantId];
      console.log('Client user query: tenant id =', req.tenantId);
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

// Create sub-tenant (for MSP tenants) with STRICT MSP boundary checks
app.post('/api/tenants/:parentId/sub-tenants', filterTenantsByRole, async (req, res) => {
  const { parentId } = req.params;
  const { name, domain, owner_email } = req.body;
  const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;

  try {
    // Verify parent tenant exists and is MSP type
    const parentCheck = await pool.query(
      'SELECT id, tenant_type, msp_root_id FROM client_tenants WHERE id = $1',
      [parentId]
    );

    if (parentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Parent tenant not found' });
    }

    const parentTenant = parentCheck.rows[0];

    if (parentTenant.tenant_type !== 'msp') {
      return res.status(400).json({ error: 'Parent tenant must be MSP type to create sub-tenants' });
    }

    // STRICT MSP ISOLATION: Verify user has access to this MSP hierarchy
    if (effectiveRole !== 'global_admin') {
      if (effectiveRole !== 'client_admin') {
        return res.status(403).json({ error: 'Only admins can create sub-tenants' });
      }

      // Get user's MSP root to verify they're in the same hierarchy
      const userMspCheck = await pool.query(
        'SELECT msp_root_id FROM client_tenants WHERE id = $1',
        [req.tenantId]
      );

      if (userMspCheck.rows.length === 0 ||
          userMspCheck.rows[0].msp_root_id !== parentTenant.msp_root_id) {
        return res.status(403).json({
          error: 'Access denied: Cannot create sub-tenants for other MSPs'
        });
      }
    }

    // Create the sub-tenant (msp_root_id will be set automatically by trigger)
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
  const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
  
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

// Create tenant endpoint (for signup)
app.post('/api/tenants', filterTenantsByRole, async (req, res) => {
  const { name, domain, owner_email, owner_first_name, owner_last_name } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO client_tenants (name, domain, owner_email, status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [name, domain, owner_email, 'active']
    );
    res.status(201).json({ 
      success: true,
      tenant: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Update tenant
app.put('/api/tenants/:id', filterTenantsByRole, async (req, res) => {
  const { id } = req.params;
  const { name, domain, owner_email } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE client_tenants SET name = $1, domain = $2, owner_email = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, domain, owner_email, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json({ success: true, tenant: result.rows[0] });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ error: error.message });
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

// Get all users (admin only) with STRICT MSP isolation
app.get('/api/users', filterTenantsByRole, async (req, res) => {
  const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;

  if (effectiveRole !== 'global_admin' && effectiveRole !== 'client_admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    let query;
    let params = [];

    if (effectiveRole === 'global_admin') {
      // Global admin sees all users across all MSPs
      query = `
        SELECT
          u.id, u.email, u.first_name, u.last_name, u.role, u.tenant_id, u.status,
          t.name as tenant_name, t.tenant_type, t.msp_root_id
        FROM users u
        LEFT JOIN client_tenants t ON u.tenant_id = t.id
        ORDER BY u.created_at DESC
      `;
    } else if (effectiveRole === 'client_admin') {
      // Client admin sees ONLY users within their MSP hierarchy (strict isolation)
      const tenantId = req.tenantId;

      // Get the MSP root ID for this admin
      const mspRootResult = await pool.query(
        'SELECT msp_root_id FROM client_tenants WHERE id = $1',
        [tenantId]
      );

      if (mspRootResult.rows.length === 0) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const mspRootId = mspRootResult.rows[0].msp_root_id;

      // Return users only from tenants within this MSP hierarchy
      query = `
        SELECT
          u.id, u.email, u.first_name, u.last_name, u.role, u.tenant_id, u.status,
          t.name as tenant_name, t.tenant_type, t.msp_root_id
        FROM users u
        LEFT JOIN client_tenants t ON u.tenant_id = t.id
        WHERE t.msp_root_id = $1
        ORDER BY u.created_at DESC
      `;
      params = [mspRootId];
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
  const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
  const { id } = req.params;
  const { role } = req.body;
  
  // Only global_admin and client_admin can change roles
  if (effectiveRole !== 'global_admin' && effectiveRole !== 'client_admin') {
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

// ============================================================================
// MSP MANAGEMENT ENDPOINTS
// ============================================================================

// Get MSP statistics (for admins)
app.get('/api/msp/stats', filterTenantsByRole, async (req, res) => {
  const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;

  if (effectiveRole !== 'global_admin' && effectiveRole !== 'client_admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    let mspRootId;

    if (effectiveRole === 'client_admin') {
      // Get the MSP root for this admin
      const result = await pool.query(
        'SELECT msp_root_id FROM client_tenants WHERE id = $1',
        [req.tenantId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      mspRootId = result.rows[0].msp_root_id;
    }

    let query;
    let params = [];

    if (effectiveRole === 'global_admin') {
      // Global admin sees stats for ALL MSPs
      query = `
        SELECT
          t.id as msp_id,
          t.name as msp_name,
          t.domain as msp_domain,
          t.tenant_type,
          COUNT(DISTINCT sub.id) as total_clients,
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) as active_users
        FROM client_tenants t
        LEFT JOIN client_tenants sub ON sub.msp_root_id = t.id AND sub.id != t.id
        LEFT JOIN users u ON u.tenant_id = sub.id OR u.tenant_id = t.id
        WHERE t.parent_tenant_id IS NULL
        GROUP BY t.id, t.name, t.domain, t.tenant_type
        ORDER BY t.name
      `;
    } else {
      // Client admin sees stats for their MSP only
      query = `
        SELECT
          t.id as msp_id,
          t.name as msp_name,
          t.domain as msp_domain,
          t.tenant_type,
          COUNT(DISTINCT sub.id) as total_clients,
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) as active_users
        FROM client_tenants t
        LEFT JOIN client_tenants sub ON sub.msp_root_id = t.id AND sub.id != t.id
        LEFT JOIN users u ON u.tenant_id = sub.id OR u.tenant_id = t.id
        WHERE t.id = $1
        GROUP BY t.id, t.name, t.domain, t.tenant_type
      `;
      params = [mspRootId];
    }

    const result = await pool.query(query, params);
    res.json({ stats: result.rows });
  } catch (error) {
    console.error('Error fetching MSP stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert tenant to MSP (global admin only)
app.post('/api/tenants/:id/convert-to-msp', filterTenantsByRole, async (req, res) => {
  const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
  const { id } = req.params;

  if (effectiveRole !== 'global_admin') {
    return res.status(403).json({ error: 'Only global admin can convert tenants to MSP' });
  }

  try {
    // Verify tenant exists and is not already an MSP
    const tenantCheck = await pool.query(
      'SELECT id, tenant_type, parent_tenant_id FROM client_tenants WHERE id = $1',
      [id]
    );

    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = tenantCheck.rows[0];

    if (tenant.tenant_type === 'msp') {
      return res.status(400).json({ error: 'Tenant is already an MSP' });
    }

    if (tenant.parent_tenant_id !== null) {
      return res.status(400).json({
        error: 'Cannot convert sub-tenant to MSP. Only top-level tenants can become MSPs.'
      });
    }

    // Convert to MSP and update msp_root_id
    const result = await pool.query(
      `UPDATE client_tenants
       SET tenant_type = 'msp', msp_root_id = $1, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({
      success: true,
      message: 'Tenant converted to MSP successfully',
      tenant: result.rows[0]
    });
  } catch (error) {
    console.error('Error converting tenant to MSP:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get MSP hierarchy tree (for visualization)
app.get('/api/msp/hierarchy', filterTenantsByRole, async (req, res) => {
  const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;

  if (effectiveRole !== 'global_admin' && effectiveRole !== 'client_admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    let query;
    let params = [];

    if (effectiveRole === 'global_admin') {
      // Global admin sees full hierarchy across all MSPs
      query = `
        WITH RECURSIVE hierarchy AS (
          SELECT
            t.id, t.name, t.domain, t.tenant_type, t.parent_tenant_id,
            t.msp_root_id, t.status, t.owner_email,
            0 AS level,
            ARRAY[t.id] AS path
          FROM client_tenants t
          WHERE t.parent_tenant_id IS NULL

          UNION ALL

          SELECT
            t.id, t.name, t.domain, t.tenant_type, t.parent_tenant_id,
            t.msp_root_id, t.status, t.owner_email,
            h.level + 1,
            h.path || t.id
          FROM client_tenants t
          INNER JOIN hierarchy h ON t.parent_tenant_id = h.id
        )
        SELECT * FROM hierarchy ORDER BY path
      `;
    } else {
      // Client admin sees only their MSP hierarchy
      const mspResult = await pool.query(
        'SELECT msp_root_id FROM client_tenants WHERE id = $1',
        [req.tenantId]
      );

      if (mspResult.rows.length === 0) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const mspRootId = mspResult.rows[0].msp_root_id;

      query = `
        WITH RECURSIVE hierarchy AS (
          SELECT
            t.id, t.name, t.domain, t.tenant_type, t.parent_tenant_id,
            t.msp_root_id, t.status, t.owner_email,
            0 AS level,
            ARRAY[t.id] AS path
          FROM client_tenants t
          WHERE t.id = $1

          UNION ALL

          SELECT
            t.id, t.name, t.domain, t.tenant_type, t.parent_tenant_id,
            t.msp_root_id, t.status, t.owner_email,
            h.level + 1,
            h.path || t.id
          FROM client_tenants t
          INNER JOIN hierarchy h ON t.parent_tenant_id = h.id
        )
        SELECT * FROM hierarchy ORDER BY path
      `;
      params = [mspRootId];
    }

    const result = await pool.query(query, params);
    res.json({ hierarchy: result.rows });
  } catch (error) {
    console.error('Error fetching MSP hierarchy:', error);
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
