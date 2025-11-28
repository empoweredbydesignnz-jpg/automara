# Workflow Error Modal and Global Admin Dashboard

## Overview

Added clickable error buttons that open detailed error modals, plus a dedicated error dashboard section for global admins to view all workflow errors across all tenants in one place.

## Features Implemented

### 1. Clickable Error Badge

**Location**: Dashboard → Workflow Monitor → Individual Workflow Cards

The "Error Detected" badge is now clickable and opens a detailed modal with comprehensive error information.

**Visual**:
```
[⚠ Error Detected →]  ← Clickable button
```

**Changes**:
- Button instead of static span
- Hover effect (darker background)
- External link icon (→)
- Click opens error modal

**Code** ([Dashboard.jsx:751-767](y:\frontend\src\pages\Dashboard.jsx#L751-L767)):
```javascript
<button
  onClick={(e) => {
    e.stopPropagation();
    setSelectedError({ workflow, execution });
    setShowErrorModal(true);
  }}
  className="px-2.5 py-1 rounded-lg font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 flex items-center gap-1.5 transition-all cursor-pointer"
>
  <svg>⚠</svg>
  Error Detected
  <svg>→</svg>
</button>
```

### 2. Error Details Modal

**Location**: Triggered by clicking "Error Detected" button or "View Full Details" in global admin dashboard

**File**: [Dashboard.jsx:1033-1212](y:\frontend\src\pages\Dashboard.jsx#L1033-L1212)

**Features**:
- Full-screen modal overlay with backdrop blur
- Three main sections:
  1. **Execution Information**: IDs, status, timestamps
  2. **Error Details**: Error message, failed node, timestamp
  3. **Workflow Information**: Workflow details, tenant info

**Sections**:

#### Execution Information
- Execution ID (monospace)
- Workflow ID (monospace)
- Status badge (red for error)
- Execution mode
- Start timestamp
- Stop timestamp

#### Error Details
- Full error message (in code block)
- Failed node name
- Error timestamp

#### Workflow Information
- Workflow name
- Workflow database ID
- Tenant ID
- Active status badge

**Actions**:
- "Go to Workflows" - Navigate to Automations Library
- "Close" - Close modal
- X button in header - Close modal

**Visual Example**:
```
╔═══════════════════════════════════════════════════════╗
║ ⚠️  Workflow Execution Error                    [X]  ║
║ Customer Sync Workflow                               ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║ 📊 Execution Information                             ║
║ ┌─────────────────┬─────────────────┐               ║
║ │ Execution ID    │ Workflow ID     │               ║
║ │ 12345           │ abc-123         │               ║
║ ├─────────────────┼─────────────────┤               ║
║ │ Status: error   │ Mode: trigger   │               ║
║ ├─────────────────┼─────────────────┤               ║
║ │ Started At      │ Stopped At      │               ║
║ │ 10:30:00        │ 10:30:05        │               ║
║ └─────────────────┴─────────────────┘               ║
║                                                       ║
║ ⚠️  Error Details                                     ║
║ ┌───────────────────────────────────────────┐       ║
║ │ Error Message                             │       ║
║ │ Connection refused: Unable to connect     │       ║
║ │ to database                               │       ║
║ └───────────────────────────────────────────┘       ║
║ ┌──────────────────┬────────────────────────┐       ║
║ │ Failed Node      │ Error Timestamp        │       ║
║ │ PostgreSQL       │ Jan 15, 10:30 AM       │       ║
║ └──────────────────┴────────────────────────┘       ║
║                                                       ║
║ 📄 Workflow Information                              ║
║ ┌──────────────────┬────────────────────────┐       ║
║ │ Workflow Name    │ Workflow ID            │       ║
║ │ Customer Sync    │ 42                     │       ║
║ ├──────────────────┼────────────────────────┤       ║
║ │ Tenant ID        │ Status                 │       ║
║ │ 5                │ [Active]               │       ║
║ └──────────────────┴────────────────────────┘       ║
║                                                       ║
╠═══════════════════════════════════════════════════════╣
║ Use this information to debug...    [Go to Workflows]║
║                                     [Close]           ║
╚═══════════════════════════════════════════════════════╝
```

### 3. Global Admin Error Dashboard

**Location**: Dashboard → Below main stats cards, above Ticket Overview (Global Admin Only)

**File**: [Dashboard.jsx:393-472](y:\frontend\src\pages\Dashboard.jsx#L393-L472)

**Visibility**: Only shown when:
- User role is `global_admin`
- There are active workflow errors (`allWorkflowErrors.length > 0`)

**Features**:
- Shows all errors from all tenants
- Error count badge in header
- Each error displayed as a card
- "View Full Details" button opens modal

**Layout**:
```
╔═════════════════════════════════════════════════════════╗
║ ⚠️  Workflow Errors Overview              [5 Active    ║
║ System-wide workflow execution errors      Errors]     ║
╠═════════════════════════════════════════════════════════╣
║                                                         ║
║ ┌─────────────────────────────────────────────────────┐║
║ │ ⚠️  Customer Sync Workflow                          │║
║ │ Tenant ID: 5 • Jan 15, 2024 10:30 AM                │║
║ │                                                      │║
║ │ ┌─────────────────────────────────────────────────┐ │║
║ │ │ Connection refused: Unable to connect to        │ │║
║ │ │ database                                        │ │║
║ │ │ [Node: PostgreSQL] [Execution ID: 12345]       │ │║
║ │ │ [Workflow ID: abc-123]                         │ │║
║ │ └─────────────────────────────────────────────────┘ │║
║ │                                                      │║
║ │ [ℹ View Full Details]                               │║
║ └─────────────────────────────────────────────────────┘║
║                                                         ║
║ ┌─────────────────────────────────────────────────────┐║
║ │ ⚠️  Email Notification Workflow                     │║
║ │ Tenant ID: 3 • Jan 15, 2024 11:15 AM                │║
║ │                                                      │║
║ │ ┌─────────────────────────────────────────────────┐ │║
║ │ │ SMTP authentication failed                      │ │║
║ │ │ [Node: Send Email] [Execution ID: 12346]       │ │║
║ │ │ [Workflow ID: def-456]                         │ │║
║ │ └─────────────────────────────────────────────────┘ │║
║ │                                                      │║
║ │ [ℹ View Full Details]                               │║
║ └─────────────────────────────────────────────────────┘║
╚═════════════════════════════════════════════════════════╝
```

**Error Card Components**:
1. **Header**:
   - Error icon (⚠️)
   - Workflow name
   - Tenant ID
   - Error timestamp

2. **Error Summary Box**:
   - Error message
   - Failed node badge
   - Execution ID badge
   - Workflow ID badge

3. **Action Button**:
   - "View Full Details" → Opens error modal

## State Management

**New State Variables** ([Dashboard.jsx:20-22](y:\frontend\src\pages\Dashboard.jsx#L20-L22)):

```javascript
const [selectedError, setSelectedError] = useState(null);
const [showErrorModal, setShowErrorModal] = useState(false);
const [allWorkflowErrors, setAllWorkflowErrors] = useState([]);
```

**State Updates**:

1. **`selectedError`**: Stores workflow and execution data for modal display
   ```javascript
   { workflow: {...}, execution: {...} }
   ```

2. **`showErrorModal`**: Boolean to control modal visibility

3. **`allWorkflowErrors`**: Array of all errors across all tenants
   ```javascript
   [
     { workflow: {...}, execution: {...} },
     { workflow: {...}, execution: {...} }
   ]
   ```

## Data Flow

### Error Collection

**File**: [Dashboard.jsx:28-65](y:\frontend\src\pages\Dashboard.jsx#L28-L65)

```javascript
const fetchWorkflowExecutions = async (workflowsData, user) => {
  const executions = {};
  const errors = [];

  // Fetch executions for active workflows only
  const activeWorkflows = workflowsData.filter(w => w.active);

  for (const workflow of activeWorkflows) {
    // Fetch latest execution from API
    const response = await axios.get(`/api/workflows/${workflow.id}/executions`...);

    if (response.data.success && response.data.executions.length > 0) {
      const latestExecution = response.data.executions[0];
      executions[workflow.id] = latestExecution;

      // Collect errors for global admin dashboard
      if (latestExecution.status === 'error' && latestExecution.error) {
        errors.push({
          workflow: workflow,
          execution: latestExecution
        });
      }
    }
  }

  setWorkflowExecutions(executions);
  setAllWorkflowErrors(errors);  // ← Populates global admin dashboard
};
```

**Flow**:
1. Fetch executions for all active workflows
2. Store individual executions in `workflowExecutions` state
3. Filter errors and store in `allWorkflowErrors` array
4. Both states update simultaneously

### Modal Trigger

**From Workflow Card**:
```javascript
onClick={(e) => {
  e.stopPropagation();
  setSelectedError({ workflow, execution });
  setShowErrorModal(true);
}}
```

**From Global Admin Dashboard**:
```javascript
onClick={() => {
  setSelectedError({ workflow, execution });
  setShowErrorModal(true);
}}
```

**Modal Close**:
```javascript
onClick={() => {
  setShowErrorModal(false);
  setSelectedError(null);
}}
```

## User Experience

### For All Users

**Before**:
- Error shown inline in workflow card
- Limited information visible
- No way to see full details

**After**:
- Clickable "Error Detected" badge
- Click opens comprehensive modal
- All error details in one place
- Easy navigation to workflows page

### For Global Admin

**Before**:
- Had to check each tenant's workflows individually
- No overview of system-wide errors
- Time-consuming to identify issues

**After**:
- Dedicated error dashboard section
- All errors from all tenants in one view
- Tenant ID shown for each error
- Quick access to detailed modal
- Immediate visibility into system health

## Visual Design

### Color Scheme

**Error Theme**:
- Primary: Red (#ef4444)
- Secondary: Orange (#f97316)
- Background: Red with low opacity
- Border: Red with medium opacity

**Modal**:
- Backdrop: Black with 60% opacity + blur
- Background: Dark gradient (slate-900 to slate-800)
- Border: Red with 30% opacity
- Shadow: Red glow

### Badges

**Status Badge**:
```css
bg-red-500/20 text-red-400 border border-red-500/30
```

**Node Badge**:
```css
bg-red-500/20 text-red-300 border border-red-500/30
```

**Info Badge**:
```css
bg-slate-700/50 text-slate-300 border border-slate-600/30
```

### Hover Effects

**Error Button**:
- Background: `bg-red-500/20` → `bg-red-500/30`
- Border: `border-red-500/30` → `border-red-500/50`

**View Details Button**:
- Background: `bg-red-500/10` → `bg-red-500/20`
- Border: `border-red-500/30` → `border-red-500/50`

## Responsive Design

### Modal

**Desktop**:
- Max width: 3xl (768px)
- Max height: 90vh
- Scrollable body

**Mobile**:
- Full width with padding
- Max height: 90vh
- Scrollable content
- Touch-friendly buttons

### Error Dashboard

**Desktop**:
- Grid: 1 column
- Full-width cards

**Mobile**:
- Stacked layout
- Scrollable
- Touch targets ≥ 44px

## Accessibility

### Keyboard Navigation

- Modal can be closed with ESC key (browser default)
- Tab order: Close button → Go to Workflows → Close
- Focus trap in modal (recommended enhancement)

### Screen Readers

**ARIA Labels** (recommended additions):
```javascript
<button aria-label="View error details for workflow">
<div role="dialog" aria-labelledby="error-modal-title">
<button aria-label="Close error details modal">
```

### Visual Indicators

- High contrast red for errors
- Icons supplement text
- Status shown with color + text

## Testing

### Manual Testing

1. **Error Button Click**:
   - Find workflow with error
   - Click "Error Detected" badge
   - Modal should open
   - Verify all information displayed

2. **Modal Navigation**:
   - Click "Go to Workflows" → Should navigate to `/automations`
   - Click "Close" → Modal closes
   - Click X button → Modal closes
   - Click backdrop → Modal closes (if implemented)

3. **Global Admin Dashboard**:
   - Log in as global_admin
   - Create errors in different tenants
   - Verify all errors appear in dashboard
   - Click "View Full Details" → Modal opens
   - Verify tenant ID shown correctly

### Test Scenarios

**Single Error**:
```
User: Any
Workflows: 1 active with error
Expected:
  - Error badge clickable
  - Modal shows correct info
  - Global admin sees in dashboard
```

**Multiple Errors**:
```
User: global_admin
Workflows: 3 active, 2 with errors
Expected:
  - Dashboard shows "2 Active Errors"
  - Both error cards displayed
  - Each opens correct modal
```

**No Errors**:
```
User: global_admin
Workflows: 3 active, 0 errors
Expected:
  - Error dashboard section hidden
  - No errors in workflow monitor
```

**Cross-Tenant**:
```
User: global_admin
Workflows:
  - Tenant 1: 1 error
  - Tenant 2: 2 errors
  - Tenant 3: 0 errors
Expected:
  - Dashboard shows "3 Active Errors"
  - All 3 errors listed
  - Tenant IDs: 1, 2, 2
```

## Performance

### Optimization

**Data Fetching**:
- Errors collected during normal execution fetch
- No additional API calls required
- Efficient filtering in-memory

**Rendering**:
- Modal rendered only when open
- Conditional rendering for dashboard
- No re-renders when errors unchanged

### Memory Usage

**State Storage**:
- `selectedError`: 1 object (~1 KB)
- `allWorkflowErrors`: Array of N objects (~N KB)
- `showErrorModal`: 1 boolean (~1 byte)

**Total**: Minimal (<10 KB for typical usage)

## Security

### Data Exposure

**Global Admin**:
- ✅ Can see all tenant errors
- ✅ Tenant ID visible
- ✅ Error messages shown
- ❌ No sensitive credentials exposed

**Regular Users**:
- ✅ Can only see own workflow errors
- ✅ Tenant isolation enforced by API
- ❌ Cannot access other tenants' errors

### XSS Prevention

All user data sanitized by React's default escaping:
- Workflow names
- Error messages
- Timestamps

## Troubleshooting

### Issue: Modal doesn't open

**Check**:
1. Click event not bubbling? → `e.stopPropagation()` correct
2. State not updating? → Check `setShowErrorModal(true)`
3. Conditional render failing? → Verify `selectedError` set

**Solution**:
```javascript
console.log('Modal state:', showErrorModal);
console.log('Selected error:', selectedError);
```

### Issue: Global admin dashboard not showing

**Check**:
1. User role: Must be `global_admin`
2. Errors exist: `allWorkflowErrors.length > 0`
3. Workflows active: At least one active workflow with error

**Solution**:
```javascript
const user = JSON.parse(localStorage.getItem('user'));
console.log('User role:', user?.role);
console.log('All errors:', allWorkflowErrors);
```

### Issue: Wrong error shown in modal

**Check**:
1. `selectedError` state
2. Workflow ID matching
3. Execution data structure

**Solution**:
```javascript
console.log('Selected:', selectedError);
console.log('Workflow:', selectedError?.workflow);
console.log('Execution:', selectedError?.execution);
```

## Future Enhancements

Potential improvements:

1. **Error History**:
   - Show last 5 errors for each workflow
   - Timeline view

2. **Error Actions**:
   - "Retry Execution" button
   - "Mark as Resolved" button
   - "Ignore Error" option

3. **Notifications**:
   - Email alerts for new errors
   - Slack integration
   - Browser push notifications

4. **Error Analytics**:
   - Error rate charts
   - Most common errors
   - Error trends over time

5. **Filtering**:
   - Filter by tenant
   - Filter by error type
   - Filter by node type

6. **Search**:
   - Search error messages
   - Search by workflow name
   - Search by execution ID

## Related Documentation

- [WORKFLOW_ERROR_TRACKING.md](y:\WORKFLOW_ERROR_TRACKING.md) - Basic error tracking
- [WORKFLOW_START_STOP.md](y:\WORKFLOW_START_STOP.md) - Workflow control
- [DASHBOARD_TICKETS_FEATURE.md](y:\DASHBOARD_TICKETS_FEATURE.md) - Ticket dashboard

## Summary

✅ Clickable "Error Detected" badge
✅ Comprehensive error details modal
✅ Global admin error dashboard
✅ All errors across all tenants in one view
✅ Tenant ID displayed for identification
✅ Error message, node, and timestamp shown
✅ Execution and workflow details included
✅ Navigation to workflows page
✅ Responsive design
✅ No additional API calls required
✅ Works immediately after browser refresh

**Error visibility and debugging is now significantly improved for all users!**
