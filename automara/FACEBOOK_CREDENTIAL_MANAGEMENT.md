# Facebook Credential Management

## Overview

The Automara platform now supports automatic Facebook credential management. Users can enter Facebook access tokens directly in the workflow settings, and the system will:

1. Create a credential in n8n with the access token
2. Apply the credential to the Facebook node automatically
3. Update the credential if it already exists

This eliminates the need for users to manually configure credentials in n8n.

## How It Works

### User Flow

1. **Open Workflow Settings**:
   - Navigate to Automations Library
   - Find "Social Profile Posts" workflow
   - Click the Settings button (⚙️ icon)

2. **Enter Facebook Access Token**:
   - Locate the Facebook node field: "Facebook Create a post - Facebook Access Token"
   - Enter your Facebook access token
   - The field is a password field for security

3. **Save Settings**:
   - Click "Save Settings"
   - Backend creates/updates credential in n8n
   - Credential is automatically applied to the Facebook node

4. **Verification**:
   - Check backend logs to confirm credential creation
   - Optionally verify in n8n: Credentials → See new credential
   - Execute the workflow to test

### Technical Flow

```
┌─────────────────┐
│  User enters    │
│  Facebook token │
│  in settings    │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Frontend sends │
│  settings to    │
│  backend API    │
└────────┬────────┘
         │
         v
┌─────────────────────────────┐
│  Backend detects            │
│  'facebook_token' field     │
└────────┬────────────────────┘
         │
         v
┌─────────────────────────────┐
│  Check if credential exists │
│  in n8n                     │
└────────┬────────────────────┘
         │
    ┌────┴─────┐
    │          │
    v          v
┌───────┐  ┌────────┐
│ Exists│  │ New    │
└───┬───┘  └───┬────┘
    │          │
    v          v
┌───────┐  ┌────────┐
│UPDATE │  │CREATE  │
└───┬───┘  └───┬────┘
    │          │
    └────┬─────┘
         │
         v
┌─────────────────────────────┐
│  Apply credential ID to     │
│  Facebook node in workflow  │
└────────┬────────────────────┘
         │
         v
┌─────────────────────────────┐
│  Update workflow in n8n     │
└────────┬────────────────────┘
         │
         v
┌─────────────────────────────┐
│  Update database            │
└────────┬────────────────────┘
         │
         v
┌─────────────────────────────┐
│  Return success to frontend │
└─────────────────────────────┘
```

## Implementation Details

### Frontend: AutomationsLibrary.jsx

**Lines 608-628**: Facebook field detection

```javascript
// Facebook nodes - Special handling for node 580062478519892
if (node.id === '580062478519892' || nodeType.includes('facebook')) {
  console.log('[FACEBOOK] Processing Facebook node:', node.name, 'ID:', node.id);

  // Facebook Access Token field (always empty for security)
  fields.push({
    key: `${node.id}_facebook_token`,
    label: `${node.name} - Facebook Access Token`,
    type: 'password',
    nodeId: node.id,
    nodeName: node.name,
    nodeType: 'facebook',
    placeholder: 'Enter Facebook Access Token',
    defaultValue: '',
    required: false,
    helpText: 'This token will be stored as a credential in n8n and applied to this node'
  });
}
```

**Key points**:
- Detects Facebook nodes by ID `580062478519892` or node type containing "facebook"
- Creates a password field for security
- Field is always empty (never shows existing tokens)
- Help text explains what happens when saved

### Backend: workflow-activation.js

**Lines 17-90**: Facebook credential management function

```javascript
async function createOrUpdateFacebookCredential(credentialName, accessToken) {
  // Check if credential already exists
  const credentialsResponse = await axios.get(`${N8N_API_URL}/credentials`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });

  const existingCredential = credentialsResponse.data.data.find(
    cred => cred.name === credentialName && cred.type === 'facebookGraphApi'
  );

  if (existingCredential) {
    // Update existing credential
    const updateResponse = await axios.patch(
      `${N8N_API_URL}/credentials/${existingCredential.id}`,
      {
        name: credentialName,
        type: 'facebookGraphApi',
        data: { accessToken: accessToken }
      },
      { headers: { 'X-N8N-API-KEY': N8N_API_KEY } }
    );
    return updateResponse.data.id;
  } else {
    // Create new credential
    const createResponse = await axios.post(
      `${N8N_API_URL}/credentials`,
      {
        name: credentialName,
        type: 'facebookGraphApi',
        data: { accessToken: accessToken }
      },
      { headers: { 'X-N8N-API-KEY': N8N_API_KEY } }
    );
    return createResponse.data.id;
  }
}
```

**Lines 814-844**: Facebook token handling in settings

```javascript
else if (fieldType === 'facebook_token') {
  console.log('[SETTINGS] Processing Facebook token for node:', node.name);

  if (!settingValue || settingValue.trim() === '') {
    console.log('[SETTINGS] Skipping empty Facebook token');
  } else {
    // Create credential name based on tenant and node
    const credentialName = `${tenantName} - ${node.name} - Facebook`;

    // Create or update the credential in n8n
    const credentialId = await createOrUpdateFacebookCredential(credentialName, settingValue);

    // Apply the credential to the node
    node.credentials = node.credentials || {};
    node.credentials.facebookGraphApi = {
      id: credentialId,
      name: credentialName
    };

    updated = true;
    console.log('[SETTINGS] Applied Facebook credential to node:', node.name);
  }
}
```

**Key points**:
- Detects `facebook_token` field type
- Creates credential with tenant-scoped name
- Updates if credential already exists
- Applies credential reference to node
- Handles errors gracefully (doesn't fail entire settings update)

## n8n Credential Structure

### Credential Type

The credential uses n8n's built-in `facebookGraphApi` credential type.

### Credential Object

```json
{
  "id": "abc123",
  "name": "TenantName - Facebook Create a post - Facebook",
  "type": "facebookGraphApi",
  "data": {
    "accessToken": "EAABsbc..."
  }
}
```

### Node Credential Reference

When applied to a node:

```json
{
  "id": "580062478519892",
  "name": "Facebook Create a post",
  "type": "n8n-nodes-base.facebook",
  "credentials": {
    "facebookGraphApi": {
      "id": "abc123",
      "name": "TenantName - Facebook Create a post - Facebook"
    }
  },
  "parameters": {
    "operation": "create",
    "resourceType": "post"
  }
}
```

## Credential Naming Convention

Format: `{TenantName} - {NodeName} - Facebook`

Examples:
- `Acme Corp - Facebook Create a post - Facebook`
- `TechCo - FB Post - Facebook`
- `Unknown - Facebook Create a post - Facebook` (if tenant not found)

Benefits:
- Easy to identify which tenant owns the credential
- Clear which node it's for
- Consistent naming across all credentials

## Security Considerations

### Frontend Security

1. **Password Field**: Token input is masked
2. **No Display**: Existing tokens are never displayed
3. **Empty Default**: Field always starts empty
4. **HTTPS Only**: Credentials transmitted over HTTPS

### Backend Security

1. **Authentication Required**: All requests require valid user auth
2. **Authorization Check**: Verify user has access to tenant
3. **Secure Storage**: Tokens stored in n8n's credential system
4. **Error Handling**: Errors don't expose sensitive data
5. **Audit Trail**: All operations logged

### n8n Security

1. **Encrypted Storage**: n8n encrypts credentials at rest
2. **API Key Required**: All credential operations require n8n API key
3. **Credential Isolation**: Credentials are scoped to workflows

## Testing

### Step 1: Start Docker Containers

```bash
# On server 192.168.0.58
docker-compose ps

# Ensure all containers are running
```

### Step 2: Rebuild Containers

```bash
# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend

# Restart backend
docker-compose restart backend
```

### Step 3: Test in Browser

1. **Navigate to Automations Library**:
   - Go to http://192.168.0.58
   - Login as MSP_Admin
   - Click "Automations Library"

2. **Open Workflow Settings**:
   - Find "Social Profile Posts" workflow
   - Click Settings button
   - **Open browser console (F12)**

3. **Check for Facebook Field**:

   Look for console logs:
   ```
   [FACEBOOK] Processing Facebook node: Facebook Create a post ID: 580062478519892
   [FACEBOOK] Node parameters: {...}
   [FACEBOOK] Added Facebook token field for node: Facebook Create a post
   ```

   Look for the field in settings modal:
   ```
   Facebook Create a post - Facebook Access Token
   [Password field: **********************]
   This token will be stored as a credential in n8n and applied to this node
   ```

4. **Enter Test Token**:
   - Enter a test Facebook access token
   - Click "Save Settings"

5. **Monitor Backend Logs**:

   ```bash
   docker-compose logs -f backend --tail=50
   ```

   **Expected logs**:
   ```
   [SETTINGS] Processing Facebook token for node: Facebook Create a post
   [N8N CREDENTIAL] Creating/updating Facebook credential: TenantName - Facebook Create a post - Facebook
   [N8N CREDENTIAL] Found existing credential: abc123
   [N8N CREDENTIAL] Updated credential: abc123
   [SETTINGS] Created/updated Facebook credential: abc123
   [SETTINGS] Applied Facebook credential to node: Facebook Create a post
   [N8N] Updating workflow in n8n...
   [N8N] Workflow updated successfully
   ```

6. **Verify in n8n**:
   - Go to http://192.168.0.58:5678
   - Click "Credentials" in sidebar
   - Find credential: "TenantName - Facebook Create a post - Facebook"
   - Should show type: "Facebook Graph API"

7. **Verify in Workflow**:
   - Open "Social Profile Posts" workflow in n8n
   - Click on "Facebook Create a post" node
   - Check credentials dropdown
   - Should show the credential is selected

### Step 4: Test Execution

1. **Trigger Workflow**:
   - In n8n, click "Execute Workflow"
   - Or trigger via webhook/schedule

2. **Check Execution**:
   - Should execute without credential errors
   - If token is valid, Facebook post should be created
   - If token is invalid, you'll see Facebook API error (not credential error)

## Troubleshooting

### Issue 1: Field Doesn't Appear

**Check browser console**:

```
[FACEBOOK] Processing Facebook node: ...
```

If you don't see this:
- Node ID might not be 580062478519892
- Node type might not contain "facebook"
- Frontend hasn't been rebuilt

**Solution**:
1. Check the actual node ID in n8n
2. Update the condition in AutomationsLibrary.jsx
3. Rebuild frontend

### Issue 2: Credential Creation Fails

**Check backend logs**:

```
[N8N CREDENTIAL] Error managing Facebook credential: ...
```

**Common causes**:
- n8n API key not set or invalid
- n8n not reachable
- Wrong credential type name

**Solution**:
1. Verify n8n is running: `docker-compose ps`
2. Check n8n API key in environment: `echo $N8N_API_KEY`
3. Test n8n API: `curl http://n8n:5678/api/v1/credentials -H "X-N8N-API-KEY: $N8N_API_KEY"`

### Issue 3: Credential Not Applied to Node

**Check backend logs**:

```
[SETTINGS] Applied Facebook credential to node: ...
```

If you see this but credential isn't applied in n8n:
- Workflow update might have failed
- Node ID might be wrong

**Solution**:
1. Check if workflow update succeeded
2. Verify node ID matches
3. Check n8n workflow JSON structure

### Issue 4: Token Doesn't Work

**Check Facebook API response**:

```
Error: Invalid OAuth access token
```

This is a Facebook issue, not Automara:
- Token might be expired
- Token might have wrong permissions
- Token might be for wrong Facebook account

**Solution**:
1. Generate a new token from Facebook Graph API Explorer
2. Ensure token has required permissions:
   - `pages_manage_posts`
   - `pages_read_engagement`
3. Update token in Automara settings

## Facebook Access Token Setup

### How to Get a Facebook Access Token

1. **Go to Facebook Graph API Explorer**:
   - https://developers.facebook.com/tools/explorer/

2. **Select Your App**:
   - Click "Meta App" dropdown
   - Select your Facebook app
   - Or create a new app if you don't have one

3. **Generate Token**:
   - Click "Generate Access Token"
   - Grant requested permissions
   - Copy the token

4. **Get Long-Lived Token** (recommended):
   - Short-lived tokens expire in 1-2 hours
   - Long-lived tokens last 60 days
   - Use Facebook's "Access Token Debugger" to extend

5. **Required Permissions**:
   - `pages_manage_posts` - Create posts
   - `pages_read_engagement` - Read post metrics
   - `pages_show_list` - List pages
   - `publish_to_groups` - (if posting to groups)

### Token Types

| Type | Duration | Use Case |
|------|----------|----------|
| **User Access Token** | 1-2 hours | Testing only |
| **Page Access Token** | Never expires | Production recommended |
| **Long-Lived Token** | 60 days | Good for automation |
| **System User Token** | Never expires | Best for business apps |

**For Automara, use Page Access Token or System User Token**.

## Extending to Other Social Platforms

This pattern can be extended to other platforms:

### Twitter/X

```javascript
// Frontend
if (node.id === 'TWITTER_NODE_ID' || nodeType.includes('twitter')) {
  fields.push({
    key: `${node.id}_twitter_token`,
    label: `${node.name} - Twitter/X API Key`,
    type: 'password',
    nodeType: 'twitter',
    ...
  });
}

// Backend
async function createOrUpdateTwitterCredential(credentialName, apiKey, apiSecret) {
  return await axios.post(`${N8N_API_URL}/credentials`, {
    name: credentialName,
    type: 'twitterOAuth2Api',
    data: { apiKey, apiSecret }
  });
}
```

### LinkedIn

```javascript
// Backend
async function createOrUpdateLinkedInCredential(credentialName, accessToken) {
  return await axios.post(`${N8N_API_URL}/credentials`, {
    name: credentialName,
    type: 'linkedInOAuth2Api',
    data: { accessToken }
  });
}
```

### Instagram

```javascript
// Backend
async function createOrUpdateInstagramCredential(credentialName, accessToken) {
  return await axios.post(`${N8N_API_URL}/credentials`, {
    name: credentialName,
    type: 'instagramBusinessApi',
    data: { accessToken }
  });
}
```

## Files Changed

### Frontend
- [AutomationsLibrary.jsx:608-628](y:\frontend\src\pages\AutomationsLibrary.jsx#L608-L628) - Facebook field detection

### Backend
- [workflow-activation.js:17-90](y:\backend\routes\workflow-activation.js#L17-L90) - Credential management function
- [workflow-activation.js:645-653](y:\backend\routes\workflow-activation.js#L645-L653) - Get tenant name for credentials
- [workflow-activation.js:655-848](y:\backend\routes\workflow-activation.js#L655-L848) - Settings loop changed to async for...of
- [workflow-activation.js:814-844](y:\backend\routes\workflow-activation.js#L814-L844) - Facebook token handling

## Next Steps

1. ✅ Deploy updated code to server
2. ✅ Test Facebook credential creation
3. ✅ Verify workflow execution with credential
4. ✅ Document for end users
5. 🔄 Extend to other social platforms (Twitter, LinkedIn, Instagram)
6. 🔄 Add credential validation before saving
7. 🔄 Add UI to view/delete credentials
8. 🔄 Add credential expiry warnings
