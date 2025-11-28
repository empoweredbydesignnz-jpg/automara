# Deploy DeepSeek Field Feature to 192.168.0.58

## What Was Changed

### Frontend: AutomationsLibrary.jsx (Lines 416-525)

Enhanced DeepSeek field extraction with comprehensive logging to detect the "text" field in multiple locations:

1. **bodyParametersJson.text** - Direct text field in JSON body
2. **bodyParametersJson.messages[].content** - Messages array format
3. **options.body.values** - Options format with text or messages field
4. **sendBody.text** - Alternative body parameter format

### Backend: workflow-activation.js (Lines 613-710)

Enhanced settings update to handle the "text" field in multiple locations:

1. **bodyParametersJson.text** - Updates direct text field
2. **bodyParametersJson.messages[].content** - Updates messages array
3. **options.body.values (text field)** - Updates text in options
4. **options.body.values (messages field)** - Updates messages in options
5. **sendBody.text** - Updates text in sendBody parameter

## Deployment Steps

### Step 1: Connect to Remote Docker Server

If you're deploying from your local machine to the remote server:

```bash
# Option A: If docker-compose is configured to use remote Docker daemon
export DOCKER_HOST=tcp://192.168.0.58:2375

# Option B: SSH into the remote server
ssh user@192.168.0.58
cd /path/to/automara
```

### Step 2: Copy Updated Files to Server

If deploying from local machine, copy the updated files:

```bash
# Copy frontend file
scp y:\frontend\src\pages\AutomationsLibrary.jsx user@192.168.0.58:/path/to/automara/frontend/src/pages/

# Copy backend file
scp y:\backend\routes\workflow-activation.js user@192.168.0.58:/path/to/automara/backend/routes/
```

**OR** if your y:\ drive is already on the server, skip this step.

### Step 3: Rebuild Frontend Container

```bash
# Rebuild frontend with updated code
docker-compose build frontend

# Restart frontend container
docker-compose up -d frontend
```

**Expected output:**
```
Building frontend
[+] Building 120.5s (12/12) FINISHED
 => [builder 1/6] FROM node:18-alpine
 => [builder 2/6] WORKDIR /app
 => [builder 3/6] COPY package*.json ./
 => [builder 4/6] RUN npm install
 => [builder 5/6] COPY . .
 => [builder 6/6] RUN npm run build  ← Compiles updated AutomationsLibrary.jsx
 => [stage-1 1/3] FROM nginx:alpine
 => [stage-1 2/3] COPY nginx.conf
 => [stage-1 3/3] COPY --from=builder /app/dist
```

Build time: ~2-3 minutes

### Step 4: Restart Backend Container

```bash
# Restart backend to load updated code
docker-compose restart backend
```

**Expected output:**
```
Restarting automara-backend ... done
```

Restart time: ~5 seconds

### Step 5: Verify Containers Are Running

```bash
docker-compose ps
```

**Expected output:**
```
NAME                STATUS         PORTS
automara-backend    Up 10 seconds  0.0.0.0:3001->3001/tcp
automara-frontend   Up 2 minutes   0.0.0.0:80->80/tcp
automara-postgres   Up 5 days      0.0.0.0:5432->5432/tcp
automara-n8n        Up 5 days      0.0.0.0:5678->5678/tcp
```

### Step 6: Check Backend Logs

Monitor backend startup:

```bash
docker-compose logs -f backend --tail=20
```

**Look for:**
```
Server running on port 3001
Connected to database
```

Press `Ctrl+C` to stop following logs.

### Step 7: Test in Browser

1. **Clear browser cache**:
   - Press `Ctrl + Shift + Delete`
   - Select "Cached images and files"
   - Click "Clear data"
   - **OR** hard refresh: `Ctrl + F5`

2. **Navigate to Automations Library**:
   - Go to http://192.168.0.58 (or your frontend URL)
   - Login as MSP_Admin
   - Click on "Automations Library"

3. **Open Workflow Settings**:
   - Find "Social Profile Posts" workflow
   - Click the Settings button (⚙️ icon)

4. **Open Browser Console** (F12 → Console tab)

5. **Check for Debug Logs**:

You should see extensive logging like:

```
[DEEPSEEK CHECK] Node ID: deRn1CKUTS9UUMzs Name: Http Deep Seek request
[DEEPSEEK CHECK] Matches deRn1CKUTS9UUMzs? true
[DEEPSEEK CHECK] Name includes deepseek? true
[DEEPSEEK] Processing DeepSeek node: Http Deep Seek request
[DEEPSEEK] Full node parameters: {
  "authentication": "predefinedCredentialType",
  "nodeCredentialType": "httpHeaderAuth",
  "url": "https://api.deepseek.com/v1/chat/completions",
  "method": "POST",
  "bodyParametersJson": "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"system\",\"content\":\"You are a helpful assistant\"},{\"role\":\"user\",\"content\":\"...\"}],\"temperature\":0.7,\"max_tokens\":1000,\"text\":\"What topics should I post about?\"}"
}
[DEEPSEEK] Found bodyParametersJson
[DEEPSEEK] Parsed bodyJson: {
  "model": "deepseek-chat",
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 1000,
  "text": "What topics should I post about?"  ← THIS IS THE FIELD!
}
[DEEPSEEK] Found text field: What topics should I post about?
[DEEPSEEK] Final extracted prompt: What topics should I post about?
[DEEPSEEK] Added field to settings: {
  key: "deRn1CKUTS9UUMzs_deepseek_prompt",
  defaultValue: "What topics should I post about?"
}
```

6. **Look for the Textarea Field**:

In the settings modal, you should now see:

```
┌─────────────────────────────────────────────────────┐
│ Workflow Settings                                   │
│ Social Profile Posts                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ APIs                                                │
│ ┌─────────────────────────────────────────────┐    │
│ │ OpenAI API Key: ****************            │    │
│ │ DeepSeek API Key: ****************          │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ Http Deep Seek request - Search Prompt             │  ← NEW!
│ ┌─────────────────────────────────────────────┐    │
│ │ What topics should I post about?            │    │
│ │                                             │    │
│ │                                             │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ [Save Settings] [Cancel]                           │
└─────────────────────────────────────────────────────┘
```

### Step 8: Test Saving Settings

1. **Modify the prompt** in the textarea:
   ```
   What are the best times to post on social media?
   ```

2. **Click "Save Settings"**

3. **Check backend logs**:
   ```bash
   docker-compose logs -f backend --tail=50
   ```

   **Look for:**
   ```
   [SETTINGS] Updating DeepSeek prompt for node: Http Deep Seek request
   [SETTINGS] Node parameters: {...}
   [SETTINGS] Found bodyParametersJson: {...}
   [SETTINGS] Updating "text" field from: What topics should I post about? to: What are the best times to post on social media?
   [SETTINGS] Updated DeepSeek "text" field in bodyParametersJson
   [N8N] Updating workflow in n8n...
   [N8N] Successfully updated workflow in n8n
   ```

4. **Verify in n8n**:
   - Go to http://192.168.0.58:5678
   - Open the "Social Profile Posts" workflow
   - Click on the "Http Deep Seek request" node
   - Check the JSON body
   - The "text" field should now show: "What are the best times to post on social media?"

## Troubleshooting

### Issue 1: Field Doesn't Appear

**Check browser console logs:**

If you see:
```
[DEEPSEEK CHECK] Node ID: xyz123 Name: HTTP Request
[DEEPSEEK CHECK] Matches deRn1CKUTS9UUMzs? false
[DEEPSEEK CHECK] Name includes deepseek? false
```

**Problem**: Node ID or name doesn't match.

**Solution**: Share the actual node ID and name from the logs so we can update the detection logic.

### Issue 2: Field Appears But Is Empty

**Check browser console logs:**

If you see:
```
[DEEPSEEK] Found bodyParametersJson
[DEEPSEEK] Parsed bodyJson: {...}
[DEEPSEEK] Final extracted prompt: (empty)
```

**Problem**: The "text" field is in a different location.

**Solution**: Look at the "[DEEPSEEK] Parsed bodyJson" log and find where the text field is actually located. Share the full structure.

### Issue 3: Saving Doesn't Update n8n

**Check backend logs:**

If you see:
```
[SETTINGS] WARNING: Could not find text field to update in node: Http Deep Seek request
```

**Problem**: The backend can't find the text field in the expected locations.

**Solution**: Look at the "[SETTINGS] Node parameters" and "[SETTINGS] Found bodyParametersJson" logs. Share the structure so we can adjust the update logic.

### Issue 4: Frontend Container Won't Build

**Check build logs:**

```bash
docker-compose build frontend
```

**Common issues:**
- **Syntax error in JSX**: Check the error message for line number
- **Module not found**: Run `docker-compose run frontend npm install`
- **Out of disk space**: Run `docker system prune` to free up space

### Issue 5: Backend Container Won't Start

**Check backend logs:**

```bash
docker-compose logs backend --tail=50
```

**Common issues:**
- **Syntax error in JavaScript**: Check the error message for line number
- **Database connection error**: Verify PostgreSQL is running
- **Port already in use**: Check if another service is using port 3001

## Quick Commands Reference

### Rebuild Both Containers
```bash
docker-compose build backend frontend
docker-compose up -d
```

### View Logs
```bash
# Backend logs
docker-compose logs -f backend --tail=50

# Frontend logs
docker-compose logs -f frontend --tail=50

# All logs
docker-compose logs -f --tail=50
```

### Restart Containers
```bash
# Restart specific container
docker-compose restart backend
docker-compose restart frontend

# Restart all containers
docker-compose restart
```

### Check Container Status
```bash
docker-compose ps
```

### Access Container Shell
```bash
# Backend shell
docker-compose exec backend sh

# Frontend shell (nginx)
docker-compose exec frontend sh
```

## Success Criteria

✅ Frontend builds successfully
✅ Backend restarts without errors
✅ Browser console shows `[DEEPSEEK]` logs
✅ Textarea field appears in settings modal
✅ Field shows current prompt value
✅ Saving updates the workflow in n8n
✅ Backend logs show successful update
✅ n8n workflow shows updated "text" field

## Next Steps

Once the field appears and saves successfully:

1. **Test with different prompts** to ensure updates work consistently
2. **Test with multiple users** (MSP_Admin, Client_Admin, Client_User)
3. **Verify permissions** - only MSP_Admin and Client_Admin should be able to edit
4. **Check workflow execution** - ensure the new prompt is used in DeepSeek API calls
5. **Document for users** - explain how to customize the DeepSeek search prompt

## Files Changed

- [AutomationsLibrary.jsx](y:\frontend\src\pages\AutomationsLibrary.jsx) - Lines 416-525
- [workflow-activation.js](y:\backend\routes\workflow-activation.js) - Lines 613-710
