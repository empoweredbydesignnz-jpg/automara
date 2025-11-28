# DeepSeek Field Debugging Guide

## Current Status

The code to detect and display the DeepSeek search prompt field has been added to the frontend, but **Docker is not currently running**, so the frontend container needs to be rebuilt to apply the changes.

## What Was Changed

### Frontend: AutomationsLibrary.jsx (Lines 416-479)

Added detection logic for the DeepSeek HTTP request node with comprehensive debug logging:

```javascript
// Special case: DeepSeek search prompt (for HTTP DeepSeek Request node)
console.log('[DEEPSEEK CHECK] Node ID:', node.id, 'Name:', node.name);
console.log('[DEEPSEEK CHECK] Matches deRn1CKUTS9UUMzs?', node.id === 'deRn1CKUTS9UUMzs');
console.log('[DEEPSEEK CHECK] Name includes deepseek?', node.name?.toLowerCase().includes('deepseek'));

if (node.id === 'deRn1CKUTS9UUMzs' || node.name?.toLowerCase().includes('deepseek')) {
  // Extract prompt from bodyParametersJson or options.body.values
  // Creates textarea field in settings modal
}
```

## Steps to Apply Changes and Debug

### Step 1: Start Docker Desktop

1. Open Docker Desktop application
2. Wait for Docker to fully start (whale icon stops animating)

### Step 2: Rebuild Frontend Container

Once Docker is running, execute this command:

```bash
docker-compose -p automara up -d --build frontend
```

This will:
- Build the frontend with the updated code
- Restart the frontend container
- Takes approximately 2-3 minutes

**Watch for build output:**
```
[+] Building frontend
 => [frontend builder 1/6] FROM node:18-alpine
 => [frontend builder 2/6] WORKDIR /app
 => [frontend builder 3/6] COPY package*.json ./
 => [frontend builder 4/6] RUN npm install
 => [frontend builder 5/6] COPY . .
 => [frontend builder 6/6] RUN npm run build  ← This compiles the updated code
```

### Step 3: Clear Browser Cache

After the frontend container is rebuilt:

1. Open your browser
2. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
3. Select "Cached images and files"
4. Click "Clear data"
5. **OR** do a hard refresh: `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)

### Step 4: Test the DeepSeek Field

1. Navigate to Automations Library page
2. Find the "Social Profile Posts" workflow
3. Click the **Settings** button (⚙️ icon)
4. **Open browser console** (Press F12 → Console tab)

### Step 5: Check Debug Logs

In the browser console, you should see logs like this:

```
[DEEPSEEK CHECK] Node ID: deRn1CKUTS9UUMzs Name: Http Deep Seek request
[DEEPSEEK CHECK] Matches deRn1CKUTS9UUMzs? true
[DEEPSEEK CHECK] Name includes deepseek? true
[DEEPSEEK] Processing DeepSeek node: Http Deep Seek request
[DEEPSEEK] Node parameters: {...}
```

### Step 6: Look for the Textarea Field

In the settings modal, you should see:

```
┌─────────────────────────────────────────────────────┐
│ Workflow Settings                                   │
│ Social Profile Posts                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ APIs                                                │
│ ┌─────────────────────────────────────────────┐    │
│ │ ... existing API fields ...                 │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ Http Deep Seek request - Search Prompt  ← NEW!     │
│ ┌─────────────────────────────────────────────┐    │
│ │ Enter what you want DeepSeek to search      │    │
│ │ for...                                      │    │
│ │                                             │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ [Save Settings] [Cancel]                           │
└─────────────────────────────────────────────────────┘
```

## Troubleshooting

### Issue 1: No Debug Logs Appearing

**Problem**: Console shows no `[DEEPSEEK CHECK]` logs at all.

**Solutions**:
1. Frontend didn't rebuild → Re-run Step 2
2. Browser cache → Clear cache (Step 3)
3. Wrong workflow → Make sure it's "Social Profile Posts" workflow

### Issue 2: Logs Show "Matches deRn1CKUTS9UUMzs? false"

**Problem**: The node ID doesn't match what we're checking for.

**Solution**: Check the console log for the actual node ID:
```
[DEEPSEEK CHECK] Node ID: xyz123abc Name: Http Deep Seek request
[DEEPSEEK CHECK] Matches deRn1CKUTS9UUMzs? false  ← Different ID!
```

If the ID is different, we need to update the code to match the actual ID.

**Share this info**:
```
Actual Node ID: xyz123abc
Actual Node Name: Http Deep Seek request
```

### Issue 3: Logs Show "Name includes deepseek? false"

**Problem**: The node name doesn't contain "deepseek".

**Solution**: Check the console log for the actual node name:
```
[DEEPSEEK CHECK] Node ID: deRn1CKUTS9UUMzs Name: HTTP Request
[DEEPSEEK CHECK] Name includes deepseek? false  ← Different name!
```

If the name is different, we need to update the code to check for the actual name.

**Share this info**:
```
Actual Node Name: HTTP Request
```

### Issue 4: Field Appears But Is Empty

**Problem**: Textarea field shows up but has no default value.

**Solution**: Check the console log for node parameters:
```
[DEEPSEEK] Node parameters: {...}
```

The parameter structure might be different than expected. Share the full `Node parameters` object from the console.

### Issue 5: Docker Build Fails

**Problem**: Frontend container fails to build.

**Check backend logs**:
```bash
docker logs automara-frontend --tail=50
```

**Common issues**:
- Node modules installation error → Delete `node_modules` and retry
- Syntax error in code → Check build output for error details
- Port already in use → Stop other containers using port 80

## What Happens When You Save Settings

Once the textarea field appears and you modify it:

1. **Frontend** sends the new prompt to backend:
   ```javascript
   PUT /api/workflows/:id/settings
   Body: {
     settings: {
       "deRn1CKUTS9UUMzs_deepseek_prompt": "Your new search prompt here"
     }
   }
   ```

2. **Backend** updates the n8n workflow:
   - Fetches workflow from n8n
   - Finds the DeepSeek node
   - Updates the `bodyParametersJson.messages[].content` field
   - Pushes updated workflow back to n8n
   - Updates database

3. **n8n** receives the updated workflow:
   - Next execution will use the new prompt
   - No need to manually edit in n8n

## Quick Reference Commands

### Check Docker Status
```bash
docker ps
```

### Rebuild Frontend
```bash
docker-compose -p automara up -d --build frontend
```

### View Frontend Logs
```bash
docker logs -f automara-frontend --tail=50
```

### View Backend Logs
```bash
docker logs -f automara-backend --tail=50
```

### Restart All Containers
```bash
docker-compose -p automara restart
```

## Next Steps

1. ✅ Start Docker Desktop
2. ✅ Rebuild frontend container
3. ✅ Clear browser cache
4. ✅ Open workflow settings
5. ✅ Check browser console for debug logs
6. ✅ Look for textarea field
7. ✅ Test saving new prompt
8. ✅ Verify prompt updates in n8n

## If Field Still Doesn't Appear

Share these details:

1. **Console logs** (all `[DEEPSEEK CHECK]` and `[DEEPSEEK]` entries)
2. **Actual node ID** from the logs
3. **Actual node name** from the logs
4. **Frontend build output** (if any errors)
5. **Screenshot** of the settings modal

This will help identify the exact issue and adjust the code accordingly.
