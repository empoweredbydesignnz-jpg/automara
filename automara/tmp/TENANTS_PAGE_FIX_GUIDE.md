# Automara Tenants Page Loading Issue - Fix Guide

## Problem
When logging in as global admin (admin@automara.com), the Tenants page shows a spinning loading wheel indefinitely.

## Root Causes Identified

### 1. **Missing Functions in TenantsPage.jsx**
The component was missing three critical functions:
- `handleManage()` - Opens the manage tenant modal
- `handleAddTenant()` - Handles tenant creation
- `handleUpdateTenant()` - Handles tenant updates

### 2. **Role Mapping Issue in Backend**
The backend middleware needs to map 'admin' role to 'global_admin' for backward compatibility.

### 3. **Missing Error Handling**
The frontend wasn't properly catching and displaying API errors.

## Solutions Applied

### Frontend Fix (TenantsPage.jsx)

**Location:** `frontend/src/pages/TenantsPage.jsx`

**Changes:**
1. Added missing `handleManage()` function
2. Added missing `handleAddTenant()` function  
3. Added missing `handleUpdateTenant()` function
4. Enhanced error handling with console logging
5. Added user-friendly error alerts

**Key Code Addition:**
```javascript
const handleManage = (tenant) => {
  setSelectedTenant(tenant)
  setShowManageModal(true)
}

const handleAddTenant = async (e) => {
  e.preventDefault()
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/tenants', newTenant, {
      headers: {
        'x-user-role': user?.role || 'client_user',
        'x-tenant-id': user?.tenantId || ''
      }
    })
    // ... success handling
  } catch (error) {
    console.error('Error adding tenant:', error)
    alert('Failed to create tenant: ' + (error.response?.data?.error || error.message))
  }
}
```

### Backend Fix (index.js)

**Location:** `backend/index.js`

**Changes:**
1. Added role mapping in tenants endpoint
2. Enhanced debugging logs
3. Added admin user auto-creation
4. Fixed middleware role handling

**Key Code Addition:**
```javascript
// Map 'admin' to 'global_admin' for backward compatibility
const effectiveRole = req.userRole === 'admin' ? 'global_admin' : req.userRole;

if (effectiveRole === 'global_admin') {
  // Global admin sees ALL tenants
  query = 'SELECT * FROM client_tenants WHERE parent_tenant_id IS NULL ORDER BY created_at DESC';
}
```

## Installation Steps

### 1. Update Frontend

```bash
# Navigate to frontend directory
cd /opt/automara/frontend/src/pages/

# Backup current file
cp TenantsPage.jsx TenantsPage.jsx.backup

# Replace with fixed version
cp /path/to/fixed/TenantsPage.jsx ./

# Rebuild frontend
cd /opt/automara/frontend
npm run build
docker-compose restart frontend
```

### 2. Update Backend

```bash
# Navigate to backend directory
cd /opt/automara/backend/

# Backup current file
cp index.js index.js.backup

# Replace with fixed version
cp /path/to/fixed/index.js ./

# Restart backend
docker-compose restart backend
```

### 3. Verify Database

Check that the admin user exists with correct role:

```sql
-- Connect to database
docker-compose exec postgres psql -U automara -d automara

-- Check admin user
SELECT id, email, role FROM users WHERE email = 'admin@automara.com';

-- If role is 'admin', update to 'global_admin'
UPDATE users SET role = 'global_admin' WHERE email = 'admin@automara.com';

-- Verify tenants table exists
SELECT * FROM client_tenants LIMIT 5;
```

## Testing Steps

### 1. Clear Browser Cache
```bash
# In browser console (F12)
localStorage.clear()
sessionStorage.clear()
location.reload()
```

### 2. Login as Admin
- URL: https://automara.empoweredbydesign.co.nz/login
- Email: admin@automara.com
- Password: admin123
- Tenant Domain: (leave empty for admin)

### 3. Navigate to Tenants
- Click "Tenants" in sidebar
- Should see tenant list or "No tenants" message
- Should NOT see infinite loading spinner

### 4. Check Browser Console
Open Developer Tools (F12) and check Console for:
- ✅ "Fetching tenants with role: global_admin"
- ✅ "Tenants response: {tenants: [...]}"
- ❌ No error messages

### 5. Check Backend Logs
```bash
docker-compose logs -f backend --tail=50
```

Look for:
- ✅ "=== TENANTS API DEBUG ==="
- ✅ "req.userRole: global_admin"
- ✅ "Query result rows: X"
- ❌ No error stack traces

## Common Issues & Solutions

### Issue 1: Still Seeing Loading Spinner

**Symptom:** Infinite loading wheel after applying fixes

**Solution:**
```bash
# Hard refresh browser
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)

# Clear all caches
docker-compose down
docker-compose up -d --force-recreate
```

### Issue 2: 403 Access Denied

**Symptom:** Error "Access denied - no tenant ID"

**Solution:**
```javascript
// Check localStorage in browser console
console.log(localStorage.getItem('user'))

// Should show role: 'global_admin' not 'admin'
// If wrong, logout and login again
```

### Issue 3: Database Connection Error

**Symptom:** "Failed to fetch tenants: Connection refused"

**Solution:**
```bash
# Check database is running
docker-compose ps postgres

# Restart if needed
docker-compose restart postgres

# Test connection
docker-compose exec backend node -e "console.log('Testing DB...')"
```

### Issue 4: CORS Errors

**Symptom:** "Access-Control-Allow-Origin" errors in console

**Solution:**
```javascript
// Check nginx config
cat /opt/automara/nginx/conf.d/automara.conf | grep CORS

// Restart nginx
docker-compose restart nginx
```

## Debugging Checklist

- [ ] Backend container is running: `docker-compose ps backend`
- [ ] Frontend container is running: `docker-compose ps frontend`
- [ ] Database is accessible: `docker-compose exec postgres psql -U automara -c "SELECT 1"`
- [ ] Admin user exists with role 'global_admin'
- [ ] Browser cache cleared
- [ ] No CORS errors in browser console
- [ ] Backend logs show no errors
- [ ] API endpoint responds: `curl http://localhost:4000/health`

## Prevention

To prevent similar issues in the future:

### 1. Add Error Boundaries
```javascript
// frontend/src/components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo)
    // Log to monitoring service
  }
}
```

### 2. Add API Response Validation
```javascript
const response = await axios.get('/api/tenants')
if (!response.data || !Array.isArray(response.data.tenants)) {
  throw new Error('Invalid API response')
}
```

### 3. Add Loading Timeout
```javascript
useEffect(() => {
  const timeout = setTimeout(() => {
    if (loading) {
      setError('Request timeout - please refresh')
      setLoading(false)
    }
  }, 10000) // 10 second timeout
  
  return () => clearTimeout(timeout)
}, [loading])
```

### 4. Implement Health Checks
```bash
# Add to docker-compose.yml
healthcheck:
  test: ["CMD", "wget", "--spider", "http://localhost:4000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Support

If issues persist:

1. **Check Logs:**
   ```bash
   docker-compose logs backend > backend.log
   docker-compose logs frontend > frontend.log
   ```

2. **Test API Directly:**
   ```bash
   curl -X GET http://localhost:4000/api/tenants \
     -H "x-user-role: global_admin"
   ```

3. **Verify Database:**
   ```sql
   SELECT COUNT(*) FROM client_tenants;
   SELECT COUNT(*) FROM users;
   ```

4. **Contact Support:**
   - Email: support@empoweredbydesign.co.nz
   - Include: logs, error messages, steps to reproduce

## Summary

The main issue was missing event handler functions in the TenantsPage component combined with role mapping inconsistencies in the backend. The fixes ensure:

- ✅ All required functions are defined
- ✅ Proper error handling and user feedback
- ✅ Role mapping works correctly
- ✅ Enhanced debugging capabilities
- ✅ Better user experience with loading states

After applying these fixes, the Tenants page should load correctly for global admin users.
