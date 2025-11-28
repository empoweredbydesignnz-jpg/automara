const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'automara',
  user: process.env.DB_USER || 'automara',
  password: process.env.DB_PASSWORD
});

const N8N_API_URL = process.env.N8N_API_URL || 'http://n8n:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

/**
 * Create or update a Facebook credential in n8n
 * @param {string} credentialName - Name for the credential (e.g., "TenantName - Facebook")
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<string>} - Credential ID
 */
async function createOrUpdateFacebookCredential(credentialName, accessToken) {
  try {
    console.log('[N8N CREDENTIAL] Creating Facebook credential:', credentialName);

    // Create new credential (n8n will handle duplicates)
    const createResponse = await axios.post(
      `${N8N_API_URL}/credentials`,
      {
        name: credentialName,
        type: 'facebookGraphApi',
        data: {
          accessToken: accessToken
        }
      },
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('[N8N CREDENTIAL] Created credential:', createResponse.data.id);
    return createResponse.data.id;
  } catch (error) {
    console.error('[N8N CREDENTIAL] Error managing Facebook credential:', error.response?.data || error.message);
    throw new Error('Failed to manage Facebook credential: ' + (error.response?.data?.message || error.message));
  }
}

async function getOrCreateCompanyFolder(companyName) {
  try {
    console.log('[N8N] Fetching tags for company:', companyName);
    const tagsResponse = await axios.get(N8N_API_URL + '/tags', {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      timeout: 10000
    });
    const existingFolder = tagsResponse.data.data.find(tag => tag.name === companyName);
    if (existingFolder) {
      console.log('[N8N] Found existing folder ID:', existingFolder.id);
      return existingFolder.id;
    }
    console.log('[N8N] Creating new folder for:', companyName);
    const createResponse = await axios.post(N8N_API_URL + '/tags', { name: companyName }, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000
    });
    console.log('[N8N] Folder created ID:', createResponse.data.data.id);
    return createResponse.data.data.id;
  } catch (error) {
    console.error('[N8N] Error managing company folder:', error.message);
    throw new Error('Failed to create company folder: ' + error.message);
  }
}

async function cloneWorkflowToFolder(workflowId, newName, folderId) {
  try {
    console.log('[N8N] Fetching workflow', workflowId);
    const workflowResponse = await axios.get(N8N_API_URL + '/workflows/' + workflowId, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      timeout: 10000
    });
    console.log('[N8N] Response status:', workflowResponse.status);
    let originalWorkflow;
    if (workflowResponse.data.data) {
      originalWorkflow = workflowResponse.data.data;
    } else if (workflowResponse.data.nodes) {
      originalWorkflow = workflowResponse.data;
    } else {
      throw new Error('Cannot find workflow data in response');
    }
    if (!originalWorkflow.nodes || !Array.isArray(originalWorkflow.nodes)) {
      throw new Error('Workflow has no nodes array');
    }
    console.log('[N8N] Workflow has', originalWorkflow.nodes.length, 'nodes');
    const clonedWorkflow = {
      name: newName,
      nodes: originalWorkflow.nodes,
      connections: originalWorkflow.connections || {},
      settings: originalWorkflow.settings || {},
      staticData: null
    };
    console.log('[N8N] Creating cloned workflow:', newName);
    const createResponse = await axios.post(N8N_API_URL + '/workflows', clonedWorkflow, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
      timeout: 15000
    });
    const result = createResponse.data.data || createResponse.data;
    console.log('[N8N] Clone created ID:', result.id);
    console.log('[N8N] Adding workflow to folder');
    await axios.put(N8N_API_URL + '/workflows/' + result.id + '/tags', [{ id: folderId }], {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000
    });
    console.log('[N8N] Workflow tagged successfully');
    return result;
  } catch (error) {
    console.error('[N8N] Error:', error.message);
    if (error.response) {
      console.error('[N8N] Status:', error.response.status);
      console.error('[N8N] Data:', JSON.stringify(error.response.data).substring(0, 500));
    }
    throw new Error('Failed to clone workflow: ' + error.message);
  }
}

router.post('/workflows/:id/activate', async (req, res) => {
  console.log('=== WORKFLOW ACTIVATION STARTED ===');
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    const tenantId = req.headers['x-tenant-id'];
    console.log('[ACTIVATE] Workflow:', id, 'Tenant:', tenantId, 'User:', userId);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID required' });
    }
    console.log('[DB] Fetching tenant', tenantId);
    const tenantResult = await pool.query('SELECT id, name FROM client_tenants WHERE id = $1', [tenantId]);
    if (tenantResult.rows.length === 0) {
      console.log('[ERROR] Tenant', tenantId, 'not found');
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }
    const tenant = tenantResult.rows[0];
    const companyName = tenant.name;
    console.log('[DB] Found tenant:', companyName);
    console.log('[DB] Fetching workflow', id);
    const workflowResult = await pool.query('SELECT id, n8n_workflow_id, name FROM workflows WHERE id = $1', [id]);
    if (workflowResult.rows.length === 0) {
      console.log('[ERROR] Workflow', id, 'not found');
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    const workflow = workflowResult.rows[0];
    console.log('[DB] Found workflow:', workflow.name, 'n8n:', workflow.n8n_workflow_id);
    const clonedWorkflowName = companyName + ' - ' + workflow.name;

    // Check if workflow already exists for this tenant
    const existingCheck = await pool.query(
      'SELECT id, n8n_workflow_id, active FROM workflows WHERE tenant_id = $1 AND name = $2',
      [tenantId, clonedWorkflowName]
    );

    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      if (existing.active) {
        return res.status(409).json({
          success: false,
          error: 'Workflow already activated for your company',
          workflow: { id: existing.id, name: clonedWorkflowName }
        });
      } else {
        // Reactivate by creating a fresh clone (old one was deleted from n8n)
        console.log('[REACTIVATE] Creating fresh clone for deactivated workflow');
        const folderId = await getOrCreateCompanyFolder(companyName);
        const clonedWorkflow = await cloneWorkflowToFolder(workflow.n8n_workflow_id, clonedWorkflowName, folderId);

        // Update existing record with new n8n workflow id
        await pool.query(
          'UPDATE workflows SET active = true, n8n_workflow_id = $1, n8n_data = $2, updated_at = NOW() WHERE id = $3',
          [clonedWorkflow.id, JSON.stringify(clonedWorkflow), existing.id]
        );

        return res.json({
          success: true,
          message: 'Workflow reactivated successfully',
          workflow: { id: existing.id, name: clonedWorkflowName, n8n_workflow_id: clonedWorkflow.id, folder: companyName, active: true }
        });
      }
    }

    const folderId = await getOrCreateCompanyFolder(companyName);
    const clonedWorkflow = await cloneWorkflowToFolder(workflow.n8n_workflow_id, clonedWorkflowName, folderId);
    console.log('[DB] Creating workflow record');
    const insertResult = await pool.query('INSERT INTO workflows (tenant_id, n8n_workflow_id, name, n8n_data, active, parent_workflow_id, folder_name, cloned_at, is_template, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false, NOW(), NOW()) RETURNING *', [tenantId, clonedWorkflow.id, clonedWorkflowName, JSON.stringify(clonedWorkflow), false, workflow.id, companyName]);
    const newWorkflow = insertResult.rows[0];
    console.log('[DB] Workflow record created ID:', newWorkflow.id);
    console.log('[DB] Logging activation');
    await pool.query('INSERT INTO workflow_activations (workflow_id, tenant_id, activated_by, n8n_workflow_id, folder_name, cloned_workflow_name) VALUES ($1, $2, $3, $4, $5, $6)', [newWorkflow.id, tenantId, userId || null, clonedWorkflow.id, companyName, clonedWorkflowName]);
    const duration = Date.now() - startTime;
    console.log('=== ACTIVATION SUCCESS in', duration, 'ms ===');
    res.json({
      success: true,
      message: 'Workflow activated successfully',
      workflow: { id: newWorkflow.id, name: newWorkflow.name, n8n_workflow_id: clonedWorkflow.id, folder: companyName, active: false }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('=== ACTIVATION FAILED after', duration, 'ms ===');
    console.error('[ERROR]', error.message);
    console.error('[STACK]', error.stack);
    res.status(500).json({ success: false, error: 'Failed to activate workflow', message: error.message });
  }
});

router.post('/workflows/:id/start', async (req, res) => {
  console.log('=== WORKFLOW START ===');
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'];
    const userRole = req.headers['x-user-role'];

    const workflowResult = await pool.query('SELECT id, n8n_workflow_id, tenant_id FROM workflows WHERE id = $1', [id]);
    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    const workflow = workflowResult.rows[0];

    const effectiveRole = userRole === 'admin' ? 'global_admin' : userRole;
    if (effectiveRole !== 'global_admin' && workflow.tenant_id !== parseInt(tenantId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Activate workflow in n8n using the activate endpoint
    console.log('[N8N] Activating workflow', workflow.n8n_workflow_id);
    await axios.post(N8N_API_URL + '/workflows/' + workflow.n8n_workflow_id + '/activate', {}, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      timeout: 10000
    });
    console.log('[N8N] Workflow activated');

    // Update database
    await pool.query('UPDATE workflows SET active = true, updated_at = NOW() WHERE id = $1', [id]);

    console.log('=== WORKFLOW STARTED ===');
    res.json({ success: true, message: 'Workflow started successfully' });
  } catch (error) {
    console.error('=== WORKFLOW START FAILED ===');
    console.error('[ERROR]', error.message);
    if (error.response) {
      console.error('[N8N Response]', JSON.stringify(error.response.data).substring(0, 500));
    }
    res.status(500).json({ success: false, error: 'Failed to start workflow', message: error.message });
  }
});

router.post('/workflows/:id/stop', async (req, res) => {
  console.log('=== WORKFLOW STOP ===');
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'];
    const userRole = req.headers['x-user-role'];

    const workflowResult = await pool.query('SELECT id, n8n_workflow_id, tenant_id FROM workflows WHERE id = $1', [id]);
    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    const workflow = workflowResult.rows[0];

    const effectiveRole = userRole === 'admin' ? 'global_admin' : userRole;
    if (effectiveRole !== 'global_admin' && workflow.tenant_id !== parseInt(tenantId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Deactivate workflow in n8n using the deactivate endpoint
    console.log('[N8N] Deactivating workflow', workflow.n8n_workflow_id);
    await axios.post(N8N_API_URL + '/workflows/' + workflow.n8n_workflow_id + '/deactivate', {}, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      timeout: 10000
    });
    console.log('[N8N] Workflow deactivated');

    // Update database
    await pool.query('UPDATE workflows SET active = false, updated_at = NOW() WHERE id = $1', [id]);

    console.log('=== WORKFLOW STOPPED ===');
    res.json({ success: true, message: 'Workflow stopped successfully' });
  } catch (error) {
    console.error('=== WORKFLOW STOP FAILED ===');
    console.error('[ERROR]', error.message);
    res.status(500).json({ success: false, error: 'Failed to stop workflow', message: error.message });
  }
});

router.post('/workflows/:id/deactivate', async (req, res) => {
  console.log('=== WORKFLOW DEACTIVATION STARTED ===');
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'];
    const userRole = req.headers['x-user-role'];
    console.log('[DEACTIVATE] Workflow:', id, 'Tenant:', tenantId);
    const workflowResult = await pool.query('SELECT id, n8n_workflow_id, tenant_id, name FROM workflows WHERE id = $1', [id]);
    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    const workflow = workflowResult.rows[0];
    const effectiveRole = userRole === 'admin' ? 'global_admin' : userRole;
    if (effectiveRole !== 'global_admin' && workflow.tenant_id !== parseInt(tenantId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Delete workflow from n8n
    if (workflow.n8n_workflow_id) {
      console.log('[N8N] Deleting workflow', workflow.n8n_workflow_id);
      try {
        await axios.delete(N8N_API_URL + '/workflows/' + workflow.n8n_workflow_id, {
          headers: { 'X-N8N-API-KEY': N8N_API_KEY },
          timeout: 10000
        });
        console.log('[N8N] Workflow deleted from n8n');
      } catch (n8nError) {
        // Log but continue - workflow may already be deleted in n8n
        console.error('[N8N] Error deleting workflow:', n8nError.message);
      }
    }

    // Delete from database
    console.log('[DB] Deleting workflow from database');
    await pool.query('DELETE FROM workflows WHERE id = $1', [id]);

    console.log('=== DEACTIVATION SUCCESS ===');
    res.json({ success: true, message: 'Workflow deactivated successfully' });
  } catch (error) {
    console.error('=== DEACTIVATION FAILED ===');
    console.error('[ERROR]', error.message);
    res.status(500).json({ success: false, error: 'Failed to deactivate workflow', message: error.message });
  }
});

// GET /api/workflows/:id/executions - Get latest executions for a workflow
router.get('/workflows/:id/executions', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    const tenantId = req.headers['x-tenant-id'];
    const userRole = req.headers['x-user-role'];

    // Fetch workflow from database
    const workflowResult = await pool.query(
      'SELECT id, n8n_workflow_id, tenant_id FROM workflows WHERE id = $1',
      [id]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const workflow = workflowResult.rows[0];

    // Check authorization
    const effectiveRole = userRole === 'admin' ? 'global_admin' : userRole;
    if (effectiveRole !== 'global_admin' && workflow.tenant_id !== parseInt(tenantId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (!workflow.n8n_workflow_id) {
      return res.json({ success: true, executions: [] });
    }

    // Fetch executions from n8n with full execution data
    const executionsResponse = await axios.get(N8N_API_URL + '/executions', {
      params: {
        workflowId: workflow.n8n_workflow_id,
        limit: limit,
        includeData: true  // CRITICAL: Include execution data with error details
      },
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      timeout: 10000
    });

    const executions = executionsResponse.data.data || [];

    console.log('[N8N RESPONSE] Total executions returned:', executions.length);
    if (executions.length > 0) {
      console.log('[N8N RESPONSE] First execution:', JSON.stringify(executions[0], null, 2).substring(0, 3000));
    }

    // Transform executions to include only necessary data
    const transformedExecutions = executions.map(exec => {
      let errorDetails = null;

      console.log('[EXEC CHECK] Execution ID:', exec.id, 'Status:', exec.status, 'Has data:', !!exec.data);

      if (exec.status === 'error' && exec.data) {
        // Log raw execution data for debugging
        console.log('[ERROR EXTRACTION] Execution ID:', exec.id);
        console.log('[ERROR EXTRACTION] Status:', exec.status);
        console.log('[ERROR EXTRACTION] Full execution data:', JSON.stringify(exec.data, null, 2).substring(0, 5000));

        // Extract comprehensive error information from n8n execution data
        const resultData = exec.data.resultData;
        const lastNodeExecuted = resultData?.lastNodeExecuted;
        const runData = resultData?.runData || {};

        console.log('[ERROR EXTRACTION] Last node executed:', lastNodeExecuted);
        console.log('[ERROR EXTRACTION] Available nodes in runData:', Object.keys(runData));

        // Try to get error from multiple sources
        let errorMessage = null;
        let errorNode = null;
        let errorDescription = null;
        let errorType = null;
        let errorStack = null;
        let errorContext = null;

        // Source 1: Check ALL nodes in runData for errors (most reliable)
        console.log('[SOURCE 1] Checking all nodes in runData for errors...');
        for (const [nodeName, nodeRuns] of Object.entries(runData)) {
          if (Array.isArray(nodeRuns)) {
            for (let i = 0; i < nodeRuns.length; i++) {
              const run = nodeRuns[i];

              // Log the full run structure for this node
              console.log(`[SOURCE 1] Node "${nodeName}" run ${i} structure:`, JSON.stringify(run, null, 2).substring(0, 1000));

              // Check for error in run.error
              if (run && run.error) {
                console.log(`[SOURCE 1] Found error in node "${nodeName}" (run ${i}):`, run.error);

                // Extract error message - check multiple possible fields
                errorMessage = run.error.message || run.error.issues || run.error.description;
                errorNode = nodeName;
                errorDescription = run.error.description || run.error.issues;
                errorType = run.error.name || run.error.type;
                errorStack = run.error.stack;
                errorContext = run.error.context;

                // If error has an "issues" field, use that as the primary message
                if (run.error.issues) {
                  errorMessage = run.error.issues;
                }

                break;
              }

              // Check for error in run.data.error
              if (run && run.data && run.data.error) {
                console.log(`[SOURCE 1] Found error in node "${nodeName}" data.error (run ${i}):`, run.data.error);
                errorMessage = run.data.error.message || run.data.error.issues || run.data.error.description;
                errorNode = nodeName;
                errorDescription = run.data.error.description || run.data.error.issues;
                errorType = run.data.error.name || run.data.error.type;
                errorStack = run.data.error.stack;

                // If error has an "issues" field, use that as the primary message
                if (run.data.error.issues) {
                  errorMessage = run.data.error.issues;
                }

                break;
              }

              // Check for issues field directly in run
              if (run && run.issues) {
                console.log(`[SOURCE 1] Found issues in node "${nodeName}" (run ${i}):`, run.issues);
                errorMessage = run.issues;
                errorNode = nodeName;
                break;
              }
            }
            if (errorMessage) break;
          }
        }

        // Source 2: Last node executed data (if Source 1 didn't find anything)
        if (!errorMessage && lastNodeExecuted && runData[lastNodeExecuted]) {
          console.log('[SOURCE 2] Checking lastNodeExecuted:', lastNodeExecuted);
          const nodeRuns = runData[lastNodeExecuted];
          const lastRun = nodeRuns[nodeRuns.length - 1];

          if (lastRun?.error) {
            console.log('[SOURCE 2] Found error in lastNodeExecuted:', lastRun.error);
            errorMessage = lastRun.error.message;
            errorNode = lastNodeExecuted;
            errorDescription = lastRun.error.description;
            errorType = lastRun.error.name || lastRun.error.type;
            errorStack = lastRun.error.stack;
          }
        }

        // Source 3: Direct error object in resultData (fallback)
        if (!errorMessage && resultData?.error) {
          console.log('[SOURCE 3] Found error in resultData.error:', resultData.error);
          errorMessage = resultData.error.message;
          errorNode = resultData.error.node?.name || lastNodeExecuted;
          errorDescription = resultData.error.description;
          errorType = resultData.error.name || resultData.error.type;
          errorStack = resultData.error.stack;
        }

        // Final fallback
        if (!errorMessage) {
          errorMessage = 'Workflow execution failed';
          errorNode = lastNodeExecuted || 'Unknown node';
          console.log('[ERROR EXTRACTION] No specific error found, using fallback');
        }

        console.log('[ERROR FINAL] Extracted error details:', {
          message: errorMessage,
          node: errorNode,
          type: errorType,
          hasDescription: !!errorDescription,
          hasStack: !!errorStack,
          hasContext: !!errorContext
        });

        errorDetails = {
          message: errorMessage,
          node: errorNode,
          description: errorDescription,
          type: errorType,
          context: errorContext,
          stack: errorStack ? errorStack.split('\n').slice(0, 10).join('\n') : null,
          timestamp: exec.stoppedAt || exec.startedAt,
          lastNodeExecuted: lastNodeExecuted
        };
      }

      return {
        id: exec.id,
        workflowId: exec.workflowId,
        status: exec.status,
        mode: exec.mode,
        startedAt: exec.startedAt,
        stoppedAt: exec.stoppedAt,
        finished: exec.finished,
        retryOf: exec.retryOf,
        retrySuccessId: exec.retrySuccessId,
        error: errorDetails
      };
    });

    res.json({
      success: true,
      executions: transformedExecutions
    });
  } catch (error) {
    console.error('Error fetching workflow executions:', error);
    if (error.response) {
      console.error('[N8N Response]', JSON.stringify(error.response.data).substring(0, 500));
    }
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executions',
      message: error.message
    });
  }
});

// PUT /api/workflows/:id/settings - Update workflow settings in n8n
router.put('/workflows/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    const tenantId = req.headers['x-tenant-id'];

    console.log('[WORKFLOW SETTINGS UPDATE] Workflow ID:', id);
    console.log('[WORKFLOW SETTINGS UPDATE] Settings:', settings);

    // Fetch workflow from database
    const workflowResult = await pool.query(
      'SELECT id, n8n_workflow_id, tenant_id FROM workflows WHERE id = $1',
      [id]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const workflow = workflowResult.rows[0];

    // Check authorization
    const effectiveRole = userRole === 'admin' ? 'global_admin' : userRole;
    if (effectiveRole !== 'global_admin' && workflow.tenant_id !== parseInt(tenantId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (!workflow.n8n_workflow_id) {
      return res.status(400).json({ success: false, error: 'Workflow not linked to n8n' });
    }

    // Fetch the current workflow from n8n
    console.log('[N8N] Fetching workflow:', workflow.n8n_workflow_id);
    const workflowResponse = await axios.get(`${N8N_API_URL}/workflows/${workflow.n8n_workflow_id}`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      timeout: 10000
    });

    const n8nWorkflow = workflowResponse.data;
    console.log('[N8N] Workflow fetched, nodes count:', n8nWorkflow.nodes?.length);

    // Update node parameters based on settings
    let updated = false;
    const credentialsToCreate = []; // Track credentials that need to be created

    // Get tenant name for credential naming
    let tenantName = 'Unknown';
    try {
      const tenantResult = await pool.query(
        'SELECT company_name FROM tenants WHERE tenant_id = $1',
        [workflow.tenant_id]
      );
      tenantName = tenantResult.rows[0]?.company_name || 'Unknown';
      console.log('[SETTINGS] Tenant name:', tenantName);
    } catch (error) {
      console.error('[SETTINGS] Error fetching tenant name:', error.message);
      // Continue with 'Unknown' as tenant name
    }

    for (const settingKey of Object.keys(settings)) {
      const settingValue = settings[settingKey];

      // Parse the setting key to get node ID and field type
      // Format: {nodeId}_{fieldType}
      const parts = settingKey.split('_');
      const nodeId = parts[0];
      const fieldType = parts.slice(1).join('_');

      console.log('[SETTINGS] Processing:', settingKey, '→', settingValue);
      console.log('[SETTINGS] Node ID:', nodeId, 'Field type:', fieldType);

      // Find the node in the workflow
      const node = n8nWorkflow.nodes?.find(n => n.id === nodeId);

      if (node) {
        console.log('[SETTINGS] Found node:', node.name, 'Type:', node.type);

        // Update based on field type
        if (fieldType === 'api_key') {
          // Update API key in authorization header
          if (!node.parameters.authentication) {
            node.parameters.authentication = 'genericCredentialType';
          }
          if (!node.parameters.genericAuthType) {
            node.parameters.genericAuthType = 'httpHeaderAuth';
          }
          if (!node.parameters.httpHeaderAuth) {
            node.parameters.httpHeaderAuth = {};
          }
          node.parameters.httpHeaderAuth.name = 'Authorization';
          node.parameters.httpHeaderAuth.value = `Bearer ${settingValue}`;
          updated = true;
          console.log('[SETTINGS] Updated API key for node:', node.name);
        }
        else if (fieldType === 'api_endpoint') {
          // Update API endpoint URL
          node.parameters.url = settingValue;
          updated = true;
          console.log('[SETTINGS] Updated API endpoint for node:', node.name, '→', settingValue);
        }
        else if (fieldType === 'deepseek_prompt') {
          // Update DeepSeek search prompt in JSON body
          console.log('[SETTINGS] Updating DeepSeek prompt for node:', node.name);
          console.log('[SETTINGS] Node parameters:', JSON.stringify(node.parameters, null, 2));

          try {
            // Method 1: Check if there's a bodyParametersJson field
            if (node.parameters.bodyParametersJson) {
              let bodyJson = typeof node.parameters.bodyParametersJson === 'string'
                ? JSON.parse(node.parameters.bodyParametersJson)
                : node.parameters.bodyParametersJson;

              console.log('[SETTINGS] Found bodyParametersJson:', JSON.stringify(bodyJson, null, 2));

              // Check for direct "text" field (line 6 in n8n JSON editor)
              if (bodyJson.hasOwnProperty('text')) {
                console.log('[SETTINGS] Updating "text" field from:', bodyJson.text, 'to:', settingValue);
                bodyJson.text = settingValue;
                node.parameters.bodyParametersJson = JSON.stringify(bodyJson);
                updated = true;
                console.log('[SETTINGS] Updated DeepSeek "text" field in bodyParametersJson');
              }
              // Check for messages array with user content
              else if (bodyJson.messages && Array.isArray(bodyJson.messages)) {
                const userMessage = bodyJson.messages.find(m => m.role === 'user');
                if (userMessage) {
                  userMessage.content = settingValue;
                  node.parameters.bodyParametersJson = JSON.stringify(bodyJson);
                  updated = true;
                  console.log('[SETTINGS] Updated DeepSeek prompt in bodyParametersJson messages array');
                }
              }
            }

            // Method 2: Check options.body.values if it exists
            if (node.parameters.options?.body?.values) {
              const bodyValues = node.parameters.options.body.values;
              console.log('[SETTINGS] Checking options.body.values:', bodyValues.length, 'fields');

              if (Array.isArray(bodyValues)) {
                // Check for a field named "text"
                const textField = bodyValues.find(v => v.name === 'text');
                if (textField) {
                  console.log('[SETTINGS] Updating "text" field from:', textField.value, 'to:', settingValue);
                  textField.value = settingValue;
                  updated = true;
                  console.log('[SETTINGS] Updated DeepSeek "text" field in options.body.values');
                }
                // Also check for messages field
                else {
                  const messagesField = bodyValues.find(v => v.name === 'messages');
                  if (messagesField && messagesField.value) {
                    try {
                      const messages = JSON.parse(messagesField.value);
                      if (Array.isArray(messages)) {
                        const userMessage = messages.find(m => m.role === 'user');
                        if (userMessage) {
                          userMessage.content = settingValue;
                          messagesField.value = JSON.stringify(messages);
                          updated = true;
                          console.log('[SETTINGS] Updated DeepSeek prompt in options.body.values messages');
                        }
                      }
                    } catch (e) {
                      console.error('[SETTINGS] Error parsing messages:', e);
                    }
                  }
                }
              }
            }

            // Method 3: Check sendBody parameter
            if (!updated && node.parameters.sendBody) {
              console.log('[SETTINGS] Checking sendBody parameter');
              try {
                let bodyData = typeof node.parameters.sendBody === 'string'
                  ? JSON.parse(node.parameters.sendBody)
                  : node.parameters.sendBody;

                if (bodyData.hasOwnProperty('text')) {
                  console.log('[SETTINGS] Updating "text" in sendBody from:', bodyData.text, 'to:', settingValue);
                  bodyData.text = settingValue;
                  node.parameters.sendBody = JSON.stringify(bodyData);
                  updated = true;
                  console.log('[SETTINGS] Updated DeepSeek "text" field in sendBody');
                }
              } catch (e) {
                console.error('[SETTINGS] Error updating sendBody:', e);
              }
            }

            if (!updated) {
              console.log('[SETTINGS] WARNING: Could not find text field to update in node:', node.name);
            }
          } catch (e) {
            console.error('[SETTINGS] Error updating DeepSeek prompt:', e);
          }
        }
        else if (fieldType === 'webhook_url') {
          node.parameters.path = settingValue;
          updated = true;
          console.log('[SETTINGS] Updated webhook URL for node:', node.name);
        }
        else if (fieldType === 'email') {
          node.parameters.fromEmail = settingValue;
          updated = true;
          console.log('[SETTINGS] Updated email for node:', node.name);
        }
        else if (fieldType === 'smtp_host') {
          node.parameters.host = settingValue;
          updated = true;
          console.log('[SETTINGS] Updated SMTP host for node:', node.name);
        }
        else if (fieldType === 'smtp_password') {
          node.parameters.password = settingValue;
          updated = true;
          console.log('[SETTINGS] Updated SMTP password for node:', node.name);
        }
        else if (fieldType === 'facebook_token') {
          // Handle Facebook access token - create credential and apply to node
          console.log('[SETTINGS] Processing Facebook token for node:', node.name);

          if (!settingValue || settingValue.trim() === '') {
            console.log('[SETTINGS] Skipping empty Facebook token');
          } else {
            try {
              // Create credential name based on tenant and node
              const credentialName = `${tenantName} - ${node.name} - Facebook`;

              // Create or update the credential in n8n
              const credentialId = await createOrUpdateFacebookCredential(credentialName, settingValue);

              console.log('[SETTINGS] Created/updated Facebook credential:', credentialId);

              // Apply the credential to the node
              node.credentials = node.credentials || {};
              node.credentials.facebookGraphApi = {
                id: credentialId,
                name: credentialName
              };

              updated = true;
              console.log('[SETTINGS] Applied Facebook credential to node:', node.name);
            } catch (error) {
              console.error('[SETTINGS] Error handling Facebook token:', error.message);
              // Don't throw - continue processing other settings
            }
          }
        }
      } else {
        console.log('[SETTINGS] Node not found:', nodeId);
      }
    }

    if (!updated) {
      console.log('[SETTINGS] No nodes were updated');
      return res.json({ success: true, message: 'No changes to apply', updated: false });
    }

    // Update the workflow in n8n
    console.log('[N8N] Updating workflow in n8n...');

    // Clean the workflow object - only send required fields that n8n accepts
    const cleanWorkflow = {
      name: n8nWorkflow.name,
      nodes: n8nWorkflow.nodes,
      connections: n8nWorkflow.connections
    };

    // Only add optional fields if they exist and are not null/undefined
    // NOTE: Do NOT include 'active' or 'tags' as they are read-only in n8n API
    if (n8nWorkflow.settings) {
      cleanWorkflow.settings = n8nWorkflow.settings;
    }
    if (n8nWorkflow.staticData !== undefined) {
      cleanWorkflow.staticData = n8nWorkflow.staticData;
    }
    if (n8nWorkflow.pinData && Object.keys(n8nWorkflow.pinData).length > 0) {
      cleanWorkflow.pinData = n8nWorkflow.pinData;
    }

    console.log('[N8N] Sending cleaned workflow to n8n (fields:', Object.keys(cleanWorkflow).join(', ') + ')');

    await axios.put(`${N8N_API_URL}/workflows/${workflow.n8n_workflow_id}`, cleanWorkflow, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('[N8N] Workflow updated successfully');

    // Update the n8n_data in our database to keep it in sync
    await pool.query(
      'UPDATE workflows SET n8n_data = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(n8nWorkflow), id]
    );

    res.json({
      success: true,
      message: 'Workflow settings updated successfully',
      updated: true
    });

  } catch (error) {
    console.error('[WORKFLOW SETTINGS UPDATE] Error:', error.message);
    console.error('[WORKFLOW SETTINGS UPDATE] Stack:', error.stack);
    if (error.response) {
      console.error('[N8N Response Status]:', error.response.status);
      console.error('[N8N Response Data]:', JSON.stringify(error.response.data).substring(0, 1000));
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update workflow settings: ' + error.message,
      details: error.response?.data || error.message
    });
  }
});

module.exports = router;