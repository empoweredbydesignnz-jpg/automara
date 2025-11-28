# Workflow Settings Auto-Population

## Overview

Workflow settings now automatically populate API URLs and endpoint fields detected from the workflow's n8n configuration, while keeping all credentials and secrets empty for security.

## What Changed

### File: `y:\frontend\src\pages\AutomationsLibrary.jsx`

#### 1. Enhanced Field Extraction (`extractRequiredFields`)

The function now:
- Parses `node.parameters` from workflow data
- Extracts URLs, endpoints, and configuration values
- Auto-populates non-sensitive fields with detected values
- Keeps all password/credential fields empty

**Detection Logic**:
```javascript
// Helper function to extract URLs from various parameter names
const extractUrl = (params) => {
  if (params.url) return params.url;
  if (params.uri) return params.uri;
  if (params.endpoint) return params.endpoint;
  if (params.baseUrl) return params.baseUrl;
  if (params.baseURL) return params.baseURL;
  if (params.host) return params.host;
  return null;
};
```

#### 2. Auto-Population by Node Type

**HTTP Request Nodes**:
- ✅ API Endpoint → Auto-populated from `url`, `uri`, `endpoint`, `baseUrl`, etc.
- ❌ API Key → Always empty (security)

**Webhook Nodes**:
- ✅ Webhook URL → Auto-populated from `path`, `webhookUrl`, `url`

**Email/SMTP Nodes**:
- ✅ Email Address → Auto-populated from `fromEmail`, `toEmail`, `email`
- ✅ SMTP Host → Auto-populated from `host`, `smtpHost`
- ❌ SMTP Password → Always empty (security)

**Slack Nodes**:
- ✅ Slack Channel → Auto-populated from `channel`, `channelId`
- ❌ Slack Token → Always empty (security)

**Database Nodes**:
- ✅ Database Host → Auto-populated from `host`
- ✅ Database Name → Auto-populated from `database`, `databaseName`
- ✅ Database User → Auto-populated from `user`, `username`
- ❌ Database Password → Always empty (security)

**Google Nodes**:
- ❌ Google Credentials → Always empty (security)

**Generic Credentials**:
- ❌ All credential fields → Always empty (security)

#### 3. Updated Modal Initialization (`handleOpenSettings`)

When opening the settings modal:
1. Load saved configuration from localStorage
2. Extract fields with default values from workflow
3. Build initial config with priority:
   - **Highest**: Saved values from localStorage
   - **Medium**: Default values from workflow parameters
   - **Lowest**: Empty string

```javascript
const initialConfig = {};
fields.forEach(field => {
  if (savedConfig[field.key] !== undefined && savedConfig[field.key] !== '') {
    // Use saved value if it exists
    initialConfig[field.key] = savedConfig[field.key];
  } else if (field.defaultValue) {
    // Use default value from workflow if no saved value exists
    initialConfig[field.key] = field.defaultValue;
  } else {
    // Empty string as fallback
    initialConfig[field.key] = '';
  }
});
```

## User Experience

### Before This Update

When opening workflow settings:
```
API Endpoint: [                    ]  ← Empty
API Key:      [                    ]  ← Empty
```

User had to manually enter both the endpoint AND the API key.

### After This Update

When opening workflow settings:
```
API Endpoint: [https://api.example.com/v1]  ← Auto-populated!
API Key:      [                           ]  ← Empty (security)
```

User only needs to enter the API key. The endpoint is already filled in from the workflow.

## Example Scenarios

### Scenario 1: HTTP Request Node

**Workflow n8n_data**:
```json
{
  "nodes": [
    {
      "id": "http123",
      "name": "Get Weather Data",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.openweathermap.org/data/2.5/weather",
        "method": "GET"
      }
    }
  ]
}
```

**Settings Modal Shows**:
- **Get Weather Data - API Endpoint**: `https://api.openweathermap.org/data/2.5/weather` ✅ Auto-filled
- **Get Weather Data - API Key**: `` (empty) ← User enters their key

### Scenario 2: Database Node

**Workflow n8n_data**:
```json
{
  "nodes": [
    {
      "id": "db456",
      "name": "Customer Database",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "host": "db.example.com:5432",
        "database": "customers",
        "user": "api_user"
      }
    }
  ]
}
```

**Settings Modal Shows**:
- **Customer Database - Database Host**: `db.example.com:5432` ✅ Auto-filled
- **Customer Database - Database Name**: `customers` ✅ Auto-filled
- **Customer Database - Database User**: `api_user` ✅ Auto-filled
- **Customer Database - Database Password**: `` (empty) ← User enters password

### Scenario 3: Slack Node

**Workflow n8n_data**:
```json
{
  "nodes": [
    {
      "id": "slack789",
      "name": "Post to Slack",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "channel": "#alerts"
      }
    }
  ]
}
```

**Settings Modal Shows**:
- **Post to Slack - Slack Channel**: `#alerts` ✅ Auto-filled
- **Post to Slack - Slack Token**: `` (empty) ← User enters token

## Security Considerations

### What Gets Auto-Populated

✅ **Safe to auto-populate**:
- API endpoints (URLs)
- Email addresses
- SMTP hosts
- Database hosts and names
- Database usernames
- Slack channels
- Webhook URLs

### What Stays Empty

❌ **Never auto-populated** (security):
- API keys
- API secrets
- Passwords
- OAuth tokens
- Google service account credentials
- Any field with `type: 'password'`
- Any credential fields

## Benefits

1. **Faster Configuration**: Users don't need to copy-paste URLs and endpoints
2. **Fewer Errors**: Auto-populated values are accurate from the workflow
3. **Better UX**: Only sensitive fields require user input
4. **Maintains Security**: Credentials never pre-filled
5. **Preserves User Changes**: Saved values take priority over defaults

## Testing

### How to Test

1. **Create or import a workflow** with HTTP Request nodes that have URLs configured
2. **Open Automations Library**
3. **Click the settings icon** (⚙️) on a workflow card
4. **Verify**:
   - API endpoint fields are pre-filled with URLs from the workflow
   - API key fields are empty
   - Database hosts/names are pre-filled (if applicable)
   - Passwords are empty

### Test Cases

- [ ] HTTP Request node with URL → Endpoint auto-filled
- [ ] Database node with host/name → Host and name auto-filled
- [ ] Slack node with channel → Channel auto-filled
- [ ] Email node with SMTP host → Host auto-filled
- [ ] All password fields remain empty
- [ ] API key fields remain empty
- [ ] Saved values override defaults
- [ ] Empty workflows don't cause errors

## Console Logging

The feature includes debug logging:

```javascript
console.log('Processing node:', node.name, 'type:', nodeType, 'parameters:', params);
console.log('Initial config with defaults:', initialConfig);
```

Check browser console (F12) to see detected values.

## Customization

### Adding New Field Types

To auto-populate additional field types, edit `extractRequiredFields`:

```javascript
// Example: Adding FTP nodes
if (nodeType.includes('ftp')) {
  const ftpHost = params.host || params.server || '';

  fields.push({
    key: `${node.id}_ftp_host`,
    label: `${node.name} - FTP Host`,
    type: 'text',
    defaultValue: ftpHost,  // Auto-populated
    required: false
  });

  fields.push({
    key: `${node.id}_ftp_password`,
    label: `${node.name} - FTP Password`,
    type: 'password',
    defaultValue: '',  // Always empty
    required: false
  });
}
```

### Adding New Parameter Detection

To detect additional parameter names for URLs:

```javascript
const extractUrl = (params) => {
  if (params.url) return params.url;
  if (params.uri) return params.uri;
  if (params.endpoint) return params.endpoint;
  if (params.apiUrl) return params.apiUrl;  // Add new detection
  if (params.serviceUrl) return params.serviceUrl;  // Add new detection
  // ... existing code
  return null;
};
```

## Troubleshooting

### Issue: Fields Not Auto-Populated

**Solution 1 - Check workflow data exists**:
- Open browser console (F12)
- Look for: `"Processing node: [name] type: [type] parameters: [object]"`
- Verify parameters object contains the expected values

**Solution 2 - Check parameter names**:
- The workflow might use different parameter names
- Add console.log to see actual parameter names:
  ```javascript
  console.log('Node parameters:', Object.keys(params));
  ```
- Update extraction logic to match actual names

### Issue: Values Override User Changes

This shouldn't happen because of the priority logic:
1. Saved values (highest priority)
2. Default values (medium priority)
3. Empty string (lowest priority)

If it does happen, check localStorage:
```javascript
// In browser console
JSON.parse(localStorage.getItem('workflow_configs'))
```

### Issue: Sensitive Data Appears

This is a security issue! Verify:
1. Field type is set to `'password'` for sensitive fields
2. `defaultValue` is explicitly set to `''` (empty string)
3. No credentials are stored in workflow n8n_data

## Files Modified

- **y:\frontend\src\pages\AutomationsLibrary.jsx**
  - `extractRequiredFields()` function (lines 340-591)
  - `handleOpenSettings()` function (lines 623-655)

## Related Documentation

- [TICKET_NUMBERS_SUMMARY.txt](y:\TICKET_NUMBERS_SUMMARY.txt) - Ticket reference numbers
- [DASHBOARD_TICKETS_FEATURE.md](y:\DASHBOARD_TICKETS_FEATURE.md) - Dashboard tickets card
- [FIX_TICKET_NUMBERS.md](y:\FIX_TICKET_NUMBERS.md) - Ticket number migration

## Summary

✅ API URLs auto-populate from workflow configuration
✅ Database hosts, names, and users auto-populate
✅ Email addresses and SMTP hosts auto-populate
✅ Slack channels auto-populate
✅ Webhook URLs auto-populate
❌ API keys, passwords, tokens always remain empty
✅ Saved values take priority over defaults
✅ Works with all existing node types
✅ No backend changes required
✅ Effective immediately after browser refresh

**Just refresh your browser to use the new auto-population feature!**
