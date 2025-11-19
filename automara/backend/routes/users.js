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

  // GET single user
  router.get('/:id', async (req, res) => {
    const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
    const { id } = req.params;
    
    if (!['global_admin', 'client_admin', 'msp_admin'].includes(effectiveRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      let query = 'SELECT u.*, t.name as tenant_name FROM users u LEFT JOIN client_tenants t ON u.tenant_id = t.id WHERE u.id = $1';
      let params = [id];
      
      // Non-global admins can only see users from their tenant
      if (effectiveRole !== 'global_admin' && req.tenantId) {
        query += ' AND u.tenant_id = $2';
        params.push(req.tenantId);
      }
      
      const result = await pool.query(query, params);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ user: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST create user
  router.post('/', async (req, res) => {
    const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
    const { email, first_name, last_name, role, tenant_id, tenant_name, password } = req.body;

    if (!['global_admin', 'client_admin', 'msp_admin'].includes(effectiveRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      let finalTenantId = tenant_id;
      
      // If tenant_name is provided and no tenant_id, try to find or create the tenant
      if (tenant_name && !tenant_id && effectiveRole === 'global_admin') {
        // Try to find existing tenant
        const existingTenant = await pool.query(
          'SELECT id FROM client_tenants WHERE name = $1',
          [tenant_name]
        );
        
        if (existingTenant.rows.length > 0) {
          finalTenantId = existingTenant.rows[0].id;
        } else {
          // Create new tenant
          const newTenant = await pool.query(
            'INSERT INTO client_tenants (name, status, tenant_type, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
            [tenant_name, 'active', 'client']
          );
          finalTenantId = newTenant.rows[0].id;
        }
      }
      
      // Basic validation
      if (!email || !first_name || !last_name || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      if (!finalTenantId && effectiveRole !== 'global_admin') {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }
      
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      const result = await pool.query(
        'INSERT INTO users (email, first_name, last_name, role, tenant_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *',
        [email, first_name, last_name, role, finalTenantId, 'active']
      );

      res.status(201).json({ success: true, user: result.rows[0] });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT update user (full update)
  router.put('/:id', async (req, res) => {
    const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
    const { id } = req.params;
    const { first_name, last_name, email, role, tenant_id, tenant_name, password } = req.body;
    
    if (!['global_admin', 'client_admin', 'msp_admin'].includes(effectiveRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      // Check if user exists and belongs to the right tenant
      let userCheckQuery = 'SELECT * FROM users WHERE id = $1';
      let userCheckParams = [id];
      
      if (effectiveRole !== 'global_admin' && req.tenantId) {
        userCheckQuery += ' AND tenant_id = $2';
        userCheckParams.push(req.tenantId);
      }
      
      const userCheck = await pool.query(userCheckQuery, userCheckParams);
      
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found or access denied' });
      }
      
      // Resolve tenant_name → tenant_id (global admin only)
      let resolvedTenantId = tenant_id;

      if (tenant_name && effectiveRole === 'global_admin') {
        // Try to find existing tenant
        const tenantLookup = await pool.query(
          'SELECT id FROM client_tenants WHERE name = $1',
          [tenant_name]
        );

        if (tenantLookup.rows.length > 0) {
          resolvedTenantId = tenantLookup.rows[0].id;
        } else {
          // Create new tenant
          const newTenant = await pool.query(
            'INSERT INTO client_tenants (name, status, tenant_type, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
            [tenant_name, 'active', 'client']
          );
          resolvedTenantId = newTenant.rows[0].id;
          console.log(`Created new tenant: ${tenant_name} with ID: ${resolvedTenantId}`);
        }
      }
      
      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (first_name !== undefined && first_name !== null && first_name.trim() !== '') {
        updates.push(`first_name = $${paramCount++}`);
        values.push(first_name);
      }
      if (last_name !== undefined && last_name !== null && last_name.trim() !== '') {
        updates.push(`last_name = $${paramCount++}`);
        values.push(last_name);
      }
      if (email !== undefined && email !== null && email.trim() !== '') {
        updates.push(`email = $${paramCount++}`);
        values.push(email);
      }
      if (role !== undefined && role !== null && role.trim() !== '') {
        // Check role permissions
        if (effectiveRole === 'client_admin' && role === 'global_admin') {
          return res.status(403).json({ error: 'Cannot assign global admin role' });
        }
        if (effectiveRole === 'msp_admin' && ['global_admin'].includes(role)) {
          return res.status(403).json({ error: 'Cannot assign higher role' });
        }

        updates.push(`role = $${paramCount++}`);
        values.push(role);
      }
      
      // Handle password update
      if (password !== undefined && password !== null && password.trim() !== '') {
        if (password.length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }
        updates.push(`password_hash = $${paramCount++}`);
        values.push(password); // In production, you'd hash this
      }

      // Tenant update (resolved from tenant_name → tenant_id)
      if (resolvedTenantId !== undefined && resolvedTenantId !== null && effectiveRole === 'global_admin') {
        updates.push(`tenant_id = $${paramCount++}`);
        values.push(resolvedTenantId);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push(`updated_at = NOW()`);
      
      const updateQuery = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, first_name, last_name, email, role, tenant_id, status, created_at
      `;
      values.push(id);
      
      const result = await pool.query(updateQuery, values);
      
      res.json({ success: true, user: result.rows[0] });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH update user (partial update) - same as PUT for simplicity
  router.patch('/:id', async (req, res) => {
    const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;
    const { id } = req.params;
    const { first_name, last_name, email, role, tenant_id, tenant_name, password } = req.body;
    
    if (!['global_admin', 'client_admin', 'msp_admin'].includes(effectiveRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      // Check if user exists and belongs to the right tenant
      let userCheckQuery = 'SELECT * FROM users WHERE id = $1';
      let userCheckParams = [id];
      
      if (effectiveRole !== 'global_admin' && req.tenantId) {
        userCheckQuery += ' AND tenant_id = $2';
        userCheckParams.push(req.tenantId);
      }
      
      const userCheck = await pool.query(userCheckQuery, userCheckParams);
      
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found or access denied' });
      }
      
      // Resolve tenant_name → tenant_id (global admin only)
      let resolvedTenantId = tenant_id;

      if (tenant_name && effectiveRole === 'global_admin') {
        // Try to find existing tenant
        const tenantLookup = await pool.query(
          'SELECT id FROM client_tenants WHERE name = $1',
          [tenant_name]
        );

        if (tenantLookup.rows.length > 0) {
          resolvedTenantId = tenantLookup.rows[0].id;
        } else {
          // Create new tenant
          const newTenant = await pool.query(
            'INSERT INTO client_tenants (name, status, tenant_type, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
            [tenant_name, 'active', 'client']
          );
          resolvedTenantId = newTenant.rows[0].id;
          console.log(`Created new tenant: ${tenant_name} with ID: ${resolvedTenantId}`);
        }
      }
      
      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (first_name !== undefined && first_name !== null && first_name.trim() !== '') {
        updates.push(`first_name = $${paramCount++}`);
        values.push(first_name);
      }
      if (last_name !== undefined && last_name !== null && last_name.trim() !== '') {
        updates.push(`last_name = $${paramCount++}`);
        values.push(last_name);
      }
      if (email !== undefined && email !== null && email.trim() !== '') {
        updates.push(`email = $${paramCount++}`);
        values.push(email);
      }
      if (role !== undefined && role !== null && role.trim() !== '') {
        if (effectiveRole === 'client_admin' && role === 'global_admin') {
          return res.status(403).json({ error: 'Cannot assign global admin role' });
        }
        if (effectiveRole === 'msp_admin' && ['global_admin'].includes(role)) {
          return res.status(403).json({ error: 'Cannot assign higher role' });
        }

        updates.push(`role = $${paramCount++}`);
        values.push(role);
      }
      
      // Handle password update
      if (password !== undefined && password !== null && password.trim() !== '') {
        if (password.length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }
        updates.push(`password_hash = $${paramCount++}`);
        values.push(password); // In production, you'd hash this
      }

      // Tenant update (resolved from tenant_name → tenant_id)
      if (resolvedTenantId !== undefined && resolvedTenantId !== null && effectiveRole === 'global_admin') {
        updates.push(`tenant_id = $${paramCount++}`);
        values.push(resolvedTenantId);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push(`updated_at = NOW()`);
      
      const updateQuery = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, first_name, last_name, email, role, tenant_id, status, created_at
      `;
      values.push(id);
      
      const result = await pool.query(updateQuery, values);
      
      res.json({ success: true, user: result.rows[0] });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH update role (specific role-only endpoint)
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