# Debug Error Display in Dashboard

## Changes Made

Added comprehensive console logging to track error data flow from API to modal display.

### Frontend Logging Added

**File**: [Dashboard.jsx](y:\frontend\src\pages\Dashboard.jsx)

1. **When fetching executions** (Lines 50-55):
   - Logs when an error execution is detected
   - Logs the full execution object
   - Logs the error object specifically

2. **When opening error modal from workflow card** (Lines 842-844):
   - Logs workflow name
   - Logs execution data
   - Logs error object

3. **When opening error modal from global admin dashboard** (Lines 463-465):
   - Same logging as above, with "GLOBAL ADMIN" prefix

## How to Debug

### Step 1: Open Browser Console

1. Open your dashboard
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Clear the console (🚫 icon or Ctrl+L)

### Step 2: Trigger Error Detection

Option A - If you already have a workflow with errors:
1. Refresh the dashboard page
2. Look for `[DASHBOARD]` log entries

Option B - Create a new error:
1. Go to n8n (http://localhost:5678)
2. Create/edit a workflow to fail (e.g., HTTP request to invalid URL)
3. Execute the workflow
4. Wait 30 seconds for dashboard to poll
5. Look for `[DASHBOARD]` log entries

### Step 3: Open Error Modal

1. Click the "Error Detected" button on a workflow card
2. Look for `[MODAL OPEN]` log entries

### What to Look For in Logs

#### Expected Log Sequence

```javascript
// When fetching executions
[DASHBOARD] Error execution for workflow: My Workflow Name
[DASHBOARD] Full execution object: {
  "id": "12345",
  "status": "error",
  "error": {
    "message": "This should show the actual error",
    "node": "HTTP Request",
    "type": "NodeOperationError"
  }
}
[DASHBOARD] Error object: { message: "...", node: "...", type: "..." }

// When clicking error button
[MODAL OPEN] Opening error modal for workflow: My Workflow Name
[MODAL OPEN] Execution data: { id: "12345", status: "error", error: {...} }
[MODAL OPEN] Error object: { message: "...", node: "...", type: "..." }
```

### What Each Log Means

1. **`[DASHBOARD] Error execution for workflow: ...`**
   - ✅ Confirms error was detected in API response
   - ✅ Confirms workflow name is correct

2. **`[DASHBOARD] Full execution object: {...}`**
   - 🔍 Shows complete execution data from API
   - 🔍 Check if `error` property exists
   - 🔍 Check if `error.message` is present
   - 🔍 Check if message is generic ("Workflow execution failed") or specific

3. **`[DASHBOARD] Error object: {...}`**
   - 🔍 Shows just the error details
   - 🔍 Should contain: message, node, type, description, stack, timestamp

4. **`[MODAL OPEN] ...`**
   - ✅ Confirms modal is receiving the error data
   - 🔍 Check if error object is same as from API response

## Common Issues and Solutions

### Issue 1: No `[DASHBOARD]` logs appear

**Cause**: No workflows have errors, or polling hasn't run yet

**Solution**:
1. Verify workflow has actually failed in n8n
2. Wait 30 seconds for next poll
3. Manually click "Refresh" button in dashboard

### Issue 2: Error object is `null` or `undefined`

**Example log**:
```javascript
[DASHBOARD] Error object: null
```

**Cause**: Backend is not extracting error correctly from n8n

**Solution**:
1. Check backend logs: `docker logs -f automara-backend --tail=100`
2. Look for `[ERROR EXTRACTION]` entries
3. See what n8n is actually returning
4. Backend might need to adjust error extraction path

### Issue 3: Error message is generic "Workflow execution failed"

**Example log**:
```javascript
[DASHBOARD] Error object: {
  message: "Workflow execution failed",
  node: "Unknown node"
}
```

**Cause**: Backend found an error but couldn't extract specific details

**Solution**:
1. Check backend logs for `[SOURCE 1]`, `[SOURCE 2]`, `[SOURCE 3]` entries
2. See which source (if any) found the error
3. Check `[ERROR FINAL]` to see what was extracted
4. Backend might need to look in different property path

### Issue 4: Modal shows no error message

**Example**: Modal opens but "Error Message" section is empty

**Logs to check**:
```javascript
[MODAL OPEN] Error object: undefined  // ← Problem: error object not passed to modal
```

**Solution**:
- Frontend issue: Check that `selectedError.execution.error` exists
- Verify modal is checking `selectedError.execution.error.message`

## Backend Logs to Check

While the frontend is running, also check backend logs:

```bash
docker logs -f automara-backend --tail=100
```

Look for these entries when an error execution is fetched:

```
[ERROR EXTRACTION] Execution ID: 12345
[ERROR EXTRACTION] Full exec.data structure: {...}
[SOURCE 1] Found error in resultData.error: {...}
[ERROR FINAL] Extracted error details: { message: '...', node: '...', type: '...' }
```

## Quick Test

1. **Refresh dashboard** → Check console for `[DASHBOARD]` logs
2. **Click error button** → Check console for `[MODAL OPEN]` logs
3. **Copy all console output** and share it

## What to Share

If errors still aren't showing correctly, share:

1. **Browser console output** (all `[DASHBOARD]` and `[MODAL OPEN]` logs)
2. **Backend logs** (all `[ERROR EXTRACTION]` logs)
3. **Screenshot of error modal** showing what's displayed

This will help identify exactly where the error message is being lost.
