# Testing Execution 20 Error Extraction

## Execution Details

- **Execution ID**: 20
- **Workflow ID**: E8jG0ld1Y7r9WlaI
- **Workflow Name**: empoweredbydesign - Social Profile Posts
- **Error**: "Credentials for LinkedIn are not set"
- **Location**: Node 20 → Click error icon → Issues field

## How to Test

### Step 1: Restart Backend

```bash
docker restart automara-backend
```

Wait 5 seconds for backend to start.

### Step 2: Check Backend Logs

```bash
docker logs -f automara-backend --tail=100
```

Keep this terminal open.

### Step 3: Trigger Error Fetch

**Option A - Via Dashboard:**
1. Open dashboard
2. Click "Refresh" button
3. Watch backend logs for `[ERROR EXTRACTION]` entries

**Option B - Via Browser Console:**
```javascript
const user = JSON.parse(localStorage.getItem('user'));

// Find the workflow ID for "empoweredbydesign - Social Profile Posts"
fetch('/api/workflows', {
  headers: {
    'x-user-role': user.role,
    'x-tenant-id': user.tenantId,
    'x-user-id': user.id
  }
})
.then(r => r.json())
.then(data => {
  const workflow = data.workflows.find(w => w.name.includes('Social Profile Posts'));
  console.log('Workflow:', workflow);

  if (workflow) {
    // Fetch executions for this workflow
    return fetch(`/api/workflows/${workflow.id}/executions?limit=1`, {
      headers: {
        'x-user-role': user.role,
        'x-tenant-id': user.tenantId,
        'x-user-id': user.id
      }
    });
  }
})
.then(r => r.json())
.then(data => {
  console.log('===== EXECUTION DATA =====');
  console.log(JSON.stringify(data, null, 2));

  if (data.executions && data.executions[0] && data.executions[0].error) {
    console.log('===== ERROR OBJECT =====');
    console.log(data.executions[0].error);
    console.log('===== ERROR MESSAGE =====');
    console.log(data.executions[0].error.message);
  }
});
```

### Step 4: Check What the Backend Logs Show

Look for these log entries in the backend logs:

#### 1. Execution Data Structure
```
[ERROR EXTRACTION] Execution ID: 20
[ERROR EXTRACTION] Status: error
[ERROR EXTRACTION] Full execution data: {
  "resultData": {
    "runData": {
      "LinkedIn": [
        {
          "error": {
            "message": "...",
            "issues": "Credentials for LinkedIn are not set"  ← THIS IS WHAT WE WANT!
          }
        }
      ]
    }
  }
}
```

#### 2. Node Structure
```
[SOURCE 1] Node "LinkedIn" run 0 structure: {
  "error": {
    "message": "...",
    "issues": "Credentials for LinkedIn are not set"
  }
}
```

#### 3. Error Found
```
[SOURCE 1] Found error in node "LinkedIn" (run 0): {
  message: '...',
  issues: 'Credentials for LinkedIn are not set'
}
```

#### 4. Final Extracted Error
```
[ERROR FINAL] Extracted error details: {
  message: 'Credentials for LinkedIn are not set',  ← Should use "issues" field
  node: 'LinkedIn',
  type: 'NodeOperationError',
  hasDescription: true,
  hasStack: true,
  hasContext: false
}
```

## What to Look For

### Scenario A: "issues" field exists in run.error

If the structure is:
```javascript
{
  runData: {
    "LinkedIn": [
      {
        error: {
          message: "Some generic message",
          issues: "Credentials for LinkedIn are not set"  ← THIS
        }
      }
    ]
  }
}
```

**Expected**: The code should now extract "Credentials for LinkedIn are not set" as the error message.

### Scenario B: "issues" field is in a different location

If the logs show the structure is different (e.g., `run.issues`, `run.data.issues`, etc.), we'll need to adjust the extraction code based on what we see.

## Expected Dashboard Display

After backend restart, when you:
1. Refresh dashboard
2. Click "Error Detected" on the workflow
3. Error modal should show:

```
┌────────────────────────────────────────────────────┐
│ Error Details                                      │
├────────────────────────────────────────────────────┤
│ Error Message                                      │
│ ┌────────────────────────────────────────────┐    │
│ │ Credentials for LinkedIn are not set       │    │ ← THIS!
│ └────────────────────────────────────────────┘    │
│                                                    │
│ Failed Node: LinkedIn                             │
│ Error Timestamp: ...                              │
└────────────────────────────────────────────────────┘
```

## If It Doesn't Work

### Share These Logs

1. **Full execution data log**:
   ```
   [ERROR EXTRACTION] Full execution data: {...}
   ```
   Copy the entire JSON structure (first 5000 chars)

2. **Node structure log**:
   ```
   [SOURCE 1] Node "..." run 0 structure: {...}
   ```
   Copy this for the node that has the error

3. **Final extracted error**:
   ```
   [ERROR FINAL] Extracted error details: {...}
   ```
   Copy this to see what was actually extracted

### Common Issues

**Issue 1: "issues" field is an array**

If the structure is:
```javascript
{
  error: {
    issues: ["Credentials for LinkedIn are not set"]  // Array, not string
  }
}
```

**Solution**: Extract first element of array or join them.

**Issue 2: "issues" field is nested deeper**

If the structure is:
```javascript
{
  data: {
    error: {
      issues: "Credentials for LinkedIn are not set"
    }
  }
}
```

**Solution**: Already handled by checking `run.data.error.issues`.

**Issue 3: Field is called something else**

If n8n uses a different field name (e.g., `issue`, `errorMessage`, `failureReason`), we need to add that to the checks.

## Next Steps

1. ✅ Restart backend
2. ✅ Trigger execution fetch (via dashboard or browser console)
3. ✅ Check backend logs
4. ✅ Copy the relevant log entries
5. ✅ Share them so we can see the exact structure
6. ✅ Adjust extraction code if needed based on actual structure

The enhanced code now:
- ✅ Logs full execution data structure
- ✅ Logs each node's run structure
- ✅ Checks for "issues" field in multiple locations
- ✅ Prioritizes "issues" field over generic "message" field

Once you share the logs, we can see exactly where n8n stores "Credentials for LinkedIn are not set" and ensure it's being extracted correctly!
