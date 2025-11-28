# Restart Backend to Apply Error Extraction Changes

## Changes Made

Enhanced the backend to extract errors from individual nodes in n8n workflow executions.

**Files Modified**:
- [workflow-activation.js](y:\backend\routes\workflow-activation.js) - Lines 351-458

## How to Restart Backend

### Option 1: Restart Just the Backend Container

```bash
docker restart automara-backend
```

### Option 2: Restart All Containers

```bash
docker-compose restart
```

### Option 3: Rebuild and Restart (if Option 1 doesn't work)

```bash
docker-compose up -d --build backend
```

## After Restart

1. **Check backend logs** to verify it started:
   ```bash
   docker logs automara-backend --tail=20
   ```

2. **Trigger a test error in n8n**:
   - Go to http://localhost:5678
   - Create/edit a workflow
   - Add a node that will fail (e.g., HTTP Request to invalid URL)
   - Execute the workflow

3. **Check backend logs for error extraction**:
   ```bash
   docker logs -f automara-backend --tail=50
   ```

   Look for:
   ```
   [ERROR EXTRACTION] Execution ID: ...
   [SOURCE 1] Checking all nodes in runData for errors...
   [SOURCE 1] Found error in node "..." (run 0): ...
   [ERROR FINAL] Extracted error details: { message: '...', node: '...', ... }
   ```

4. **Check dashboard**:
   - Open dashboard (refresh page)
   - Wait 30 seconds for polling (or click Refresh)
   - Click "Error Detected" button on failed workflow
   - Error modal should show the exact error message from n8n

## What to Expect

### Backend Logs

```
[ERROR EXTRACTION] Execution ID: 12345
[ERROR EXTRACTION] Status: error
[ERROR EXTRACTION] Last node executed: HTTP Request
[ERROR EXTRACTION] Available nodes in runData: [ 'HTTP Request', 'Start' ]
[SOURCE 1] Checking all nodes in runData for errors...
[SOURCE 1] Found error in node "HTTP Request" (run 0): {
  message: 'getaddrinfo ENOTFOUND invalid-url.com',
  name: 'NodeApiError',
  stack: '...'
}
[ERROR FINAL] Extracted error details: {
  message: 'getaddrinfo ENOTFOUND invalid-url.com',
  node: 'HTTP Request',
  type: 'NodeApiError',
  hasDescription: false,
  hasStack: true,
  hasContext: false
}
```

### Dashboard Error Modal

```
┌────────────────────────────────────────────────────────┐
│ Workflow Execution Error                               │
│ My Test Workflow                                       │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Error Details                                          │
│                                                        │
│ Error Type                                             │
│ ┌────────────────────────────────────────────────┐    │
│ │ NodeApiError                                   │    │
│ └────────────────────────────────────────────────┘    │
│                                                        │
│ Error Message                                          │
│ ┌────────────────────────────────────────────────┐    │
│ │ getaddrinfo ENOTFOUND invalid-url.com          │    │
│ └────────────────────────────────────────────────┘    │
│                                                        │
│ Failed Node: HTTP Request                             │
│ Error Timestamp: 11/27/2024, 10:30:05 AM              │
│                                                        │
│ Stack Trace (First 10 lines)                          │
│ ┌────────────────────────────────────────────────┐    │
│ │ NodeApiError: getaddrinfo ENOTFOUND...         │    │
│ │   at Object.execute (...)                      │    │
│ │   at Workflow.runNode (...)                    │    │
│ └────────────────────────────────────────────────┘    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## If Errors Still Don't Show

1. **Check that backend restarted successfully**:
   ```bash
   docker ps | grep backend
   ```
   Should show "Up X seconds/minutes"

2. **Check for backend errors**:
   ```bash
   docker logs automara-backend --tail=50
   ```
   Look for any error messages

3. **Verify n8n has actual error executions**:
   - Go to n8n: http://localhost:5678
   - Click "Executions" tab
   - Find executions with red "error" status
   - Click on one to see the error

4. **Test API directly**:
   Open browser console and run:
   ```javascript
   const user = JSON.parse(localStorage.getItem('user'));
   fetch('/api/workflows/1/executions?limit=1', {
     headers: {
       'x-user-role': user.role,
       'x-tenant-id': user.tenantId,
       'x-user-id': user.id
     }
   })
   .then(r => r.json())
   .then(data => console.log('API Response:', JSON.stringify(data, null, 2)));
   ```

## Next Steps

Once backend is restarted:

1. ✅ Backend extracts errors from nodes
2. ✅ Dashboard displays exact error messages
3. ✅ Error modal shows node names, types, stack traces
4. ✅ Comprehensive logging helps debug any issues

See [NODE_ERROR_EXTRACTION.md](y:\NODE_ERROR_EXTRACTION.md) for complete documentation.
