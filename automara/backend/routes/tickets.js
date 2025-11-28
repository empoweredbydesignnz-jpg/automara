const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // Middleware to extract user role and tenant info from headers
  const filterTenantsByRole = (req, res, next) => {
    req.userRole = req.headers['x-user-role'] || 'client_user';
    req.tenantId = parseInt(req.headers['x-tenant-id']) || null;
    req.userId = parseInt(req.headers['x-user-id']) || null;
    next();
  };

  router.use(filterTenantsByRole);

  // Helper function to build tenant filter based on role
  const buildTenantFilter = async (effectiveRole, tenantId) => {
    console.log('[buildTenantFilter] Role:', effectiveRole, 'Tenant ID:', tenantId, 'Type:', typeof tenantId);

    if (effectiveRole === 'global_admin') {
      // Global admin sees all tickets
      return { whereClause: '', params: [] };
    } else if (effectiveRole === 'client_admin' || effectiveRole === 'msp_admin') {
      // Admin sees tickets from own tenant + sub-tenants
      if (!tenantId) {
        console.error('[buildTenantFilter] No tenant ID provided for admin user');
        return { whereClause: '1=0', params: [] }; // Return no results
      }

      const parsedTenantId = parseInt(tenantId);
      console.log('[buildTenantFilter] Parsed Tenant ID:', parsedTenantId);

      const subTenantsQuery = `
        SELECT id FROM client_tenants
        WHERE id = $1 OR parent_tenant_id = $1
      `;
      const subTenantsResult = await pool.query(subTenantsQuery, [parsedTenantId]);
      const tenantIds = subTenantsResult.rows.map(row => row.id);

      console.log('[buildTenantFilter] Found tenant IDs:', tenantIds);

      if (tenantIds.length === 0) {
        console.warn('[buildTenantFilter] No tenants found for tenant ID:', parsedTenantId);
        return { whereClause: '1=0', params: [] }; // Return no results
      }

      return {
        whereClause: 't.tenant_id = ANY($1::int[])',
        params: [tenantIds]
      };
    } else {
      // Regular user sees only own tenant tickets
      if (!tenantId) {
        console.error('[buildTenantFilter] No tenant ID provided for regular user');
        return { whereClause: '1=0', params: [] }; // Return no results
      }

      return {
        whereClause: 't.tenant_id = $1',
        params: [parseInt(tenantId)]
      };
    }
  };

  // Log activity for audit trail
  const logActivity = async (ticketId, userId, action, oldValue = null, newValue = null) => {
    try {
      const query = `
        INSERT INTO ticket_activity (ticket_id, user_id, action, old_value, new_value)
        VALUES ($1, $2, $3, $4, $5)
      `;
      await pool.query(query, [ticketId, userId, action, oldValue, newValue]);
    } catch (err) {
      console.error('Error logging ticket activity:', err);
    }
  };

  // GET /api/tickets - List tickets with filtering
  router.get('/', async (req, res) => {
    try {
      const { status, priority, assigned_to, created_by, category, search } = req.query;

      console.log('=== GET /api/tickets DEBUG ===');
      console.log('User Role:', req.userRole);
      console.log('Tenant ID:', req.tenantId);

      const tenantFilter = await buildTenantFilter(req.userRole, req.tenantId);

      console.log('Tenant Filter:', tenantFilter);

      let query = `
        SELECT
          t.*,
          creator.email as creator_email,
          creator.first_name as creator_first_name,
          creator.last_name as creator_last_name,
          assignee.email as assignee_email,
          assignee.first_name as assignee_first_name,
          assignee.last_name as assignee_last_name,
          tenant.name as tenant_name,
          (SELECT COUNT(*) FROM ticket_comments WHERE ticket_id = t.id) as comment_count
        FROM tickets t
        LEFT JOIN users creator ON t.created_by = creator.id
        LEFT JOIN users assignee ON t.assigned_to = assignee.id
        LEFT JOIN client_tenants tenant ON t.tenant_id = tenant.id
        WHERE ${tenantFilter.whereClause || '1=1'}
      `;

      const params = [...tenantFilter.params];
      let paramCount = params.length;

      // Add filters
      if (status) {
        paramCount++;
        query += ` AND t.status = $${paramCount}`;
        params.push(status);
      }

      if (priority) {
        paramCount++;
        query += ` AND t.priority = $${paramCount}`;
        params.push(priority);
      }

      if (assigned_to) {
        paramCount++;
        query += ` AND t.assigned_to = $${paramCount}`;
        params.push(parseInt(assigned_to));
      }

      if (created_by) {
        paramCount++;
        query += ` AND t.created_by = $${paramCount}`;
        params.push(parseInt(created_by));
      }

      if (category) {
        paramCount++;
        query += ` AND t.category = $${paramCount}`;
        params.push(category);
      }

      if (search) {
        paramCount++;
        query += ` AND (t.subject ILIKE $${paramCount} OR t.description ILIKE $${paramCount} OR t.ticket_number ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      query += ' ORDER BY t.created_at DESC';

      console.log('Final Query:', query);
      console.log('Query Params:', params);

      const result = await pool.query(query, params);

      console.log('Tickets Found:', result.rows.length);
      if (result.rows.length > 0) {
        console.log('First Ticket:', result.rows[0]);
      }

      res.json({
        success: true,
        tickets: result.rows,
        count: result.rows.length
      });
    } catch (err) {
      console.error('Error fetching tickets:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
    }
  });

  // GET /api/tickets/stats - Get ticket statistics
  router.get('/stats', async (req, res) => {
    try {
      const tenantFilter = await buildTenantFilter(req.userRole, req.tenantId);

      const query = `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE t.status = 'open') as open,
          COUNT(*) FILTER (WHERE t.status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE t.status = 'waiting_customer') as waiting_customer,
          COUNT(*) FILTER (WHERE t.status = 'waiting_internal') as waiting_internal,
          COUNT(*) FILTER (WHERE t.status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE t.status = 'closed') as closed,
          COUNT(*) FILTER (WHERE t.priority = 'urgent') as urgent,
          COUNT(*) FILTER (WHERE t.priority = 'high') as high,
          COUNT(*) FILTER (WHERE t.priority = 'medium') as medium,
          COUNT(*) FILTER (WHERE t.priority = 'low') as low
        FROM tickets t
        WHERE ${tenantFilter.whereClause || '1=1'}
      `;

      const result = await pool.query(query, tenantFilter.params);

      res.json({
        success: true,
        stats: result.rows[0]
      });
    } catch (err) {
      console.error('Error fetching ticket stats:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch ticket statistics' });
    }
  });

  // GET /api/tickets/:id - Get single ticket with full details
  router.get('/:id', async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const tenantFilter = await buildTenantFilter(req.userRole, req.tenantId);

      // Get ticket
      const ticketQuery = `
        SELECT
          t.*,
          creator.email as creator_email,
          creator.first_name as creator_first_name,
          creator.last_name as creator_last_name,
          assignee.email as assignee_email,
          assignee.first_name as assignee_first_name,
          assignee.last_name as assignee_last_name,
          tenant.name as tenant_name,
          tenant.id as tenant_id
        FROM tickets t
        LEFT JOIN users creator ON t.created_by = creator.id
        LEFT JOIN users assignee ON t.assigned_to = assignee.id
        LEFT JOIN client_tenants tenant ON t.tenant_id = tenant.id
        WHERE t.id = $${tenantFilter.params.length + 1}
        ${tenantFilter.whereClause ? 'AND ' + tenantFilter.whereClause : ''}
      `;

      const ticketResult = await pool.query(ticketQuery, [...tenantFilter.params, ticketId]);

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      const ticket = ticketResult.rows[0];

      // Get comments
      const commentsQuery = `
        SELECT
          c.*,
          u.email as user_email,
          u.first_name as user_first_name,
          u.last_name as user_last_name,
          u.role as user_role
        FROM ticket_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = $1
        ORDER BY c.created_at ASC
      `;
      const commentsResult = await pool.query(commentsQuery, [ticketId]);

      // Get attachments
      const attachmentsQuery = `
        SELECT
          a.*,
          u.email as uploaded_by_email,
          u.first_name as uploaded_by_first_name,
          u.last_name as uploaded_by_last_name
        FROM ticket_attachments a
        LEFT JOIN users u ON a.uploaded_by = u.id
        WHERE a.ticket_id = $1
        ORDER BY a.created_at DESC
      `;
      const attachmentsResult = await pool.query(attachmentsQuery, [ticketId]);

      // Get activity log
      const activityQuery = `
        SELECT
          a.*,
          u.email as user_email,
          u.first_name as user_first_name,
          u.last_name as user_last_name
        FROM ticket_activity a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.ticket_id = $1
        ORDER BY a.created_at DESC
        LIMIT 50
      `;
      const activityResult = await pool.query(activityQuery, [ticketId]);

      res.json({
        success: true,
        ticket: {
          ...ticket,
          comments: commentsResult.rows,
          attachments: attachmentsResult.rows,
          activity: activityResult.rows
        }
      });
    } catch (err) {
      console.error('Error fetching ticket details:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch ticket details' });
    }
  });

  // POST /api/tickets - Create new ticket
  router.post('/', async (req, res) => {
    try {
      const { subject, description, priority, category, assigned_to } = req.body;

      if (!subject || !description) {
        return res.status(400).json({ success: false, error: 'Subject and description are required' });
      }

      // Use tenant from header or allow global_admin to specify
      const tenantId = req.userRole === 'global_admin' && req.body.tenant_id
        ? req.body.tenant_id
        : req.tenantId;

      const query = `
        INSERT INTO tickets (tenant_id, created_by, subject, description, priority, category, assigned_to)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await pool.query(query, [
        tenantId,
        req.userId,
        subject,
        description,
        priority || 'medium',
        category || null,
        assigned_to || null
      ]);

      const ticket = result.rows[0];

      // Log activity
      await logActivity(ticket.id, req.userId, 'created');

      res.status(201).json({
        success: true,
        ticket
      });
    } catch (err) {
      console.error('Error creating ticket:', err);
      res.status(500).json({ success: false, error: 'Failed to create ticket' });
    }
  });

  // PATCH /api/tickets/:id - Update ticket
  router.patch('/:id', async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const { subject, description, status, priority, category, assigned_to } = req.body;

      // Verify ticket belongs to user's tenant
      const tenantFilter = await buildTenantFilter(req.userRole, req.tenantId);
      const checkQuery = `
        SELECT * FROM tickets
        WHERE id = $${tenantFilter.params.length + 1}
        ${tenantFilter.whereClause ? 'AND ' + tenantFilter.whereClause : ''}
      `;
      const checkResult = await pool.query(checkQuery, [...tenantFilter.params, ticketId]);

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      const oldTicket = checkResult.rows[0];
      const updates = [];
      const params = [];
      let paramCount = 0;

      if (subject !== undefined) {
        paramCount++;
        updates.push(`subject = $${paramCount}`);
        params.push(subject);
        if (subject !== oldTicket.subject) {
          await logActivity(ticketId, req.userId, 'updated_subject', oldTicket.subject, subject);
        }
      }

      if (description !== undefined) {
        paramCount++;
        updates.push(`description = $${paramCount}`);
        params.push(description);
      }

      if (status !== undefined) {
        paramCount++;
        updates.push(`status = $${paramCount}`);
        params.push(status);

        // Set resolved/closed timestamps
        if (status === 'resolved' && oldTicket.status !== 'resolved') {
          updates.push(`resolved_at = CURRENT_TIMESTAMP`);
        }
        if (status === 'closed' && oldTicket.status !== 'closed') {
          updates.push(`closed_at = CURRENT_TIMESTAMP`);
        }

        if (status !== oldTicket.status) {
          await logActivity(ticketId, req.userId, 'updated_status', oldTicket.status, status);
        }
      }

      if (priority !== undefined) {
        paramCount++;
        updates.push(`priority = $${paramCount}`);
        params.push(priority);
        if (priority !== oldTicket.priority) {
          await logActivity(ticketId, req.userId, 'updated_priority', oldTicket.priority, priority);
        }
      }

      if (category !== undefined) {
        paramCount++;
        updates.push(`category = $${paramCount}`);
        params.push(category);
        if (category !== oldTicket.category) {
          await logActivity(ticketId, req.userId, 'updated_category', oldTicket.category, category);
        }
      }

      if (assigned_to !== undefined) {
        paramCount++;
        updates.push(`assigned_to = $${paramCount}`);
        params.push(assigned_to);
        if (assigned_to !== oldTicket.assigned_to) {
          await logActivity(ticketId, req.userId, 'assigned',
            oldTicket.assigned_to ? `User ${oldTicket.assigned_to}` : 'Unassigned',
            assigned_to ? `User ${assigned_to}` : 'Unassigned'
          );
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      paramCount++;
      params.push(ticketId);

      const updateQuery = `
        UPDATE tickets
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(updateQuery, params);

      res.json({
        success: true,
        ticket: result.rows[0]
      });
    } catch (err) {
      console.error('Error updating ticket:', err);
      res.status(500).json({ success: false, error: 'Failed to update ticket' });
    }
  });

  // DELETE /api/tickets/:id - Delete ticket (admin only)
  router.delete('/:id', async (req, res) => {
    try {
      if (!['global_admin', 'client_admin', 'msp_admin'].includes(req.userRole)) {
        return res.status(403).json({ success: false, error: 'Permission denied' });
      }

      const ticketId = parseInt(req.params.id);

      // Verify ticket belongs to user's tenant
      const tenantFilter = await buildTenantFilter(req.userRole, req.tenantId);
      const checkQuery = `
        SELECT id FROM tickets
        WHERE id = $${tenantFilter.params.length + 1}
        ${tenantFilter.whereClause ? 'AND ' + tenantFilter.whereClause : ''}
      `;
      const checkResult = await pool.query(checkQuery, [...tenantFilter.params, ticketId]);

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      const deleteQuery = 'DELETE FROM tickets WHERE id = $1';
      await pool.query(deleteQuery, [ticketId]);

      res.json({
        success: true,
        message: 'Ticket deleted successfully'
      });
    } catch (err) {
      console.error('Error deleting ticket:', err);
      res.status(500).json({ success: false, error: 'Failed to delete ticket' });
    }
  });

  // POST /api/tickets/:id/comments - Add comment to ticket
  router.post('/:id/comments', async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const { comment, is_internal } = req.body;

      if (!comment) {
        return res.status(400).json({ success: false, error: 'Comment is required' });
      }

      // Verify ticket belongs to user's tenant
      const tenantFilter = await buildTenantFilter(req.userRole, req.tenantId);
      const checkQuery = `
        SELECT id FROM tickets
        WHERE id = $${tenantFilter.params.length + 1}
        ${tenantFilter.whereClause ? 'AND ' + tenantFilter.whereClause : ''}
      `;
      const checkResult = await pool.query(checkQuery, [...tenantFilter.params, ticketId]);

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      const query = `
        INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await pool.query(query, [
        ticketId,
        req.userId,
        comment,
        is_internal || false
      ]);

      // Update ticket's updated_at timestamp
      await pool.query('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [ticketId]);

      // Log activity
      await logActivity(ticketId, req.userId, 'added_comment');

      res.status(201).json({
        success: true,
        comment: result.rows[0]
      });
    } catch (err) {
      console.error('Error adding comment:', err);
      res.status(500).json({ success: false, error: 'Failed to add comment' });
    }
  });

  // GET /api/tickets/categories - Get ticket categories
  router.get('/categories/list', async (req, res) => {
    try {
      const query = `
        SELECT * FROM ticket_categories
        WHERE is_global = true OR tenant_id = $1
        ORDER BY name ASC
      `;

      const result = await pool.query(query, [req.tenantId]);

      res.json({
        success: true,
        categories: result.rows
      });
    } catch (err) {
      console.error('Error fetching categories:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
  });

  return router;
};
