# Ticketing System - Deployment Guide

## Overview

A comprehensive ticketing system has been integrated into the Automara portal with complete tenant isolation. The system allows:

- **Clients**: Create and manage their own support tickets
- **Global Admin**: View and manage ALL tickets across ALL tenants
- **Tenant Admins** (MSP/Client Admin): View and manage tickets for their tenant and sub-tenants

## Architecture

The ticketing system is fully integrated into the existing Automara stack:
- **Database**: PostgreSQL (shared database with tenant isolation via `tenant_id`)
- **Backend**: Node.js/Express API routes at `/api/tickets`
- **Frontend**: React page at `/tickets`
- **No separate Docker service needed** - fully integrated into existing services

## Files Created/Modified

### Database Schema
**File**: `y:\migrations\create-tickets-schema.sql`

Tables created:
- `tickets` - Main tickets table with tenant isolation
- `ticket_comments` - Comments and replies on tickets
- `ticket_attachments` - File attachments
- `ticket_activity` - Audit log of all ticket changes
- `ticket_categories` - Ticket categories (global and tenant-specific)

Features:
- Auto-generated ticket numbers (TKT-000001 format)
- Automatic timestamps with `updated_at` triggers
- Full cascade delete for tenant isolation
- Comprehensive indexes for performance

### Backend API
**File**: `y:\backend\routes\tickets.js` (720 lines)

Endpoints:
```
GET    /api/tickets              - List tickets (filtered by role/tenant)
GET    /api/tickets/stats        - Get ticket statistics
GET    /api/tickets/:id          - Get single ticket with full details
POST   /api/tickets              - Create new ticket
PATCH  /api/tickets/:id          - Update ticket (status, priority, etc.)
DELETE /api/tickets/:id          - Delete ticket (admin only)
POST   /api/tickets/:id/comments - Add comment to ticket
GET    /api/tickets/categories/list - Get available categories
```

**File**: `y:\backend\index.js` (modified)
- Added `const ticketRoutes = require('./routes/tickets');`
- Registered route: `app.use('/api/tickets', ticketRoutes(pool));`

### Frontend
**File**: `y:\frontend\src\pages\TicketsPage.jsx` (1,065 lines)

Features:
- Ticket list with filtering (status, priority, search)
- Real-time statistics dashboard
- Create new ticket modal
- Ticket details modal with full history
- Comment system with internal notes support
- Status and priority updates (admin only)
- Activity log viewer
- Responsive design with theme support

**File**: `y:\frontend\src\App.jsx` (modified)
- Added `import TicketsPage from './pages/TicketsPage'`
- Added route: `<Route path="/tickets" element={<TicketsPage />} />`

**File**: `y:\frontend\src\components\Layout.jsx` (modified)
- Added "Tickets" navigation item with ticket icon
- Visible to all users (tenants and admins)

## Deployment Steps

### Step 1: Run Database Migration

Connect to your PostgreSQL database and run the migration:

```bash
# Option 1: Via Docker
docker exec -i automara-postgres psql -U automara -d automara < y:/migrations/create-tickets-schema.sql

# Option 2: Via psql directly
psql -h localhost -U automara -d automara -f y:/migrations/create-tickets-schema.sql

# Option 3: Via pgAdmin
# Open pgAdmin, connect to database, and execute the SQL file
```

Verify the migration:
```sql
-- Check tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'ticket%';

-- Should return:
-- tickets
-- ticket_comments
-- ticket_attachments
-- ticket_activity
-- ticket_categories

-- Check default categories were created
SELECT * FROM ticket_categories WHERE is_global = true;
```

### Step 2: Restart Backend Service

The backend code changes require a restart:

```bash
# If using docker-compose
docker-compose restart backend

# Or rebuild if you prefer
docker-compose up -d --build backend

# Verify backend started successfully
docker logs automara-backend

# You should see:
# "🚀 Automara Backend running on port 4000"
```

### Step 3: Rebuild Frontend (if needed)

If your frontend is using a production build:

```bash
# Rebuild frontend container
docker-compose up -d --build frontend

# Or if running in development mode, the changes should hot-reload automatically
```

### Step 4: Verify Deployment

1. **Check database**:
   ```bash
   docker exec -it automara-postgres psql -U automara -d automara -c "SELECT COUNT(*) FROM tickets;"
   ```

2. **Check backend API**:
   ```bash
   # Test the tickets endpoint (replace with your actual headers)
   curl -X GET http://localhost:4000/api/tickets \
     -H "x-user-role: global_admin" \
     -H "x-tenant-id: 1" \
     -H "x-user-id: 1"
   ```

3. **Check frontend**:
   - Navigate to `http://your-domain/tickets`
   - You should see the tickets page with empty state
   - Click "New Ticket" to test ticket creation

## User Roles & Permissions

### Client User (`client_user`)
- View tickets created within their tenant
- Create new tickets for their tenant
- Add comments to tickets they can view
- Cannot change ticket status or priority
- Cannot delete tickets

### Client Admin (`client_admin`, `msp_admin`)
- All client_user permissions
- View tickets for their tenant AND sub-tenants
- Update ticket status and priority
- Assign tickets to users
- Delete tickets (cascade to their tenant)

### Global Admin (`global_admin`)
- View ALL tickets across ALL tenants
- Full administrative control
- Can specify tenant when creating tickets
- Can manage all ticket properties
- Can delete any ticket

## API Usage Examples

### Create a Ticket
```javascript
const response = await axios.post('/api/tickets', {
  subject: 'Cannot login to account',
  description: 'Getting error "Invalid credentials" when trying to login',
  priority: 'high',
  category: 'Technical Support'
}, {
  headers: {
    'x-user-role': 'client_user',
    'x-tenant-id': '123',
    'x-user-id': '456'
  }
});
```

### Update Ticket Status
```javascript
const response = await axios.patch('/api/tickets/1', {
  status: 'in_progress'
}, {
  headers: {
    'x-user-role': 'client_admin',
    'x-tenant-id': '123',
    'x-user-id': '456'
  }
});
```

### Add Comment
```javascript
const response = await axios.post('/api/tickets/1/comments', {
  comment: 'We are investigating this issue and will update you shortly.',
  is_internal: false  // Set to true for internal notes
}, {
  headers: {
    'x-user-role': 'client_admin',
    'x-tenant-id': '123',
    'x-user-id': '456'
  }
});
```

### Filter Tickets
```javascript
const response = await axios.get('/api/tickets', {
  params: {
    status: 'open',
    priority: 'urgent',
    search: 'login'
  },
  headers: {
    'x-user-role': 'global_admin',
    'x-tenant-id': '123',
    'x-user-id': '1'
  }
});
```

## Ticket Status Workflow

```
open → in_progress → resolved → closed
  ↓         ↓
waiting_customer
waiting_internal
```

**Status Descriptions**:
- `open` - New ticket, not yet addressed
- `in_progress` - Actively being worked on
- `waiting_customer` - Waiting for customer response
- `waiting_internal` - Waiting for internal team action
- `resolved` - Issue resolved, awaiting customer confirmation
- `closed` - Ticket closed permanently

## Priority Levels

- `urgent` - Critical issues requiring immediate attention
- `high` - Important issues affecting operations
- `medium` - Standard issues (default)
- `low` - Minor issues or feature requests

## Default Categories

The system comes with 6 pre-configured global categories:
1. **Technical Support** - Technical issues and troubleshooting
2. **Billing** - Billing and payment inquiries
3. **Feature Request** - New feature requests
4. **Bug Report** - Bug reports
5. **General Inquiry** - General questions
6. **Account Management** - Account settings

### Adding Custom Categories

```sql
-- Add tenant-specific category
INSERT INTO ticket_categories (tenant_id, name, description, color, is_global)
VALUES (123, 'VIP Support', 'Priority support for VIP customers', '#ff0000', false);

-- Add global category (admin only)
INSERT INTO ticket_categories (name, description, color, is_global)
VALUES ('Security Issue', 'Security-related concerns', '#ff0000', true);
```

## Multi-Tenant Isolation

The ticketing system implements tenant isolation at the application level:

1. **Database Level**: All tickets have a `tenant_id` foreign key
2. **API Level**: Role-based filtering in all API endpoints
3. **Frontend Level**: Headers automatically include tenant context

### Isolation Rules:
- **Client Users**: Only see tickets where `tenant_id = their_tenant_id`
- **Tenant Admins**: See tickets where `tenant_id IN (their_tenant_id, sub_tenant_ids)`
- **Global Admin**: See all tickets (no filter)

## Performance Considerations

### Indexes Created:
```sql
-- Optimizes ticket listing by tenant
idx_tickets_tenant (tenant_id)

-- Optimizes filtering by status/priority
idx_tickets_status (status)
idx_tickets_priority (priority)

-- Optimizes sorting by date
idx_tickets_created_at (created_at DESC)

-- Optimizes ticket number lookups
idx_tickets_number (ticket_number)

-- And more...
```

### Recommended: Add Pagination

For high-volume deployments, consider adding pagination to the API:

```javascript
// Backend: Add to GET /api/tickets
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 50;
const offset = (page - 1) * limit;

query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
params.push(limit, offset);
```

## Monitoring & Maintenance

### Key Metrics to Monitor:
```sql
-- Total tickets by status
SELECT status, COUNT(*) FROM tickets GROUP BY status;

-- Tickets per tenant
SELECT tenant_id, COUNT(*) FROM tickets GROUP BY tenant_id ORDER BY COUNT(*) DESC LIMIT 10;

-- Average resolution time
SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_hours
FROM tickets WHERE resolved_at IS NOT NULL;

-- Urgent tickets not resolved
SELECT COUNT(*) FROM tickets WHERE priority = 'urgent' AND status NOT IN ('resolved', 'closed');
```

### Cleanup Old Closed Tickets:
```sql
-- Archive tickets older than 1 year
DELETE FROM tickets
WHERE status = 'closed'
  AND closed_at < NOW() - INTERVAL '1 year';
```

## Troubleshooting

### Issue: "Cannot read property 'tickets'"
**Cause**: Backend API not returning expected format
**Fix**: Check backend logs for errors, ensure database connection is working

### Issue: "Tickets not showing for tenant"
**Cause**: Tenant ID mismatch or role filtering issue
**Fix**:
1. Check browser console for header values
2. Verify `x-tenant-id` matches tenant in database
3. Check user role is correctly set

### Issue: "Cannot create ticket"
**Cause**: Missing required fields or database constraint violation
**Fix**: Check request payload includes `subject` and `description`

### Issue: "Global admin can't see all tickets"
**Cause**: Role header not set to 'global_admin'
**Fix**: Verify localStorage has correct user role:
```javascript
console.log(JSON.parse(localStorage.getItem('user')).role);
```

## Security Considerations

1. **SQL Injection**: All queries use parameterized statements
2. **Tenant Isolation**: Enforced at every API endpoint
3. **Authentication**: Relies on existing Automara auth system
4. **Authorization**: Role-based access control on all operations
5. **Audit Trail**: All ticket changes logged in `ticket_activity` table

## Future Enhancements

Potential features to add:
1. **Email Notifications**: Send emails when tickets are created/updated
2. **File Attachments**: Implement file upload for `ticket_attachments` table
3. **SLA Tracking**: Add SLA deadlines and escalation rules
4. **Ticket Templates**: Pre-filled ticket forms for common issues
5. **Customer Portal**: Public-facing portal for clients to submit tickets
6. **Integration**: Connect tickets to N8N workflows for automation
7. **Reports**: Advanced analytics and reporting dashboard
8. **Webhooks**: Notify external systems of ticket events

## Support

For issues with the ticketing system:
1. Check application logs: `docker logs automara-backend`
2. Check database connectivity: `docker exec -it automara-postgres psql -U automara`
3. Review this deployment guide
4. Check the backend API routes in `y:\backend\routes\tickets.js`

## Summary

The ticketing system is now fully integrated into Automara:
- ✅ Database schema created with tenant isolation
- ✅ Backend API with full CRUD operations
- ✅ Frontend UI with ticket management
- ✅ Role-based access control
- ✅ Multi-tenant support
- ✅ Activity logging and audit trail
- ✅ Scalable architecture

All users can now access the ticketing system via the "Tickets" menu item in the navigation sidebar!
