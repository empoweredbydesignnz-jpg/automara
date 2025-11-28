# Testing Error Messages Display

## Issue
Error messages from n8n are not showing in the error modal.

## Debugging Steps

### Step 1: Check Backend Logs

The backend now has comprehensive logging. Check the Docker logs to see what's being extracted:

```bash
docker logs -f automara-backend --tail=100
```

**Look for these log entries**:
```
[ERROR EXTRACTION] Execution ID: 12345
[ERROR EXTRACTION] Full exec.data structure: {...}
[SOURCE 1] Found error in resultData.error: {...}
[ERROR FINAL] Extracted error details: { message: '...', node: '...', ... }
```

### Step 2: Trigger a Test Error

1. **Go to n8n** (http://localhost:5678)
2. **Create a simple workflow** with a node that will fail:
   - Add an HTTP Request node
   - Set URL to: `http://invalid-domain-that-does-not-exist.com`
   - Or add a node without credentials (e.g., Facebook, Twitter)
3. **Activate the workflow**
4. **Execute the workflow** (manually or via trigger)
5. **Wait for execution to fail**

### Step 3: Check API Response

Open browser console (F12) and run:

```javascript
// Get user info
const user = JSON.parse(localStorage.getItem('user'));

// Fetch executions for a workflow (replace ID)
fetch('/api/workflows/1/executions?limit=1', {
  headers: {
    'x-user-role': user.role,
    'x-tenant-id': user.tenantId,
    'x-user-id': user.id
  }
})
.then(r => r.json())
.then(data => {
  console.log('API Response:', data);
  if (data.executions && data.executions[0]) {
    console.log('Error object:', data.executions[0].error);
  }
});
```

**Expected output**:
```json
{
  "success": true,
  "executions": [
    {
      "id": "12345",
      "status": "error",
      "error": {
        "message": "Problem in node 'Facebook Create a post'\nnode does not have any credentials set",
        "node": "Facebook Create a post",
        "type": "NodeOperationError",
        "description": null,
        "stack": "...",
        "timestamp": "2024-01-15T10:30:05.000Z",
        "lastNodeExecuted": "Facebook Create a post"
      }
    }
  ]
}
```

### Step 4: Check Frontend State

In browser console, check if the error is being stored:

```javascript
// This won't work directly, but you can add console.log in the code
// Or check React DevTools
```

### Step 5: Verify Modal Display

1. **Navigate to Dashboard**
2. **Find workflow with error**
3. **Click "Error Detected" button**
4. **Modal should open**
5. **Check what's displayed in the error section**

## Common Issues

### Issue 1: Backend not extracting error

**Symptoms**:
- Logs show: `[ERROR FINAL] Extracted error details: { message: 'Workflow execution failed', ... }`
- Error message is still generic

**Solution**:
Check the full exec.data structure in logs. n8n might be storing the error in a different location.

Example log to look for:
```
[ERROR EXTRACTION] Full exec.data structure: {
  "resultData": {
    "error": {...}  ← Look here
  }
}
```

### Issue 2: API not returning error object

**Symptoms**:
- API response shows `error: null`

**Solution**:
- Check backend logs for extraction errors
- Verify n8n execution actually has error data
- Check n8n API response in backend logs

### Issue 3: Frontend not displaying error

**Symptoms**:
- API returns correct error object
- Modal shows "Error Message" section but it's empty or shows "Workflow execution failed"

**Solution**:
Check the frontend code is accessing the right property:

```javascript
// In Dashboard.jsx
{selectedError.execution.error.message}  // ← This should show the message
```

## Quick Test Command

Run this in your terminal to check a specific execution:

```bash
# Get workflow ID from database
docker exec -it automara-postgres psql -U automara -d automara -c "SELECT id, name, n8n_workflow_id FROM workflows WHERE active = true LIMIT 5;"

# Check backend API (replace :id with workflow ID)
docker exec automara-backend curl -H "x-user-role: global_admin" -H "x-tenant-id: 1" -H "x-user-id: 1" http://localhost:4000/api/workflows/1/executions?limit=1
```

## Manual Verification

### Check n8n directly

1. Go to n8n UI: http://localhost:5678
2. Go to Executions tab
3. Find a failed execution
4. Click on it
5. Look at the error message shown in n8n
6. **Copy that exact message**
7. It should match what appears in the modal

### Check database

```sql
-- This won't show execution errors (they're not in DB)
-- But useful to verify workflow is tracked
SELECT id, name, active, n8n_workflow_id
FROM workflows
WHERE active = true;
```

## What the Logs Tell Us

**If you see in backend logs**:
```
[ERROR EXTRACTION] Full exec.data structure: {
  "resultData": {
    "error": {
      "message": "Problem in node 'Facebook Create a post', node does not have any credentials set"
    }
  }
}
```

Then the backend IS receiving the error from n8n.

**If you see**:
```
[ERROR FINAL] Extracted error details: {
  message: 'Problem in node 'Facebook Create a post', node does not have any credentials set',
  node: 'Facebook Create a post',
  type: 'NodeOperationError'
}
```

Then the backend IS extracting it correctly.

**If API response shows**:
```json
{
  "error": {
    "message": "Problem in node 'Facebook Create a post', node does not have any credentials set"
  }
}
```

Then the backend IS returning it correctly.

**If frontend modal shows**:
```
Error Message
┌────────────────────────────────────────┐
│ Workflow execution failed              │
└────────────────────────────────────────┘
```

Then there's a disconnect between API and frontend.

## Next Steps

1. **Trigger a test error** in n8n
2. **Check backend logs** - Look for `[ERROR EXTRACTION]` entries
3. **Check API response** - Use browser console fetch command above
4. **Share the logs** - Copy the relevant log entries

Once you share what the logs show, I can identify exactly where the issue is and fix it.
