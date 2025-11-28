# Workflow Error Tracking in Dashboard

## Overview

The Dashboard Workflow Monitor now displays execution errors from n8n, showing error messages, affected nodes, and timestamps directly in the dashboard for quick troubleshooting.

## What Was Added

### Backend API Endpoint

**File**: [workflow-activation.js:305-380](y:\backend\routes\workflow-activation.js#L305-L380)

#### GET /api/workflows/:id/executions

New endpoint that fetches execution data from n8n and transforms it to include error information.

**Features**:
- Fetches latest executions from n8n API
- Filters by workflow ID
- Extracts error details (message, node, timestamp)
- Respects tenant isolation
- Returns transformed execution data

**Request**:
```javascript
GET /api/workflows/:id/executions?limit=5

Headers:
  x-user-role: client_user
  x-tenant-id: 1
  x-user-id: 1
```

**Response**:
```json
{
  "success": true,
  "executions": [
    {
      "id": "12345",
      "workflowId": "abc-123",
      "status": "error",
      "mode": "trigger",
      "startedAt": "2024-01-15T10:30:00Z",
      "stoppedAt": "2024-01-15T10:30:05Z",
      "finished": true,
      "error": {
        "message": "Connection refused: Unable to connect to database",
        "node": "PostgreSQL",
        "timestamp": "2024-01-15T10:30:05Z"
      }
    }
  ]
}
```

### Frontend Implementation

**File**: [Dashboard.jsx](y:\frontend\src\pages\Dashboard.jsx)

#### 1. New State Management

```javascript
const [workflowExecutions, setWorkflowExecutions] = useState({});
```

Stores execution data indexed by workflow ID.

#### 2. Fetch Executions Function (Lines 25-52)

```javascript
const fetchWorkflowExecutions = async (workflowsData, user) => {
  const executions = {};

  // Fetch executions for active workflows only
  const activeWorkflows = workflowsData.filter(w => w.active);

  for (const workflow of activeWorkflows) {
    try {
      const response = await axios.get(`/api/workflows/${workflow.id}/executions`, {
        params: { limit: 1 }, // Get only the latest execution
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || '',
          'x-user-id': user?.id || ''
        }
      });

      if (response.data.success && response.data.executions.length > 0) {
        const latestExecution = response.data.executions[0];
        executions[workflow.id] = latestExecution;
      }
    } catch (error) {
      console.error(`Error fetching executions for workflow ${workflow.id}:`, error);
    }
  }

  setWorkflowExecutions(executions);
};
```

**Key Features**:
- Fetches only for active workflows
- Gets only the latest execution (limit: 1)
- Handles errors gracefully
- Updates state with execution data

#### 3. Automatic Polling (Lines 226-237)

```javascript
// Fetch workflow executions every 30 seconds
useEffect(() => {
  const user = JSON.parse(localStorage.getItem('user'));

  const interval = setInterval(() => {
    if (workflows.length > 0) {
      fetchWorkflowExecutions(workflows, user);
    }
  }, 30000); // 30 seconds

  return () => clearInterval(interval);
}, [workflows]);
```

**Polling Strategy**:
- Updates every 30 seconds
- Only runs when workflows exist
- Cleans up interval on unmount

#### 4. Error Detection (Lines 655-656)

```javascript
const execution = workflowExecutions[workflow.id];
const hasError = execution?.status === 'error';
```

Checks if the latest execution has an error status.

#### 5. Visual Indicators

**Error Border** (Lines 670-674):
```javascript
className={`relative bg-slate-900/50 rounded-xl border p-5 hover:border-slate-700 transition-all group ${
  hasError ? 'border-red-500/50' : 'border-slate-800'
}`}
```

Workflow cards with errors show a red border.

**Error Icon** (Lines 687-693):
```javascript
{hasError ? (
  <div className="relative">
    <svg className="w-6 h-6 text-red-400 animate-pulse" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
  </div>
) : ...}
```

Status indicator shows error icon (⚠) with red background and pulsing animation.

**Error Badge** (Lines 724-731):
```javascript
{hasError && (
  <span className="px-2.5 py-1 rounded-lg font-medium bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5">
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    Error Detected
  </span>
)}
```

"Error Detected" badge appears next to the status.

#### 6. Error Details Panel (Lines 820-852)

```javascript
{hasError && execution?.error && (
  <div className="mt-4 pt-4 border-t border-red-500/30">
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-red-400 font-semibold text-sm">Execution Error</h4>
            <span className="text-xs text-red-400/70">
              {new Date(execution.error.timestamp).toLocaleString()}
            </span>
          </div>
          <p className="text-red-300/90 text-sm mb-2">
            {execution.error.message}
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded border border-red-500/30">
              Node: {execution.error.node}
            </span>
            <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded border border-slate-600/30">
              Execution ID: {execution.id}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

**Displays**:
- Error title and timestamp
- Error message
- Node that caused the error
- Execution ID for reference

## User Experience

### Normal Workflow (No Error)

```
┌─────────────────────────────────────────────────────┐
│  💚 Customer Sync Workflow                          │
│  [Running] Started: 10:30 AM | Running for 5m 23s   │
│  ~~~~ (heartbeat animation) ~~~~                    │
└─────────────────────────────────────────────────────┘
```

- Green heartbeat icon
- No error badge
- Normal gray border

### Workflow with Error

```
┌─────────────────────────────────────────────────────┐ ← Red border
│  ⚠️  Customer Sync Workflow                          │
│  [Running] [⚠ Error Detected]                        │ ← Error badge
│  Started: 10:30 AM | Running for 5m 23s             │
│  ───────────────────────────────────────────────────│
│  ⚠️ Execution Error          Jan 15, 2024 10:35 AM  │
│  Connection refused: Unable to connect to database  │
│  [Node: PostgreSQL] [Execution ID: 12345]           │
└─────────────────────────────────────────────────────┘
```

**Visual Changes**:
- ⚠️ Red error icon (pulsing)
- Red border around entire card
- "Error Detected" badge
- Error details panel with:
  - Error timestamp
  - Error message
  - Node name
  - Execution ID

## Error Data Flow

```
┌─────────────┐
│   n8n       │
│  Execution  │
│   Fails     │
└──────┬──────┘
       │
       │ Execution stored with status: 'error'
       │
       ▼
┌─────────────┐
│   n8n API   │
│  /executions│ ──┐
└─────────────┘   │
                  │ GET /api/v1/executions?workflowId=X
                  │
                  ▼
┌─────────────────────────┐
│  Backend API            │
│  GET /api/workflows/:id/│
│  executions             │
└──────────┬──────────────┘
           │
           │ Transform execution data
           │ Extract error details
           │
           ▼
┌─────────────┐
│  Frontend   │
│  Dashboard  │
│             │
│  - Poll     │ ← Every 30 seconds
│  - Display  │
│  - Update   │
└─────────────┘
```

## Error Detection Logic

### Backend Error Extraction

```javascript
error: exec.status === 'error' && exec.data ? {
  message: exec.data.resultData?.error?.message || 'Workflow execution failed',
  node: exec.data.resultData?.error?.node?.name || 'Unknown node',
  timestamp: exec.stoppedAt || exec.startedAt
} : null
```

**Extracts**:
- Error message from `resultData.error.message`
- Node name from `resultData.error.node.name`
- Timestamp from `stoppedAt` or `startedAt`

### Frontend Error Detection

```javascript
const execution = workflowExecutions[workflow.id];
const hasError = execution?.status === 'error';
```

**Checks**:
- Execution exists for workflow
- Status is exactly 'error'

## Execution Statuses

| Status | Description | Display |
|--------|-------------|---------|
| `success` | Execution completed without errors | Normal (green heartbeat) |
| `error` | Execution failed with error | Error display (red icon, border, details) |
| `running` | Execution currently in progress | Normal (green heartbeat) |
| `waiting` | Execution waiting for trigger | Normal (gray) |

## Configuration

### Polling Interval

Default: 30 seconds

To change:
```javascript
// In Dashboard.jsx, line 234
}, 30000); // Change to desired interval in milliseconds
```

**Recommendations**:
- 30s: Good balance (default)
- 15s: More responsive, higher API load
- 60s: Lower API load, slower updates

### Execution Limit

Default: 1 (latest execution only)

To fetch more executions:
```javascript
// In Dashboard.jsx, line 34
params: { limit: 5 }, // Fetch last 5 executions
```

**Note**: Frontend currently shows only the latest execution.

## Performance Considerations

### API Calls

**Per Polling Cycle**:
- 1 API call per active workflow
- Example: 5 active workflows = 5 API calls every 30 seconds

**Optimization**:
- Only fetches for active workflows
- Only fetches latest execution (limit: 1)
- Graceful error handling (failed requests don't break UI)

### Network Traffic

**Per Request**:
- Request: ~200 bytes
- Response: ~500-1500 bytes (depending on error message length)

**Per Minute** (5 active workflows, 30s interval):
- ~10 requests
- ~5-15 KB data transferred

## Testing

### Manual Testing

1. **Create a workflow with an error**:
   - Go to n8n UI
   - Create a workflow with a node that will fail (e.g., database connection with wrong credentials)
   - Activate the workflow
   - Trigger it (manually or via webhook)

2. **Verify error appears in dashboard**:
   - Navigate to Dashboard
   - Find the workflow in Workflow Monitor
   - Should see:
     - Red border around card
     - Red error icon (⚠)
     - "Error Detected" badge
     - Error details panel with message

3. **Verify error details**:
   - Check error message matches n8n
   - Check node name is correct
   - Check timestamp is accurate

4. **Verify polling**:
   - Fix the error in n8n
   - Manually trigger workflow again (should succeed)
   - Wait 30 seconds
   - Error should disappear from dashboard

### Test Different Error Types

**Database Error**:
```
Error: Connection refused
Node: PostgreSQL
```

**HTTP Request Error**:
```
Error: Request failed with status code 404
Node: HTTP Request
```

**Authentication Error**:
```
Error: Invalid API key
Node: OpenAI
```

**Timeout Error**:
```
Error: Request timeout after 5000ms
Node: Webhook
```

## Troubleshooting

### Issue: Errors not appearing in dashboard

**Check**:
1. Workflow is active: `workflow.active === true`
2. Execution exists in n8n: Check n8n UI → Executions
3. Execution status is 'error': Check API response
4. Polling is running: Check browser console for fetch calls

**Solutions**:
- Refresh dashboard manually
- Check browser console for API errors
- Verify n8n API is accessible
- Check N8N_API_KEY is configured

### Issue: Error details missing or incomplete

**Check**:
1. n8n execution data structure
2. Error path in transformation: `exec.data.resultData?.error`

**Solution**:
Add console logging:
```javascript
console.log('Execution data:', exec.data);
console.log('Error details:', exec.data?.resultData?.error);
```

### Issue: Errors appear for wrong workflow

**Check**:
1. Workflow ID mapping: `workflowExecutions[workflow.id]`
2. n8n workflow ID vs database workflow ID

**Solution**:
Verify mapping:
```javascript
console.log('Workflow ID:', workflow.id);
console.log('Execution workflow ID:', execution.workflowId);
```

### Issue: Old errors not clearing

**Check**:
1. Polling is updating executions
2. Latest execution has status 'success'

**Solution**:
Force refresh:
```javascript
// Click "Refresh" button in dashboard
// OR
// Wait for next polling cycle (30s)
```

## Security

### Tenant Isolation

Backend enforces tenant isolation:
```javascript
const effectiveRole = userRole === 'admin' ? 'global_admin' : userRole;
if (effectiveRole !== 'global_admin' && workflow.tenant_id !== parseInt(tenantId)) {
  return res.status(403).json({ success: false, error: 'Unauthorized' });
}
```

**Rules**:
- ✅ Users can only see errors for their tenant's workflows
- ✅ Global admins can see all workflow errors
- ❌ Cross-tenant error access is blocked

### Error Data Sanitization

Backend filters sensitive data:
- Only returns necessary error fields
- Doesn't expose internal stack traces
- Doesn't include n8n credentials

## API Reference

### GET /api/workflows/:id/executions

**Description**: Get latest executions for a workflow with error details

**Parameters**:
- `id` (path, required): Workflow ID
- `limit` (query, optional): Number of executions to return (default: 5)

**Headers**:
- `x-user-id` (required): User ID
- `x-user-role` (required): User role
- `x-tenant-id` (required): Tenant ID

**Response**:
```json
{
  "success": true,
  "executions": [
    {
      "id": "string",
      "workflowId": "string",
      "status": "error" | "success" | "running" | "waiting",
      "mode": "string",
      "startedAt": "ISO 8601 timestamp",
      "stoppedAt": "ISO 8601 timestamp",
      "finished": boolean,
      "retryOf": "string | null",
      "retrySuccessId": "string | null",
      "error": {
        "message": "string",
        "node": "string",
        "timestamp": "ISO 8601 timestamp"
      } | null
    }
  ]
}
```

**Error Responses**:
- `404`: Workflow not found
- `403`: Unauthorized (wrong tenant)
- `500`: Failed to fetch executions

## Related Features

- **Workflow Monitor**: Shows active workflows with timers
- **Workflow Start/Stop**: Controls workflow execution
- **Workflow Sync**: Syncs workflows from n8n
- **Dashboard Cards**: Shows workflow statistics

## Future Enhancements

Potential improvements:
1. Show error count (how many times it failed)
2. Error history (last 5 errors)
3. Click to view full execution details
4. Email/Slack notifications on error
5. Error rate charts
6. Auto-retry failed executions
7. Group similar errors
8. Error resolution tracking

## Summary

✅ Fetches execution data from n8n API
✅ Displays errors in dashboard workflow monitor
✅ Shows error message, node, and timestamp
✅ Visual indicators (red border, icon, badge)
✅ Automatic polling every 30 seconds
✅ Tenant isolation enforced
✅ Graceful error handling
✅ Minimal performance impact
✅ No code changes needed for workflows
✅ Works immediately after browser refresh

**Error tracking is now live in the dashboard!**
