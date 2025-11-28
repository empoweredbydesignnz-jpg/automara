# Ticketing System - Quick Start Guide

## 🚀 Quick Deployment (3 Steps)

### Step 1: Run Database Migration
```bash
docker exec -i automara-postgres psql -U automara -d automara < y:/migrations/create-tickets-schema.sql
```

### Step 2: Restart Backend
```bash
docker-compose restart backend
```

### Step 3: Access Tickets
Navigate to: `http://your-domain/tickets`

## ✅ Verification Checklist

- [ ] Database tables created (run: `docker exec -it automara-postgres psql -U automara -d automara -c "\dt ticket*"`)
- [ ] Backend shows no errors (run: `docker logs automara-backend --tail 50`)
- [ ] Frontend shows "Tickets" in navigation menu
- [ ] Can create a new ticket successfully
- [ ] Can view ticket details
- [ ] Can add comments to tickets

## 🎯 Quick Test Scenarios

### Test 1: Create Your First Ticket (Client User)
1. Login as a regular user
2. Click "Tickets" in sidebar
3. Click "+ New Ticket"
4. Fill in:
   - Subject: "Test Ticket"
   - Description: "This is a test ticket"
   - Priority: High
   - Category: Technical Support
5. Click "Create Ticket"
6. Verify ticket appears in list

### Test 2: Admin View All Tickets (Global Admin)
1. Login as admin@automara.com
2. Navigate to "Tickets"
3. Verify you see tickets from all tenants
4. Open a ticket and change status to "In Progress"
5. Add a comment
6. Verify changes are saved

### Test 3: Filter Tickets
1. Go to Tickets page
2. Use filters:
   - Filter by Status: "Open"
   - Filter by Priority: "High"
   - Search: Enter ticket number or keyword
3. Verify results update correctly

## 📊 Features Overview

| Feature | Client User | Admin | Global Admin |
|---------|-------------|-------|--------------|
| View own tickets | ✅ | ✅ | ✅ |
| View all tenant tickets | ❌ | ✅ | ✅ |
| View all tickets (global) | ❌ | ❌ | ✅ |
| Create tickets | ✅ | ✅ | ✅ |
| Update status/priority | ❌ | ✅ | ✅ |
| Add comments | ✅ | ✅ | ✅ |
| Delete tickets | ❌ | ✅ | ✅ |

## 🔧 Common Commands

### Check Database
```bash
# Count total tickets
docker exec -it automara-postgres psql -U automara -d automara -c "SELECT COUNT(*) FROM tickets;"

# View recent tickets
docker exec -it automara-postgres psql -U automara -d automara -c "SELECT ticket_number, subject, status FROM tickets ORDER BY created_at DESC LIMIT 5;"

# Check categories
docker exec -it automara-postgres psql -U automara -d automara -c "SELECT * FROM ticket_categories WHERE is_global = true;"
```

### Check Backend
```bash
# View logs
docker logs automara-backend --tail 100

# Check if tickets endpoint is registered
docker logs automara-backend | grep "tickets"

# Restart backend if needed
docker-compose restart backend
```

### Test API Directly
```bash
# Get tickets (replace headers with actual values)
curl -X GET http://localhost:4000/api/tickets \
  -H "x-user-role: global_admin" \
  -H "x-tenant-id: 1" \
  -H "x-user-id: 1"

# Get ticket stats
curl -X GET http://localhost:4000/api/tickets/stats \
  -H "x-user-role: global_admin" \
  -H "x-tenant-id: 1" \
  -H "x-user-id: 1"
```

## 🐛 Troubleshooting

### Problem: "Tickets" menu item not showing
**Solution**:
1. Clear browser cache
2. Hard refresh (Ctrl + Shift + R)
3. Check `y:\frontend\src\components\Layout.jsx` has Tickets entry

### Problem: "Cannot create ticket"
**Solution**:
1. Check browser console for errors
2. Verify database migration completed
3. Check backend logs: `docker logs automara-backend`
4. Ensure subject and description are filled

### Problem: Empty ticket list but tickets exist
**Solution**:
1. Check localStorage has correct user/tenant:
   ```javascript
   console.log(localStorage.getItem('user'));
   console.log(localStorage.getItem('currentTenant'));
   ```
2. Verify tenant_id in database matches
3. Check backend API response in Network tab

### Problem: Global admin can't see all tickets
**Solution**:
1. Verify user role is exactly 'global_admin'
2. Check database: `SELECT role FROM users WHERE email = 'admin@automara.com';`
3. Re-login to refresh localStorage

## 📈 Statistics Examples

View ticket statistics in the frontend or via database:

```sql
-- Tickets by status
SELECT status, COUNT(*) as count FROM tickets GROUP BY status;

-- Tickets by priority
SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority;

-- Tickets by tenant (global admin view)
SELECT
  t.name as tenant_name,
  COUNT(tk.id) as ticket_count
FROM client_tenants t
LEFT JOIN tickets tk ON t.id = tk.tenant_id
GROUP BY t.id, t.name
ORDER BY ticket_count DESC;

-- Average resolution time
SELECT
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_hours_to_resolve
FROM tickets
WHERE resolved_at IS NOT NULL;
```

## 🎨 Customization

### Add Custom Category
```sql
INSERT INTO ticket_categories (name, description, color, is_global)
VALUES ('Custom Category', 'Description here', '#3b82f6', true);
```

### Modify Ticket Statuses
Edit `y:\backend\routes\tickets.js` and `y:\frontend\src\pages\TicketsPage.jsx` to add custom statuses.

### Change Ticket Number Format
Edit the `generate_ticket_number()` function in the migration file:
```sql
-- Current: TKT-000001
-- Change to: TICKET-2024-000001
NEW.ticket_number := 'TICKET-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(NEW.id::TEXT, 6, '0');
```

## 📞 Support

For questions or issues:
1. Review `TICKETING_DEPLOYMENT_GUIDE.md` for detailed information
2. Check backend logs: `docker logs automara-backend`
3. Check database: Verify tables exist and have data
4. Review API routes: `y:\backend\routes\tickets.js`
5. Review frontend code: `y:\frontend\src\pages\TicketsPage.jsx`

## 🎉 You're Ready!

The ticketing system is now live and integrated into your Automara portal. Users can start creating tickets immediately!

Key URLs:
- **Tickets Page**: `/tickets`
- **API Endpoint**: `/api/tickets`
- **Database Tables**: `tickets`, `ticket_comments`, `ticket_attachments`, `ticket_activity`, `ticket_categories`
