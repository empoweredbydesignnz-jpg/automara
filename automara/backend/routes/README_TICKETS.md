# Tickets API Documentation

## Overview

RESTful API for managing support tickets with multi-tenant isolation and role-based access control.

## Base URL
```
/api/tickets
```

## Authentication

All requests require the following headers:
```javascript
{
  'x-user-role': 'client_user' | 'client_admin' | 'msp_admin' | 'global_admin',
  'x-tenant-id': '<tenant_id>',
  'x-user-id': '<user_id>'
}
```

## Endpoints

### 1. List Tickets

**GET** `/api/tickets`

List all tickets accessible to the user based on their role.

**Query Parameters:**
- `status` (optional) - Filter by status: `open`, `in_progress`, `waiting_customer`, `waiting_internal`, `resolved`, `closed`
- `priority` (optional) - Filter by priority: `low`, `medium`, `high`, `urgent`
- `assigned_to` (optional) - Filter by assigned user ID
- `created_by` (optional) - Filter by creator user ID
- `category` (optional) - Filter by category name
- `search` (optional) - Search in subject, description, or ticket number

**Response:**
```json
{
  "success": true,
  "tickets": [
    {
      "id": 1,
      "tenant_id": 123,
      "ticket_number": "TKT-000001",
      "subject": "Cannot login to account",
      "description": "Getting error when trying to login",
      "status": "open",
      "priority": "high",
      "category": "Technical Support",
      "created_by": 456,
      "creator_email": "user@example.com",
      "creator_first_name": "John",
      "creator_last_name": "Doe",
      "assigned_to": null,
      "tenant_name": "Acme Corp",
      "comment_count": 3,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T14:20:00Z"
    }
  ],
  "count": 1
}
```

---

### 2. Get Ticket Statistics

**GET** `/api/tickets/stats`

Get aggregated statistics for tickets.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": "150",
    "open": "45",
    "in_progress": "30",
    "waiting_customer": "15",
    "waiting_internal": "10",
    "resolved": "25",
    "closed": "25",
    "urgent": "5",
    "high": "20",
    "medium": "80",
    "low": "45"
  }
}
```

---

### 3. Get Ticket Details

**GET** `/api/tickets/:id`

Get full details of a single ticket including comments, attachments, and activity log.

**Response:**
```json
{
  "success": true,
  "ticket": {
    "id": 1,
    "tenant_id": 123,
    "ticket_number": "TKT-000001",
    "subject": "Cannot login to account",
    "description": "Getting error when trying to login...",
    "status": "in_progress",
    "priority": "high",
    "category": "Technical Support",
    "created_by": 456,
    "creator_email": "user@example.com",
    "creator_first_name": "John",
    "creator_last_name": "Doe",
    "assigned_to": 789,
    "assignee_email": "support@example.com",
    "assignee_first_name": "Jane",
    "assignee_last_name": "Smith",
    "tenant_name": "Acme Corp",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T14:20:00Z",
    "resolved_at": null,
    "closed_at": null,
    "comments": [
      {
        "id": 1,
        "ticket_id": 1,
        "user_id": 789,
        "comment": "We are investigating this issue.",
        "is_internal": false,
        "user_email": "support@example.com",
        "user_first_name": "Jane",
        "user_last_name": "Smith",
        "user_role": "client_admin",
        "created_at": "2024-01-15T11:00:00Z"
      }
    ],
    "attachments": [],
    "activity": [
      {
        "id": 1,
        "ticket_id": 1,
        "user_id": 789,
        "action": "updated_status",
        "old_value": "open",
        "new_value": "in_progress",
        "user_email": "support@example.com",
        "user_first_name": "Jane",
        "user_last_name": "Smith",
        "created_at": "2024-01-15T11:00:00Z"
      }
    ]
  }
}
```

---

### 4. Create Ticket

**POST** `/api/tickets`

Create a new support ticket.

**Request Body:**
```json
{
  "subject": "Cannot login to account",
  "description": "Getting error 'Invalid credentials' when trying to login",
  "priority": "high",
  "category": "Technical Support",
  "assigned_to": 789  // Optional
}
```

**Required Fields:**
- `subject` (string, max 255 chars)
- `description` (text)

**Optional Fields:**
- `priority` (string) - Default: `medium`
- `category` (string)
- `assigned_to` (integer) - User ID

**Response:**
```json
{
  "success": true,
  "ticket": {
    "id": 1,
    "tenant_id": 123,
    "ticket_number": "TKT-000001",
    "subject": "Cannot login to account",
    "description": "Getting error...",
    "status": "open",
    "priority": "high",
    "category": "Technical Support",
    "created_by": 456,
    "assigned_to": null,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 5. Update Ticket

**PATCH** `/api/tickets/:id`

Update ticket properties. All fields are optional.

**Request Body:**
```json
{
  "subject": "Updated subject",
  "description": "Updated description",
  "status": "in_progress",
  "priority": "urgent",
  "category": "Technical Support",
  "assigned_to": 789
}
```

**Status Options:**
- `open`
- `in_progress`
- `waiting_customer`
- `waiting_internal`
- `resolved`
- `closed`

**Priority Options:**
- `low`
- `medium`
- `high`
- `urgent`

**Response:**
```json
{
  "success": true,
  "ticket": {
    // Updated ticket object
  }
}
```

**Notes:**
- Changing status to `resolved` automatically sets `resolved_at` timestamp
- Changing status to `closed` automatically sets `closed_at` timestamp
- All changes are logged in the activity table

---

### 6. Delete Ticket

**DELETE** `/api/tickets/:id`

Delete a ticket (admin only).

**Required Roles:** `global_admin`, `client_admin`, `msp_admin`

**Response:**
```json
{
  "success": true,
  "message": "Ticket deleted successfully"
}
```

**Notes:**
- Cascade deletes all comments, attachments, and activity logs
- Only admins can delete tickets
- Tenants can only delete their own tickets

---

### 7. Add Comment

**POST** `/api/tickets/:id/comments`

Add a comment to a ticket.

**Request Body:**
```json
{
  "comment": "We have identified the issue and are working on a fix.",
  "is_internal": false  // Optional, default: false
}
```

**Required Fields:**
- `comment` (text)

**Optional Fields:**
- `is_internal` (boolean) - If true, comment is only visible to internal users

**Response:**
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "ticket_id": 1,
    "user_id": 789,
    "comment": "We have identified the issue...",
    "is_internal": false,
    "created_at": "2024-01-15T11:00:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

**Notes:**
- Adding a comment updates the ticket's `updated_at` timestamp
- Activity log entry is created automatically

---

### 8. Get Categories

**GET** `/api/tickets/categories/list`

Get available ticket categories for the current tenant.

**Response:**
```json
{
  "success": true,
  "categories": [
    {
      "id": 1,
      "tenant_id": null,
      "name": "Technical Support",
      "description": "Technical issues and troubleshooting",
      "color": "#3b82f6",
      "is_global": true,
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": 7,
      "tenant_id": 123,
      "name": "VIP Support",
      "description": "Priority support for VIP customers",
      "color": "#ff0000",
      "is_global": false,
      "created_at": "2024-01-15T00:00:00Z"
    }
  ]
}
```

**Notes:**
- Returns global categories (available to all tenants)
- Returns tenant-specific categories (only visible to that tenant)

---

## Role-Based Access Control

### Client User
- Can view tickets where `created_by = user_id` OR `tenant_id = user_tenant_id`
- Can create tickets for their tenant
- Can add comments
- Cannot update status/priority
- Cannot delete tickets

### Client Admin / MSP Admin
- Can view tickets for their tenant and sub-tenants
- Can create tickets
- Can update status, priority, assignment
- Can add internal notes
- Can delete tickets (within their tenant scope)

### Global Admin
- Can view ALL tickets across ALL tenants
- Full CRUD permissions
- Can specify tenant when creating tickets
- Can manage all ticket properties

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Subject and description are required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Permission denied"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Ticket not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to fetch tickets"
}
```

---

## Activity Logging

All ticket modifications are automatically logged in the `ticket_activity` table:

**Actions Logged:**
- `created` - Ticket created
- `updated_status` - Status changed
- `updated_priority` - Priority changed
- `updated_subject` - Subject changed
- `updated_category` - Category changed
- `assigned` - Ticket assigned/unassigned
- `added_comment` - Comment added

**Activity Log Format:**
```json
{
  "id": 1,
  "ticket_id": 1,
  "user_id": 789,
  "action": "updated_status",
  "old_value": "open",
  "new_value": "in_progress",
  "created_at": "2024-01-15T11:00:00Z"
}
```

---

## Database Schema

### Tickets Table
```sql
CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES client_tenants(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'open',
  priority VARCHAR(50) DEFAULT 'medium',
  category VARCHAR(100),
  ticket_number VARCHAR(50) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP
);
```

### Indexes
- `idx_tickets_tenant` - Fast tenant filtering
- `idx_tickets_status` - Fast status filtering
- `idx_tickets_priority` - Fast priority filtering
- `idx_tickets_created_at` - Fast date sorting
- `idx_tickets_number` - Fast ticket number lookup

---

## Performance Considerations

1. **Pagination**: Not currently implemented. For large datasets, add LIMIT/OFFSET to queries.
2. **Indexes**: All critical fields are indexed for fast lookups.
3. **Tenant Filtering**: Applied at query level, not post-fetch.
4. **Activity Logging**: Async (fire-and-forget), doesn't block API responses.

---

## Example Usage (JavaScript)

```javascript
// Create ticket
const ticket = await axios.post('/api/tickets', {
  subject: 'Cannot access dashboard',
  description: 'Getting 404 error when accessing /dashboard',
  priority: 'high',
  category: 'Technical Support'
}, {
  headers: {
    'x-user-role': 'client_user',
    'x-tenant-id': '123',
    'x-user-id': '456'
  }
});

// Get tickets with filters
const tickets = await axios.get('/api/tickets', {
  params: {
    status: 'open',
    priority: 'high'
  },
  headers: {
    'x-user-role': 'client_admin',
    'x-tenant-id': '123',
    'x-user-id': '456'
  }
});

// Update ticket status
await axios.patch('/api/tickets/1', {
  status: 'resolved'
}, {
  headers: {
    'x-user-role': 'client_admin',
    'x-tenant-id': '123',
    'x-user-id': '456'
  }
});

// Add comment
await axios.post('/api/tickets/1/comments', {
  comment: 'Issue has been resolved. Please verify.',
  is_internal: false
}, {
  headers: {
    'x-user-role': 'client_admin',
    'x-tenant-id': '123',
    'x-user-id': '456'
  }
});
```

---

## Testing

Use the provided test scripts or manually test with curl:

```bash
# Create ticket
curl -X POST http://localhost:4000/api/tickets \
  -H "Content-Type: application/json" \
  -H "x-user-role: client_user" \
  -H "x-tenant-id: 1" \
  -H "x-user-id: 1" \
  -d '{
    "subject": "Test Ticket",
    "description": "This is a test",
    "priority": "medium"
  }'

# Get tickets
curl -X GET "http://localhost:4000/api/tickets?status=open" \
  -H "x-user-role: global_admin" \
  -H "x-tenant-id: 1" \
  -H "x-user-id: 1"

# Update ticket
curl -X PATCH http://localhost:4000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -H "x-user-role: client_admin" \
  -H "x-tenant-id: 1" \
  -H "x-user-id: 1" \
  -d '{"status": "in_progress"}'
```
