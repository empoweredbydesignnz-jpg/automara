# Enhanced Node-Level Error Extraction

## Overview

The backend now thoroughly checks **all nodes** in the n8n workflow execution data to extract specific error messages directly from failed nodes, ensuring accurate error reporting in the dashboard.

## What Changed

### Backend Error Extraction Enhancement

**File**: [workflow-activation.js](y:\backend\routes\workflow-activation.js) (Lines 351-458)

#### Previous Behavior

- Checked top-level error object first
- Then checked last node executed
- Finally scanned all nodes as fallback
- Sometimes missed errors buried in node data

#### New Behavior

**Priority order (reversed for better accuracy):**

1. **Source 1: Check ALL nodes in runData** (MOST RELIABLE)
   - Scans every node in the workflow
   - Checks `run.error` for each node execution
   - Checks `run.data.error` for nested errors
   - Stops at first error found

2. **Source 2: Last node executed** (if Source 1 finds nothing)
   - Specifically checks the last node that ran
   - Useful for sequential workflows

3. **Source 3: Top-level resultData.error** (fallback)
   - Checks the global error object
   - Last resort if nodes don't have error details

4. **Final fallback**: "Workflow execution failed" + last node name

### New Logging

Added comprehensive debug logging to track error extraction:

```javascript
console.log('[ERROR EXTRACTION] Execution ID:', exec.id);
console.log('[ERROR EXTRACTION] Status:', exec.status);
console.log('[ERROR EXTRACTION] Last node executed:', lastNodeExecuted);
console.log('[ERROR EXTRACTION] Available nodes in runData:', Object.keys(runData));

// When error found in a node:
console.log(`[SOURCE 1] Found error in node "${nodeName}" (run ${i}):`, run.error);

// Final extracted details:
console.log('[ERROR FINAL] Extracted error details:', {
  message: errorMessage,
  node: errorNode,
  type: errorType,
  hasDescription: !!errorDescription,
  hasStack: !!errorStack,
  hasContext: !!errorContext
});
```

### Error Data Extraction

**From each node, we now extract:**

| Field | Source | Example |
|-------|--------|---------|
| **message** | `run.error.message` | "Problem in node 'Facebook Create a post', node does not have any credentials set" |
| **node** | Node name from runData | "Facebook Create a post" |
| **type** | `run.error.name` or `run.error.type` | "NodeOperationError" |
| **description** | `run.error.description` | Additional error details |
| **stack** | `run.error.stack` (first 10 lines) | Stack trace for debugging |
| **context** | `run.error.context` | Error context data |
| **timestamp** | `exec.stoppedAt` or `exec.startedAt` | When the error occurred |
| **lastNodeExecuted** | `resultData.lastNodeExecuted` | Last node that ran before failure |

### Frontend Display Enhancement

**File**: [Dashboard.jsx](y:\frontend\src\pages\Dashboard.jsx) (Lines 1168-1180)

Added **Error Context** section to the error modal to display additional context data from n8n errors.

```jsx
{/* Error Context */}
{selectedError.execution.error.context && (
  <div>
    <p className="text-red-300/70 text-sm mb-2">Error Context</p>
    <div className="bg-slate-900/50 rounded-lg p-4 border border-red-500/20">
      <p className="text-red-200 text-sm leading-relaxed font-mono whitespace-pre-wrap">
        {typeof selectedError.execution.error.context === 'string'
          ? selectedError.execution.error.context
          : JSON.stringify(selectedError.execution.error.context, null, 2)}
      </p>
    </div>
  </div>
)}
```

## Technical Details

### Node Error Structure in n8n

n8n stores errors in the execution data like this:

```javascript
{
  "data": {
    "resultData": {
      "runData": {
        "Facebook Create a post": [  // ← Node name
          {
            "error": {  // ← Error is here!
              "message": "Problem in node 'Facebook Create a post', node does not have any credentials set",
              "name": "NodeOperationError",
              "description": null,
              "stack": "NodeOperationError: Problem in node...\n  at Object.execute...",
              "context": {}
            },
            "startTime": 1732670000000,
            "executionTime": 45
          }
        ],
        "Other Node": [
          {
            "data": {
              "main": [[{ "json": {} }]]
            }
          }
        ]
      },
      "lastNodeExecuted": "Facebook Create a post"
    }
  },
  "status": "error",
  "stoppedAt": "2024-11-27T10:00:05.123Z"
}
```

### Extraction Logic

```javascript
// Source 1: Check ALL nodes
for (const [nodeName, nodeRuns] of Object.entries(runData)) {
  if (Array.isArray(nodeRuns)) {
    for (let i = 0; i < nodeRuns.length; i++) {
      const run = nodeRuns[i];

      // Direct error in run
      if (run && run.error) {
        errorMessage = run.error.message;
        errorNode = nodeName;
        errorType = run.error.name || run.error.type;
        errorStack = run.error.stack;
        errorContext = run.error.context;
        break;
      }

      // Nested error in run.data
      if (run && run.data && run.data.error) {
        errorMessage = run.data.error.message;
        errorNode = nodeName;
        // ... extract other fields
        break;
      }
    }
    if (errorMessage) break;
  }
}
```

## Example Error Messages

### Before Enhancement

```
Error Message: Workflow execution failed
Failed Node: Unknown node
```

Generic, not helpful.

### After Enhancement

```
Error Message: Problem in node 'Facebook Create a post', node does not have any credentials set
Failed Node: Facebook Create a post
Error Type: NodeOperationError
Stack Trace:
  NodeOperationError: Problem in node 'Facebook Create a post'
    at Object.execute (/usr/local/lib/node_modules/n8n/dist/...)
    at Workflow.runNode (/usr/local/lib/node_modules/n8n/dist/...)
```

Specific, actionable, helpful!

## Common Error Types

### Credential Errors

**Error Message**:
```
Problem in node 'Google Sheets', node does not have any credentials set
```

**What to do**: Configure credentials for the node in workflow settings.

### HTTP Request Errors

**Error Message**:
```
Request failed with status code 404
```

**What to do**: Check API endpoint URL, verify endpoint exists.

### Database Connection Errors

**Error Message**:
```
Connection refused: Unable to connect to database
```

**What to do**: Verify database host, port, and credentials.

### Timeout Errors

**Error Message**:
```
Request timeout after 5000ms
```

**What to do**: Increase timeout or check external service availability.

### Authentication Errors

**Error Message**:
```
Invalid API key
```

**What to do**: Update API key in workflow settings.

## Testing the Enhancement

### Step 1: Create a Test Error

1. Go to n8n: http://localhost:5678
2. Create a workflow with a node that will fail
3. Examples:
   - HTTP Request to invalid URL: `http://this-does-not-exist-123456.com`
   - Database node with wrong credentials
   - API node without credentials
   - Facebook/Twitter node without authentication

### Step 2: Execute the Workflow

1. Activate the workflow
2. Trigger it (manually or via webhook)
3. Wait for it to fail

### Step 3: Check Backend Logs

```bash
docker logs -f automara-backend --tail=50
```

**Look for**:
```
[ERROR EXTRACTION] Execution ID: abc123
[ERROR EXTRACTION] Status: error
[ERROR EXTRACTION] Last node executed: HTTP Request
[ERROR EXTRACTION] Available nodes in runData: [ 'HTTP Request', 'Set' ]
[SOURCE 1] Checking all nodes in runData for errors...
[SOURCE 1] Found error in node "HTTP Request" (run 0): {
  message: 'getaddrinfo ENOTFOUND this-does-not-exist-123456.com',
  name: 'NodeApiError',
  ...
}
[ERROR FINAL] Extracted error details: {
  message: 'getaddrinfo ENOTFOUND this-does-not-exist-123456.com',
  node: 'HTTP Request',
  type: 'NodeApiError',
  hasDescription: false,
  hasStack: true,
  hasContext: false
}
```

### Step 4: Check Dashboard

1. Open dashboard
2. Wait 30 seconds for polling (or click Refresh)
3. Workflow should show:
   - Red border
   - ⚠️ Error icon (pulsing)
   - "Error Detected" badge

### Step 5: View Error Details

1. Click "Error Detected" button
2. Modal should show:
   - **Error Message**: Exact error from n8n
   - **Failed Node**: Node name that failed
   - **Error Type**: NodeApiError, NodeOperationError, etc.
   - **Stack Trace**: First 10 lines
   - **Error Context**: If available

## Debugging

### If error message still shows "Workflow execution failed"

**Check backend logs**:

1. Did `[SOURCE 1]` find any errors?
   - Yes → Error might not have a message property
   - No → Check if `[SOURCE 2]` or `[SOURCE 3]` found it

2. What does `[ERROR FINAL]` show?
   - If message is null or undefined, n8n might store error differently

3. Check the available nodes:
   ```
   [ERROR EXTRACTION] Available nodes in runData: [ ... ]
   ```
   - Make sure the failed node is in this list

### If no error appears in dashboard

1. **Check workflow is active**: Only active workflows are monitored
2. **Check execution exists in n8n**: Go to n8n → Executions tab
3. **Check execution status**: Must be "error" not "success" or "running"
4. **Check polling**: Wait 30 seconds or click Refresh
5. **Check browser console**: Look for API errors

## Performance Impact

- **Minimal**: Only checks nodes when execution status is "error"
- **No extra API calls**: Uses same execution data from n8n
- **Efficient**: Stops at first error found (doesn't scan all nodes unnecessarily)

## Benefits

✅ **Accurate error messages**: Shows exact error from n8n nodes
✅ **Node identification**: Tells you which node failed
✅ **Stack traces**: Helps debug complex errors
✅ **Error context**: Additional debugging information
✅ **Better UX**: Users know exactly what went wrong
✅ **Faster troubleshooting**: No need to check n8n directly
✅ **Comprehensive logging**: Easy to debug if issues arise

## Related Files

- [workflow-activation.js:351-458](y:\backend\routes\workflow-activation.js#L351-L458) - Error extraction logic
- [Dashboard.jsx:1168-1180](y:\frontend\src\pages\Dashboard.jsx#L1168-L1180) - Error context display
- [WORKFLOW_ERROR_TRACKING.md](y:\WORKFLOW_ERROR_TRACKING.md) - Original error tracking feature
- [ENHANCED_ERROR_DETAILS.md](y:\ENHANCED_ERROR_DETAILS.md) - Previous error enhancement

## Summary

The error extraction now:

1. ✅ Checks **every node** in the workflow execution
2. ✅ Extracts **specific error messages** from failed nodes
3. ✅ Shows **exact errors** like "node does not have any credentials set"
4. ✅ Identifies **which node** failed
5. ✅ Includes **stack traces** and **error context**
6. ✅ Provides **comprehensive logging** for debugging
7. ✅ Works immediately after backend restart

**The dashboard error window now displays the exact error message from n8n nodes!**
