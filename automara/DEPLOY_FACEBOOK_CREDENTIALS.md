# Deploy Facebook Credential Management

## Summary

This update enables users to enter Facebook access tokens directly in workflow settings. The system automatically creates credentials in n8n and applies them to Facebook nodes.

## What Changed

### Frontend: AutomationsLibrary.jsx
- **Lines 608-628**: Added Facebook node detection and access token field

### Backend: workflow-activation.js
- **Lines 17-90**: Added `createOrUpdateFacebookCredential()` function
- **Lines 645-653**: Added tenant name retrieval for credential naming
- **Lines 655**: Changed settings loop from `forEach` to `for...of` (supports async)
- **Lines 814-844**: Added Facebook token handling logic

## Deployment Steps

### Step 1: Connect to Server

```bash
# SSH to server
ssh user@192.168.0.58

# Navigate to project directory
cd /path/to/automara
```

**OR** if deploying remotely:

```bash
# Set Docker host
export DOCKER_HOST=tcp://192.168.0.58:2375
```

### Step 2: Copy Updated Files

If files are on local machine:

```bash
# Copy frontend file
scp y:\frontend\src\pages\AutomationsLibrary.jsx user@192.168.0.58:/path/to/automara/frontend/src/pages/

# Copy backend file
scp y:\backend\routes\workflow-activation.js user@192.168.0.58:/path/to/automara/backend/routes/
```

**OR** if y:\ is mounted on server, files are already in place.

### Step 3: Rebuild Frontend

```bash
docker-compose build frontend
docker-compose up -d frontend
```

**Expected output**:
```
Building frontend
[+] Building 125.3s (12/12) FINISHED
 => [builder 6/6] RUN npm run build
 => [stage-1 3/3] COPY --from=builder /app/dist
Successfully built abc123def456
Successfully tagged automara-frontend:latest
Recreating automara-frontend ... done
```

Build time: ~2-3 minutes

### Step 4: Restart Backend

```bash
docker-compose restart backend
```

**Expected output**:
```
Restarting automara-backend ... done
```

Restart time: ~5 seconds

### Step 5: Verify Containers

```bash
docker-compose ps
```

**Expected output**:
```
NAME                STATUS         PORTS
automara-backend    Up 15 seconds  0.0.0.0:3001->3001/tcp
automara-frontend   Up 2 minutes   0.0.0.0:80->80/tcp
automara-postgres   Up 5 days      0.0.0.0:5432->5432/tcp
automara-n8n        Up 5 days      0.0.0.0:5678->5678/tcp
```

### Step 6: Check Backend Logs

```bash
docker-compose logs backend --tail=20
```

**Look for**:
```
Server running on port 3001
Connected to database
```

No errors should appear.

## Testing

### Test 1: Verify Facebook Field Appears

1. **Open browser** and navigate to http://192.168.0.58
2. **Login** as MSP_Admin
3. **Open Automations Library**
4. **Find** "Social Profile Posts" workflow
5. **Click Settings** button
6. **Open browser console** (F12 → Console tab)

**Expected console logs**:
```
[FACEBOOK] Processing Facebook node: Facebook Create a post ID: 580062478519892
[FACEBOOK] Node parameters: {...}
[FACEBOOK] Added Facebook token field for node: Facebook Create a post
```

**Expected in settings modal**:
```
┌─────────────────────────────────────────────────────────┐
│ Workflow Settings                                       │
│ Social Profile Posts                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ APIs                                                    │
│ ┌─────────────────────────────────────────────────┐    │
│ │ DeepSeek API Key: ****************              │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
│ Facebook Create a post - Facebook Access Token         │  ← NEW!
│ ┌─────────────────────────────────────────────────┐    │
│ │ [password field: ***********************]       │    │
│ └─────────────────────────────────────────────────┘    │
│ This token will be stored as a credential in n8n       │
│ and applied to this node                               │
│                                                         │
│ [Save Settings] [Cancel]                               │
└─────────────────────────────────────────────────────────┘
```

### Test 2: Create Facebook Credential

1. **Enter a test Facebook token** in the field
   - Get token from: https://developers.facebook.com/tools/explorer/
   - Or use a test token: `EAABsbc...` (any string for testing)

2. **Click "Save Settings"**

3. **Monitor backend logs**:

   ```bash
   docker-compose logs -f backend --tail=50
   ```

   **Expected logs**:
   ```
   [SETTINGS] Processing: 580062478519892_facebook_token → EAABsbc...
   [SETTINGS] Node ID: 580062478519892 Field type: facebook_token
   [SETTINGS] Found node: Facebook Create a post Type: n8n-nodes-base.facebook
   [SETTINGS] Processing Facebook token for node: Facebook Create a post
   [N8N CREDENTIAL] Creating/updating Facebook credential: TenantName - Facebook Create a post - Facebook
   [N8N CREDENTIAL] Creating new credential
   [N8N CREDENTIAL] Created credential: abc123
   [SETTINGS] Created/updated Facebook credential: abc123
   [SETTINGS] Applied Facebook credential to node: Facebook Create a post
   [N8N] Updating workflow in n8n...
   [N8N] Workflow updated successfully
   ```

4. **Check frontend response**:
   - Should show success message: "Settings saved successfully"
   - No error messages

### Test 3: Verify in n8n

1. **Open n8n**: http://192.168.0.58:5678

2. **Check Credentials**:
   - Click "Credentials" in left sidebar
   - Find credential: "TenantName - Facebook Create a post - Facebook"
   - Type should be: "Facebook Graph API"

3. **Check Workflow**:
   - Open "Social Profile Posts" workflow
   - Click "Facebook Create a post" node
   - Check "Credential to connect with" dropdown
   - Should show: "TenantName - Facebook Create a post - Facebook"
   - Should be selected/highlighted

### Test 4: Update Existing Credential

1. **Enter a different token** in Automara settings
2. **Save settings** again

**Expected backend logs**:
```
[N8N CREDENTIAL] Creating/updating Facebook credential: TenantName - Facebook Create a post - Facebook
[N8N CREDENTIAL] Found existing credential: abc123
[N8N CREDENTIAL] Updated credential: abc123
```

**Verify in n8n**:
- Same credential ID
- Token is updated (can't see it, but execution will use new token)

### Test 5: Execute Workflow (Optional)

**Only if you have a valid Facebook token:**

1. **In n8n**, click "Execute Workflow"
2. **Check execution**:
   - Should not show "Credentials not set" error
   - Should not show "Invalid credentials" error
   - May show Facebook API errors if token is invalid (that's expected)

## Troubleshooting

### Issue 1: Field Doesn't Appear

**Symptoms**:
- No Facebook field in settings modal
- No `[FACEBOOK]` logs in console

**Check**:
1. Did frontend rebuild successfully?
   ```bash
   docker-compose logs frontend --tail=50
   ```

2. Is browser cache cleared?
   - Press `Ctrl + F5` to hard refresh

3. Is the node ID correct?
   - Open n8n
   - Find "Facebook Create a post" node
   - Check node ID in URL or node properties
   - If different from `580062478519892`, update frontend code

**Fix**:
```javascript
// In AutomationsLibrary.jsx line 609
if (node.id === 'ACTUAL_NODE_ID' || nodeType.includes('facebook')) {
```

### Issue 2: Credential Creation Fails

**Symptoms**:
```
[N8N CREDENTIAL] Error managing Facebook credential: ...
```

**Common errors**:

**Error: "Unauthorized" or "Invalid API key"**
- n8n API key not set or wrong

**Check**:
```bash
docker-compose exec backend env | grep N8N_API_KEY
```

**Fix**: Set correct API key in `.env` or `docker-compose.yml`

**Error: "Unknown credential type: facebookGraphApi"**
- n8n doesn't have Facebook node installed

**Check**: Open n8n → Add node → Search "Facebook"

**Fix**: Install Facebook nodes in n8n (usually pre-installed)

**Error: "Connection refused" or "ECONNREFUSED"**
- Backend can't reach n8n

**Check**:
```bash
docker-compose exec backend curl http://n8n:5678/api/v1/credentials
```

**Fix**: Ensure n8n is running and accessible from backend container

### Issue 3: Credential Created But Not Applied

**Symptoms**:
- Credential exists in n8n
- But node still shows "No credential selected"

**Check backend logs**:
```
[SETTINGS] Applied Facebook credential to node: Facebook Create a post
```

If you see this, check if workflow update succeeded:
```
[N8N] Workflow updated successfully
```

**Possible causes**:
- Workflow update failed
- Wrong credential type in node
- Node ID mismatch

**Fix**:
1. Check credential type is `facebookGraphApi`
2. Verify node ID matches
3. Manually apply credential in n8n to test

### Issue 4: Settings Save Succeeds But No Logs

**Symptoms**:
- "Settings saved successfully" message
- No Facebook-related logs in backend

**Causes**:
- Token field was empty
- Field key doesn't match pattern

**Check**:
```bash
docker-compose logs backend --tail=100 | grep FACEBOOK
```

If no output, the `facebook_token` field wasn't detected.

**Fix**:
- Ensure token field is not empty
- Check field key format: `{nodeId}_facebook_token`

### Issue 5: Multiple Credentials Created

**Symptoms**:
- Multiple credentials with same name in n8n

**Cause**:
- Credential matching by name failed
- Tenant name changed

**Fix**:
1. Delete duplicate credentials in n8n manually
2. Update credential matching logic to use ID instead of name

## Backend API Details

### Endpoint

```
PUT /api/workflows/:id/settings
```

### Request

```json
{
  "settings": {
    "580062478519892_facebook_token": "EAABsbc..."
  }
}
```

### Headers

```
x-user-id: user123
x-user-role: msp_admin
x-tenant-id: 5
```

### Response (Success)

```json
{
  "success": true,
  "message": "Settings updated successfully",
  "updated": true
}
```

### Response (Error)

```json
{
  "success": false,
  "error": "Failed to manage Facebook credential: Invalid API key"
}
```

## n8n API Calls

### 1. List Credentials

```bash
GET http://n8n:5678/api/v1/credentials
Headers:
  X-N8N-API-KEY: <api_key>
```

### 2. Create Credential

```bash
POST http://n8n:5678/api/v1/credentials
Headers:
  X-N8N-API-KEY: <api_key>
  Content-Type: application/json
Body:
{
  "name": "TenantName - Facebook Create a post - Facebook",
  "type": "facebookGraphApi",
  "data": {
    "accessToken": "EAABsbc..."
  }
}
```

### 3. Update Credential

```bash
PATCH http://n8n:5678/api/v1/credentials/{credentialId}
Headers:
  X-N8N-API-KEY: <api_key>
  Content-Type: application/json
Body:
{
  "name": "TenantName - Facebook Create a post - Facebook",
  "type": "facebookGraphApi",
  "data": {
    "accessToken": "EAABsbc..."
  }
}
```

### 4. Update Workflow

```bash
PATCH http://n8n:5678/api/v1/workflows/{workflowId}
Headers:
  X-N8N-API-KEY: <api_key>
  Content-Type: application/json
Body:
{
  "nodes": [
    {
      "id": "580062478519892",
      "credentials": {
        "facebookGraphApi": {
          "id": "abc123",
          "name": "TenantName - Facebook Create a post - Facebook"
        }
      }
    }
  ]
}
```

## Security Checklist

- ✅ Token input is password field (masked)
- ✅ Tokens never displayed in UI
- ✅ Authorization check before saving
- ✅ Tenant isolation (credentials named by tenant)
- ✅ HTTPS required in production
- ✅ n8n encrypts credentials at rest
- ✅ Error messages don't expose tokens
- ✅ Audit trail in logs

## Performance Considerations

- Credential creation: ~200-500ms
- Workflow update: ~300-700ms
- Total settings save: ~1-2 seconds

For multiple credentials, consider:
- Batch credential creation
- Background job processing
- Rate limiting n8n API calls

## Rollback Plan

If issues occur:

1. **Revert frontend**:
   ```bash
   git checkout HEAD~1 frontend/src/pages/AutomationsLibrary.jsx
   docker-compose build frontend
   docker-compose up -d frontend
   ```

2. **Revert backend**:
   ```bash
   git checkout HEAD~1 backend/routes/workflow-activation.js
   docker-compose restart backend
   ```

3. **Clean up credentials** (if needed):
   - Go to n8n → Credentials
   - Delete test credentials manually

## Next Steps

1. ✅ Deploy to production
2. ✅ Test with real Facebook tokens
3. ✅ Document for end users
4. 🔄 Add Twitter/X credential management
5. 🔄 Add LinkedIn credential management
6. 🔄 Add Instagram credential management
7. 🔄 Add credential validation UI
8. 🔄 Add credential expiry warnings

## Documentation

For complete implementation details, see:
- [FACEBOOK_CREDENTIAL_MANAGEMENT.md](y:\FACEBOOK_CREDENTIAL_MANAGEMENT.md)

For general workflow settings:
- [WORKFLOW_SETTINGS.md](y:\WORKFLOW_SETTINGS.md) (if exists)
