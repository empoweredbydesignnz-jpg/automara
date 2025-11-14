const express = require('express');
const router = express.Router();

// Assumes pool is passed in or imported
module.exports = (pool) => {
  const filterTenantsByRole = (req, res, next) => {
    req.userRole = req.headers['x-user-role'] || 'client_user';
    req.tenantId = req.headers['x-tenant-id'];
    next();
  };

  router.use(filterTenantsByRole);

  // GET all users
  router.get('/', async (req, res) => {
    const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
    
    if (!['global_admin', 'client_admin', 'msp_admin'].includes(effectiveRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      let query, params = [];
      
      if (effectiveRole === 'global_admin') {
        query = `SELECT u.*, t.name as tenant_name FROM users u LEFT JOIN client_tenants t ON u.tenant_id = t.id ORDER BY u.created_at DESC`;
      } else if (effectiveRole === 'msp_admin') {
        query = `WITH RECURSIVE sub_tenants AS (
          SELECT id FROM client_tenants WHERE id = $1
          UNION ALL
          SELECT ct.id FROM client_tenants ct INNER JOIN sub_tenants st ON ct.parent_tenant_id = st.id
        )
        SELECT u.*, t.name as tenant_name FROM users u 
        JOIN sub_tenants st ON u.tenant_id = st.id 
        LEFT JOIN client_tenants t ON u.tenant_id = t.id 
        ORDER BY u.created_at DESC`;
        params = [req.tenantId];
      } else {
        query = `SELECT u.*, t.name as tenant_name FROM users u LEFT JOIN client_tenants t ON u.tenant_id = t.id WHERE u.tenant_id = $1 ORDER BY u.created_at DESC`;
        params = [req.tenantId];
      }
      
      const result = await pool.query(query, params);
      res.json({ users: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST create user
  router.post('/', async (req, res) => {
    const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
    const { email, first_name, last_name, role, tenant_id } = req.body;
    
    if (!['global_admin', 'client_admin', 'msp_admin'].includes(effectiveRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      const result = await pool.query(
        'INSERT INTO users (email, first_name, last_name, role, tenant_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
        [email, first_name, last_name, role, tenant_id, 'active']
      );
      
      res.status(201).json({ success: true, user: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH update role
  router.patch('/:id/role', async (req, res) => {
    const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['global_admin', 'client_admin', 'msp_admin'].includes(effectiveRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
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
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE user
  router.delete('/:id', async (req, res) => {
    const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
    const { id } = req.params;
    
    if (!['global_admin', 'client_admin', 'msp_admin'].includes(effectiveRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};