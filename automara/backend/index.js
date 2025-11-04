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
      const adminUser = await pool.query(
        'SELECT id, email, first_name, last_name, role FROM users WHERE email = $1',
        [email]
      );
      
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
        [email, email.split('@')[0], '', 'client', tenant.id]
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

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  
  if (userRole !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied. Admin privileges required.' 
    });
  }
  
  next();
};

// Middleware to filter tenants based on role
const filterTenantsByRole = (req, res, next) => {
  req.userRole = req.headers['x-user-role'] || 'client';
  req.tenantId = req.headers['x-tenant-id'];
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

// Tenants endpoint - filtered by role
app.get('/api/tenants', filterTenantsByRole, async (req, res) => {
  try {
    let query;
    let params = [];
    
    if (req.userRole === 'admin') {
      // Admin sees all tenants
      query = 'SELECT * FROM client_tenants ORDER BY created_at DESC';
    } else {
      // Client sees only their tenant
      if (!req.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      query = 'SELECT * FROM client_tenants WHERE id = $1';
      params = [req.tenantId];
    }
    
    const result = await pool.query(query, params);
    res.json({ tenants: result.rows });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create tenant endpoint (for signup)
app.post('/api/tenants', async (req, res) => {
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
app.put('/api/tenants/:id', async (req, res) => {
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
app.patch('/api/tenants/:id/status', async (req, res) => {
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
app.delete('/api/tenants/:id', async (req, res) => {
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
