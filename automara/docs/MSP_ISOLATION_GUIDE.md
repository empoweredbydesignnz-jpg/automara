# Multi-MSP Tenant Isolation Guide

## Overview

Automara now supports a **nested multi-MSP architecture** with **strict tenant isolation**. This means:

- Multiple MSPs (Managed Service Providers) can join the platform
- Each MSP can manage their own clients (sub-tenants)
- **HARD ISOLATION**: MSPs cannot see or access any other MSP's clients or data
- Global administrators can see and manage everything across all MSPs

## Architecture

### Hierarchy Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    GLOBAL ADMIN                              │
│                  (Platform Operator)                         │
│                  Can see: EVERYTHING                         │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                     ┌───────▼────────┐
│   MSP 1        │                     │   MSP 2        │
│   (msp_root)   │                     │   (msp_root)   │
│ tenant_type: msp│                    │ tenant_type: msp│
└───────┬────────┘                     └───────┬────────┘
        │                                      │
    ┌───┴────┬─────────┐                  ┌───┴────┬─────────┐
    │        │         │                  │        │         │
┌───▼──┐ ┌──▼──┐ ┌───▼──┐           ┌───▼──┐ ┌──▼──┐ ┌───▼──┐
│Client│ │Client│ │Client│           │Client│ │Client│ │Client│
│  A   │ │  B   │ │  C   │           │  D   │ │  E   │ │  F   │
└──────┘ └─────┘ └──────┘           └──────┘ └─────┘ └──────┘

MSP 1 Admin:                         MSP 2 Admin:
✓ Can see: MSP 1 + Clients A, B, C  ✓ Can see: MSP 2 + Clients D, E, F
✗ CANNOT see: MSP 2 or Clients D,E,F ✗ CANNOT see: MSP 1 or Clients A,B,C
```

## Database Schema

### Key Tables

#### `client_tenants`
```sql
CREATE TABLE client_tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',

    -- MSP Hierarchy Fields
    tenant_type VARCHAR(50) DEFAULT 'client',    -- 'msp', 'sub_tenant', 'client'
    parent_tenant_id INT REFERENCES client_tenants(id),
    msp_root_id INT REFERENCES client_tenants(id),  -- Key for isolation!

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Key Field Explanations

- **`tenant_type`**: Identifies the type of tenant
  - `'msp'`: Top-level MSP that can manage sub-tenants
  - `'sub_tenant'`: Client managed by an MSP
  - `'client'`: Standalone tenant (not part of MSP)

- **`parent_tenant_id`**: Points to the immediate parent tenant
  - `NULL` for top-level MSPs and standalone clients
  - Set to MSP's ID for sub-tenants

- **`msp_root_id`**: **CRITICAL FOR ISOLATION**
  - Points to the root MSP that owns this entire hierarchy
  - For MSPs: points to themselves (`msp_root_id = id`)
  - For sub-tenants: points to their MSP root
  - Automatically set via database trigger

### Indexes for Performance

```sql
CREATE INDEX idx_client_tenants_msp_root_id ON client_tenants(msp_root_id);
CREATE INDEX idx_client_tenants_parent_id ON client_tenants(parent_tenant_id);
CREATE INDEX idx_client_tenants_tenant_type ON client_tenants(tenant_type);
```

## User Roles

### 1. Global Admin (`global_admin`)
- **Scope**: Entire platform
- **Can see**: All MSPs and all tenants across all hierarchies
- **Can do**:
  - Create/edit/delete any tenant
  - Convert tenants to MSP type
  - Manage all users
  - Change tenant types
  - Suspend/activate any account

### 2. Client Admin (`client_admin`)
- **Scope**: Their MSP hierarchy only
- **Can see**: Only tenants where `msp_root_id` matches their MSP root
- **Can do**:
  - View their MSP and all sub-tenants under it
  - Create sub-tenants (if they are MSP type)
  - Manage users within their MSP hierarchy
  - Edit tenant information within their hierarchy
  - **CANNOT**:
    - See other MSPs or their clients
    - Assign `global_admin` role
    - Access data from other MSP hierarchies

### 3. Client User (`client_user`)
- **Scope**: Their tenant only
- **Can see**: Only their own tenant
- **Can do**:
  - View their tenant information
  - Manage their own profile
  - Use workflows and features within their tenant

## API Endpoints

### Tenant Management

#### GET `/api/tenants`
Returns tenants based on user role with STRICT MSP isolation.

**Headers:**
```
x-user-role: global_admin | client_admin | client_user
x-tenant-id: <tenant_id>
```

**Response (Global Admin):**
```json
{
  "tenants": [
    {
      "id": 1,
      "name": "MSP 1",
      "tenant_type": "msp",
      "msp_root_id": 1,
      "sub_tenant_count": 3,
      "user_count": 15
    },
    {
      "id": 2,
      "name": "Client A (under MSP 1)",
      "tenant_type": "sub_tenant",
      "parent_tenant_id": 1,
      "msp_root_id": 1
    }
  ]
}
```

**Isolation Logic:**
- **Global Admin**: `SELECT * FROM client_tenants` (all tenants)
- **Client Admin**: `SELECT * WHERE msp_root_id = <their_msp_root_id>`
- **Client User**: `SELECT * WHERE id = <their_tenant_id>`

#### POST `/api/tenants/:parentId/sub-tenants`
Create a new sub-tenant under an MSP.

**Requirements:**
- Parent must be `tenant_type = 'msp'`
- User must be global_admin OR client_admin of the same MSP hierarchy

**Request:**
```json
{
  "name": "New Client",
  "domain": "client.msp.automara.com",
  "owner_email": "admin@client.com"
}
```

**Security Check:**
```javascript
// Verify user's msp_root_id matches parent's msp_root_id
const userMspRoot = getUserMspRoot(req.tenantId);
const parentMspRoot = getParentMspRoot(parentId);

if (userMspRoot !== parentMspRoot) {
    return 403; // Cannot create sub-tenants for other MSPs
}
```

#### POST `/api/tenants/:id/convert-to-msp`
Convert a standalone tenant to MSP type (Global Admin only).

**Requirements:**
- User must be `global_admin`
- Tenant must not be a sub-tenant (no `parent_tenant_id`)
- Tenant must not already be MSP

**Effect:**
```sql
UPDATE client_tenants
SET tenant_type = 'msp', msp_root_id = id
WHERE id = :id
```

### MSP Statistics

#### GET `/api/msp/stats`
Get statistics for MSPs.

**Global Admin Response:**
```json
{
  "stats": [
    {
      "msp_id": 1,
      "msp_name": "Stratus Blue IT",
      "total_clients": 5,
      "total_users": 24,
      "active_users": 20
    },
    {
      "msp_id": 4,
      "msp_name": "TechCorp MSP",
      "total_clients": 3,
      "total_users": 15,
      "active_users": 12
    }
  ]
}
```

**Client Admin Response:**
```json
{
  "stats": [
    {
      "msp_id": 1,
      "msp_name": "Stratus Blue IT",
      "total_clients": 5,
      "total_users": 24,
      "active_users": 20
    }
  ]
}
```

#### GET `/api/msp/hierarchy`
Get the hierarchical tree of tenants.

**Response:**
```json
{
  "hierarchy": [
    {
      "id": 1,
      "name": "MSP 1",
      "level": 0,
      "parent_tenant_id": null,
      "msp_root_id": 1
    },
    {
      "id": 2,
      "name": "Client A",
      "level": 1,
      "parent_tenant_id": 1,
      "msp_root_id": 1
    }
  ]
}
```

### User Management

#### GET `/api/users`
Returns users with STRICT MSP isolation.

**Isolation Logic:**
- **Global Admin**: All users across all tenants
- **Client Admin**: Only users where their tenant's `msp_root_id` matches
  ```sql
  SELECT u.* FROM users u
  JOIN client_tenants t ON u.tenant_id = t.id
  WHERE t.msp_root_id = <user_msp_root_id>
  ```

## Frontend UI

### Tenant Display

The frontend groups tenants by MSP hierarchy:

```jsx
// Tenants are displayed as:
[MSP Card - Large, prominent]
  └─ [Client Card] [Client Card] [Client Card]

// MSPs show:
- Name, domain, status
- Number of clients
- Number of users
- "Add Client" button (if MSP type)
- "Manage" button

// Sub-tenants show:
- Name, domain, status
- Owner email
- User count
- "Manage" button
- Left border indicator (visual hierarchy)
```

### Convert to MSP

Global admins see a "Convert to MSP" button in the tenant management modal:

```jsx
// Visible only if:
- User is global_admin
- Tenant is NOT already MSP
- Tenant has NO parent (not a sub-tenant)

// Effect:
- Changes tenant_type to 'msp'
- Enables "Add Client" functionality
- Sets msp_root_id to self
```

## Security Guarantees

### 1. Database-Level Isolation

All queries use `msp_root_id` to enforce boundaries:

```sql
-- Client Admin Query
SELECT * FROM client_tenants
WHERE msp_root_id = <their_msp_root_id>
```

This ensures MSP A **cannot** see MSP B's data, even if they manipulate API requests.

### 2. Automatic Trigger Protection

The `set_msp_root_id()` trigger automatically sets the correct `msp_root_id`:

```sql
-- When creating a sub-tenant under MSP 1:
INSERT INTO client_tenants (name, parent_tenant_id)
VALUES ('Client X', 1);

-- Trigger automatically sets:
-- msp_root_id = 1 (inherited from parent)
```

### 3. API-Level Validation

Before creating sub-tenants, the API verifies:

```javascript
// 1. Parent is MSP type
if (parent.tenant_type !== 'msp') return 403;

// 2. User's MSP root matches parent's MSP root
if (user.msp_root_id !== parent.msp_root_id) return 403;
```

### 4. Cross-MSP Access Prevention

Users from MSP A trying to access MSP B's resources:

```javascript
// Check: can_user_access_tenant(user_role, user_tenant_id, target_tenant_id)
const userMspRoot = getUserMspRoot(user_tenant_id);    // MSP A
const targetMspRoot = getTenantMspRoot(target_tenant_id); // MSP B

if (userMspRoot !== targetMspRoot) {
    return 403; // Blocked!
}
```

## Migration Guide

### For New Installations

1. Run the schema creation script:
   ```bash
   psql -U automara -d automara -f scripts/init-msp-schema.sql
   ```

2. Restart the backend:
   ```bash
   cd backend && npm start
   ```

3. Access the UI and create your first MSP

### For Existing Installations

1. **BACKUP YOUR DATABASE FIRST!**
   ```bash
   pg_dump -U automara automara > backup_$(date +%Y%m%d).sql
   ```

2. Run the migration script:
   ```bash
   psql -U automara -d automara -f scripts/migrate-to-msp.sql
   ```

3. Verify migration:
   ```sql
   -- Check all tenants have msp_root_id
   SELECT id, name, msp_root_id, tenant_type, parent_tenant_id
   FROM client_tenants;
   ```

4. Restart backend server

5. Test isolation:
   - Login as MSP A admin
   - Verify you CANNOT see MSP B's tenants
   - Login as global admin
   - Verify you CAN see all MSPs

## Testing MSP Isolation

### Test Scenario 1: MSP A Cannot See MSP B

1. Create MSP A (Stratus Blue IT)
2. Create Client A1 under MSP A
3. Create MSP B (TechCorp)
4. Create Client B1 under MSP B
5. Login as MSP A admin
6. Navigate to Tenants page
7. **Expected**: See only MSP A and Client A1
8. **Expected**: Do NOT see MSP B or Client B1

### Test Scenario 2: Global Admin Sees Everything

1. Login as global admin (admin@automara.com)
2. Navigate to Tenants page
3. **Expected**: See all MSPs and all clients across all hierarchies

### Test Scenario 3: User Management Isolation

1. Login as MSP A admin
2. Navigate to Users page
3. **Expected**: See only users from MSP A and its sub-tenants
4. **Expected**: Do NOT see users from MSP B

### Test Scenario 4: Cannot Create Cross-MSP Sub-Tenants

1. Login as MSP A admin
2. Try to POST to `/api/tenants/<MSP_B_ID>/sub-tenants`
3. **Expected**: 403 Forbidden error

## Troubleshooting

### Issue: MSP Admin Sees Other MSPs

**Cause**: `msp_root_id` not set correctly

**Fix**:
```sql
-- Re-run msp_root_id population
UPDATE client_tenants
SET msp_root_id = id
WHERE parent_tenant_id IS NULL;

UPDATE client_tenants t
SET msp_root_id = (
    SELECT COALESCE(p.msp_root_id, p.id)
    FROM client_tenants p
    WHERE p.id = t.parent_tenant_id
)
WHERE t.parent_tenant_id IS NOT NULL;
```

### Issue: Cannot Create Sub-Tenants

**Cause**: Parent is not MSP type

**Fix**:
```sql
-- Convert tenant to MSP
UPDATE client_tenants
SET tenant_type = 'msp', msp_root_id = id
WHERE id = <tenant_id>;
```

Or use the UI: Global Admin → Manage Tenant → Convert to MSP

### Issue: Trigger Not Working

**Cause**: Trigger not created

**Fix**:
```bash
psql -U automara -d automara -f scripts/init-msp-schema.sql
```

## Best Practices

1. **Always use `msp_root_id` for isolation queries**
   ```sql
   WHERE msp_root_id = <user_msp_root>
   ```

2. **Validate MSP boundaries in all endpoints**
   ```javascript
   if (!canUserAccessTenant(userRole, userTenantId, targetTenantId)) {
       return 403;
   }
   ```

3. **Use database triggers for automatic msp_root_id management**
   - Never manually set `msp_root_id` in application code
   - Let the trigger handle it

4. **Index msp_root_id for performance**
   ```sql
   CREATE INDEX idx_msp_root ON client_tenants(msp_root_id);
   ```

5. **Audit logs should include msp_root_id**
   ```sql
   INSERT INTO audit_log (user_id, tenant_id, msp_root_id, action)
   VALUES ($1, $2, $3, $4);
   ```

## Security Considerations

1. **Never trust client-side role/tenant information**
   - Always verify on backend
   - Use JWT claims for user context

2. **Prevent privilege escalation**
   - Client admins cannot assign `global_admin` role
   - Users cannot change their own tenant_id

3. **Protect cascade deletes**
   - Deleting an MSP deletes all sub-tenants
   - Add confirmation prompts for MSP deletion

4. **Rate limiting**
   - Apply rate limits per MSP
   - Prevent one MSP from DoS-ing the platform

5. **Audit all cross-tenant operations**
   - Log when global admin accesses MSP data
   - Alert on suspicious access patterns

## API Reference Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/tenants` | GET | All Admins | List tenants (MSP-isolated) |
| `/api/tenants` | POST | Global Admin | Create tenant |
| `/api/tenants/:id` | PUT | Admin | Update tenant |
| `/api/tenants/:id` | DELETE | Admin | Delete tenant |
| `/api/tenants/:id/status` | PATCH | Admin | Change tenant status |
| `/api/tenants/:parentId/sub-tenants` | POST | Admin | Create sub-tenant |
| `/api/tenants/:id/convert-to-msp` | POST | Global Admin | Convert to MSP |
| `/api/tenants/:id/type` | PATCH | Global Admin | Change tenant type |
| `/api/users` | GET | Admin | List users (MSP-isolated) |
| `/api/users/:id/role` | PATCH | Admin | Change user role |
| `/api/msp/stats` | GET | Admin | Get MSP statistics |
| `/api/msp/hierarchy` | GET | Admin | Get hierarchy tree |

## Support

For issues or questions:
- GitHub Issues: https://github.com/empoweredbydesignnz-jpg/automara/issues
- Documentation: https://docs.automara.com

---

**Version**: 1.0.0
**Last Updated**: 2025-11-05
**Author**: Automara Development Team
