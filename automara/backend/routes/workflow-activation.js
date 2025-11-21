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

module.exports = router;