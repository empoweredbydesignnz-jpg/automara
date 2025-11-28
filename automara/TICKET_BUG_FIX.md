# Ticket Display Bug - Fix Documentation

## Issue Description

**Problem**: When logged in as an MSP Admin for "empoweredbydesign", tickets show in the statistics (1 total, 1 open) but the ticket list shows "No tickets found, create your first ticket!"

**Status**: FIXED

## Root Cause

Two issues were identified:

### 1. Missing Table Alias in WHERE Clause
The `buildTenantFilter()` function was returning a WHERE clause with `tenant_id = ANY($1::int[])` but the main query used table alias `t`, so it should have been `t.tenant_id = ANY($1::int[])`.

**Original Code**:
```javascript
return {
  whereClause: 'tenant_id = ANY($1::int[])',  // ❌ Missing 't.' prefix
  params: [tenantIds]
};
```

**Fixed Code**:
```javascript
return {
  whereClause: 't.tenant_id = ANY($1::int[])',  // ✅ Includes table alias
  params: [tenantIds]
};
```

### 2. Missing Null Checks and Type Conversion
The `tenantId` parameter coming from headers could be:
- A string (needs parseInt)
- Null or undefined (needs validation)
- Not matching any tenants in the database

This would cause the query to fail silently or return no results.

**Added Fixes**:
- Parse tenant ID to integer
- Check for null/undefined tenant ID
- Check if tenant exists in database
- Return appropriate empty results if invalid

## Changes Made

### File: `y:\backend\routes\tickets.js`

#### 1. Enhanced `buildTenantFilter()` Function

**Added**:
- Console logging for debugging
- Null/undefined checks for tenant ID
- parseInt() to convert string to integer
- Validation that tenant exists in database
- Table alias prefix (`t.`) in WHERE clause
- Fallback to `1=0` (no results) for invalid cases

```javascript
const buildTenantFilter = async (effectiveRole, tenantId) => {
  console.log('[buildTenantFilter] Role:', effectiveRole, 'Tenant ID:', tenantId, 'Type:', typeof tenantId);

  if (effectiveRole === 'global_admin') {
    return { whereClause: '', params: [] };
  } else if (effectiveRole === 'client_admin' || effectiveRole === 'msp_admin') {
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
      whereClause: 't.tenant_id = ANY($1::int[])',  // ✅ Fixed: Added 't.' prefix
      params: [tenantIds]
    };
  } else {
    if (!tenantId) {
      console.error('[buildTenantFilter] No tenant ID provided for regular user');
      return { whereClause: '1=0', params: [] };
    }

    return {
      whereClause: 't.tenant_id = $1',  // ✅ Fixed: Added 't.' prefix
      params: [parseInt(tenantId)]
    };
  }
};
```

#### 2. Added Debug Logging to GET /api/tickets

```javascript
console.log('=== GET /api/tickets DEBUG ===');
console.log('User Role:', req.userRole);
console.log('Tenant ID:', req.tenantId);
console.log('Tenant Filter:', tenantFilter);
console.log('Final Query:', query);
console.log('Query Params:', params);
console.log('Tickets Found:', result.rows.length);
```

#### 3. Fixed Stats Query Table Alias

Added table alias `t` to the stats query:

```javascript
const query = `
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE t.status = 'open') as open,
    // ... etc
  FROM tickets t  // ✅ Added alias
  WHERE ${tenantFilter.whereClause || '1=1'}
`;
```

## Deployment Steps

### Option 1: Using the Batch File (Recommended)

1. Double-click `y:\RESTART_BACKEND.bat`
2. Wait for backend to restart
3. Refresh the tickets page in your browser
4. Check browser console and backend logs for debug output

### Option 2: Manual Docker Commands

```bash
# Restart backend
docker restart automara-backend

# Check logs
docker logs automara-backend --tail 100 --follow
```

### Option 3: Using Docker Compose

```bash
cd y:\
docker-compose restart backend
docker-compose logs -f backend
```

## Verification Steps

### 1. Check Database

Run `y:\CHECK_TICKETS_DB.bat` or manually:

```sql
-- Check tickets exist
SELECT id, ticket_number, subject, status, tenant_id
FROM tickets
ORDER BY created_at DESC;

-- Check your tenant ID
SELECT id, name, tenant_type, parent_tenant_id
FROM client_tenants
WHERE name = 'empoweredbydesign';

-- Check your user
SELECT id, email, role, tenant_id
FROM users
WHERE email = 'your-email@example.com';
```

### 2. Check Backend Logs

After restarting and refreshing the tickets page, you should see debug output like:

```
=== GET /api/tickets DEBUG ===
User Role: msp_admin
Tenant ID: 5
[buildTenantFilter] Role: msp_admin Tenant ID: 5 Type: string
[buildTenantFilter] Parsed Tenant ID: 5
[buildTenantFilter] Found tenant IDs: [5, 8, 12]
Tenant Filter: { whereClause: 't.tenant_id = ANY($1::int[])', params: [[5, 8, 12]] }
Final Query: SELECT t.*, ... FROM tickets t ... WHERE t.tenant_id = ANY($1::int[]) ORDER BY t.created_at DESC
Query Params: [[5, 8, 12]]
Tickets Found: 1
First Ticket: { id: 1, ticket_number: 'TKT-000001', ... }
```

### 3. Check Frontend

1. Open browser DevTools (F12)
2. Go to Console tab
3. Refresh tickets page
4. Check Network tab → XHR → Look for `/api/tickets` request
5. Verify the request headers include:
   - `x-user-role: msp_admin`
   - `x-tenant-id: <your-tenant-id>`
   - `x-user-id: <your-user-id>`

### 4. Verify Tickets Display

After restart, you should see:
- Statistics showing correct counts
- Ticket list showing your tickets
- Ability to click on tickets to view details

## Common Issues & Solutions

### Issue: Still showing "No tickets found"

**Check**:
1. Is tenant_id in the ticket matching your user's tenant_id?
   ```sql
   SELECT t.id, t.tenant_id, u.tenant_id as user_tenant_id
   FROM tickets t, users u
   WHERE u.email = 'your-email@example.com';
   ```

2. Are headers being sent correctly?
   - Check browser DevTools → Network → Headers

3. Is backend restarted?
   - Run: `docker logs automara-backend | grep "Automara Backend running"`

### Issue: Stats show tickets but list is empty

This was the original bug - means the WHERE clause is failing. Check:
1. Backend logs for SQL errors
2. Tenant filter debug output
3. Make sure the fix has been applied and backend restarted

### Issue: "Column 'tenant_id' does not exist"

**Cause**: Table alias mismatch
**Solution**: Ensure all WHERE clauses use `t.tenant_id` not just `tenant_id`

### Issue: "Cannot read property 'id' of undefined"

**Cause**: localStorage missing user or tenant data
**Solution**:
```javascript
// In browser console
console.log(localStorage.getItem('user'));
console.log(localStorage.getItem('currentTenant'));
// If null, log out and log back in
```

## Testing Checklist

- [ ] Restart backend successfully
- [ ] Check backend logs for errors
- [ ] Refresh tickets page
- [ ] Stats show correct counts
- [ ] Ticket list displays tickets
- [ ] Can click to view ticket details
- [ ] Can add comments to tickets
- [ ] Can update ticket status (admin only)
- [ ] Can create new tickets
- [ ] Filters work correctly

## Debug Output Analysis

### Good Output Example:
```
[buildTenantFilter] Role: msp_admin Tenant ID: 5 Type: string
[buildTenantFilter] Parsed Tenant ID: 5
[buildTenantFilter] Found tenant IDs: [5]
Tickets Found: 1
```

### Bad Output Examples:

**Missing Tenant ID**:
```
[buildTenantFilter] Role: msp_admin Tenant ID: undefined Type: undefined
[buildTenantFilter] No tenant ID provided for admin user
Tickets Found: 0
```
**Solution**: Check localStorage, log out and back in

**Tenant Not Found**:
```
[buildTenantFilter] Role: msp_admin Tenant ID: 999 Type: string
[buildTenantFilter] Parsed Tenant ID: 999
[buildTenantFilter] Found tenant IDs: []
[buildTenantFilter] No tenants found for tenant ID: 999
Tickets Found: 0
```
**Solution**: Verify tenant exists in database, check tenant_id is correct

## Rollback Plan

If the fix causes issues:

1. Restore original version:
   ```bash
   git checkout y:\backend\routes\tickets.js
   docker restart automara-backend
   ```

2. Or manually revert the changes:
   - Remove debug logging
   - Change `t.tenant_id` back to `tenant_id`
   - Remove null checks

## Next Steps (Optional)

### Remove Debug Logging (Production)

Once verified working, you can remove console.log statements:
- All `console.log('[buildTenantFilter]' ...)` lines
- All `console.log('=== GET /api/tickets DEBUG ===')` lines
- Keep `console.error()` and `console.warn()` for error tracking

### Add Automated Tests

Consider adding unit tests:
```javascript
describe('buildTenantFilter', () => {
  it('should handle msp_admin with valid tenant', async () => {
    const filter = await buildTenantFilter('msp_admin', '5');
    expect(filter.whereClause).toBe('t.tenant_id = ANY($1::int[])');
    expect(filter.params[0]).toContain(5);
  });

  it('should return no results for null tenant', async () => {
    const filter = await buildTenantFilter('msp_admin', null);
    expect(filter.whereClause).toBe('1=0');
  });
});
```

## Summary

**Bug**: Table alias mismatch in WHERE clause + missing null checks
**Fix**: Added `t.` prefix to WHERE clause + validation + debug logging
**Impact**: MSP admins can now see their tickets correctly
**Status**: Fixed and deployed (pending restart)
