const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Pool } = require('pg');

// Database connection - same config as index.js
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'automara',
  user: process.env.DB_USER || 'automara',
  password: process.env.DB_PASSWORD
});

// N8N Configuration
const N8N_API_URL = process.env.N8N_API_URL || 'http://n8n:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

// Helper: Get or create company folder in n8n
async function getOrCreateCompanyFolder(companyName) {
  try {
    console.log(`[N8N] Fetching tags for company: ${companyName}`);
    const tagsResponse = await axios.get(`${N8N_API_URL}/tags`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      timeout: 10000
    });

    const existingFolder = tagsResponse.data.data.find(
      tag => tag.name === companyName
    );

    if (existingFolder) {
      console.log(`[N8N] Found existing folder (ID: ${existingFolder.id})`);
      return existingFolder.id;
    }

    console.log(`[N8N] Creating new folder for: ${companyName}`);
    const createResponse = await axios.post(
      `${N8N_API_URL}/tags`,
      { name: companyName },
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log(`[N8N] Folder created (ID: ${createResponse.data.data.id})`);
    return createResponse.data.data.id;
  } catch (error) {
    console.error('[N8N] Error managing company folder:', error.message);
    throw new Error(`Failed to create company folder: ${error.message}`);
  }
}

// Helper: Clone workflow in n8n
async function cloneWorkflowToFolder(workflowId, newName, folderId) {
  try {
    console.log(`[N8N] Fetching workflow ${workflowId}`);
    const workflowResponse = await axios.get(
      `${N8N_API_URL}/workflows/${workflowId}`,
      { 
        headers: { 'X-N8N-API-KEY': N8N_API_KEY },
        timeout: 10000
      }
    );

    const originalWorkflow = workflowResponse.data.data;

    const clonedWorkflow = {
      name: newName,
      nodes: originalWorkflow.nodes,
      connections: originalWorkflow.connections,
      settings: originalWorkflow.settings || {},
      staticData: null,
      tags: [{ id: folderId }],
      active: false
    };

    console.log(`[N8N] Creating cloned workflow: ${newName}`);
    const createResponse = await axios.post(
      `${N8N_API_URL}/workflows`,
      clonedWorkflow,
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log(`[N8N] Clone created (ID: ${createResponse.data.data.id})`);
    return createResponse.data.data;
  } catch (error) {
    console.error('[N8N] Error cloning workflow:', error.message);
    throw new Error(`Failed to clone workflow: ${error.message}`);
  }
}

// POST /api/workflows/:id/activate
router.post('/workflows/:id/activate', async (req, res) => {
  console.log('=== WORKFLOW ACTIVATION STARTED ===');
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    const tenantId = req.headers['x-tenant-id'];

    console.log(`[ACTIVATE] Workflow: ${id}, Tenant: ${tenantId}, User: ${userId}`);

    if (!tenantId) {
      return res.status(400).json({ 
        success: false,
        error: 'Tenant ID required' 
      });
    }

    // Get tenant - Using client_tenants table
    console.log(`[DB] Fetching tenant ${tenantId}...`);
    const tenantResult = await pool.query(
      'SELECT id, name FROM client_tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      console.log(`[ERROR] Tenant ${tenantId} not found`);
      return res.status(404).json({ 
        success: false,
        error: 'Tenant not found' 
      });
    }

    const tenant = tenantResult.rows[0];
    const companyName = tenant.name;
    console.log(`[DB] Found tenant: ${companyName}`);

    // Get workflow to activate
    console.log(`[DB] Fetching workflow ${id}...`);
    const workflowResult = await pool.query(
      'SELECT id, n8n_workflow_id, name FROM workflows WHERE id = $1',
      [id]
    );

    if (workflowResult.rows.length === 0) {
      console.log(`[ERROR] Workflow ${id} not found`);
      return res.status(404).json({ 
        success: false,
        error: 'Workflow not found' 
      });
    }

    const workflow = workflowResult.rows[0];
    console.log(`[DB] Found workflow: ${workflow.name} (n8n: ${workflow.n8n_workflow_id})`);

    // Get or create company folder
    const folderId = await getOrCreateCompanyFolder(companyName);

    // Clone workflow
    const clonedWorkflowName = `${companyName} - ${workflow.name}`;
    const clonedWorkflow = await cloneWorkflowToFolder(
      workflow.n8n_workflow_id,
      clonedWorkflowName,
      folderId
    );

    // Create workflow record
    console.log(`[DB] Creating workflow record...`);
    const insertResult = await pool.query(`
      INSERT INTO workflows (
        tenant_id, 
        n8n_workflow_id, 
        name, 
        n8n_data, 
        active, 
        parent_workflow_id,
        folder_name, 
        cloned_at, 
        is_template,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false, NOW(), NOW())
      RETURNING *
    `, [
      tenantId,
      clonedWorkflow.id,
      clonedWorkflowName,
      JSON.stringify(clonedWorkflow),
      true,
      workflow.id,
      companyName
    ]);

    const newWorkflow = insertResult.rows[0];
    console.log(`[DB] Workflow record created (ID: ${newWorkflow.id})`);

    // Activate in n8n
    console.log(`[N8N] Activating workflow...`);
    await axios.patch(
      `${N8N_API_URL}/workflows/${clonedWorkflow.id}`,
      { active: true },
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    console.log(`[N8N] Workflow activated`);

    // Log activation
    console.log(`[DB] Logging activation...`);
    await pool.query(`
      INSERT INTO workflow_activations (
        workflow_id, tenant_id, activated_by, 
        n8n_workflow_id, folder_name, cloned_workflow_name
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      newWorkflow.id,
      tenantId,
      userId || null,
      clonedWorkflow.id,
      companyName,
      clonedWorkflowName
    ]);

    const duration = Date.now() - startTime;
    console.log(`=== ACTIVATION SUCCESS in ${duration}ms ===`);

    res.json({
      success: true,
      message: 'Workflow activated successfully',
      workflow: {
        id: newWorkflow.id,
        name: newWorkflow.name,
        n8n_workflow_id: clonedWorkflow.id,
        folder: companyName,
        active: true
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`=== ACTIVATION FAILED after ${duration}ms ===`);
    console.error('[ERROR]', error.message);
    console.error('[STACK]', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Failed to activate workflow',
      message: error.message
    });
  }
});

// POST /api/workflows/:id/deactivate
router.post('/workflows/:id/deactivate', async (req, res) => {
  console.log('=== WORKFLOW DEACTIVATION STARTED ===');
  
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'];
    const userRole = req.headers['x-user-role'];

    console.log(`[DEACTIVATE] Workflow: ${id}, Tenant: ${tenantId}`);

    const workflowResult = await pool.query(
      'SELECT id, n8n_workflow_id, tenant_id FROM workflows WHERE id = $1',
      [id]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Workflow not found' 
      });
    }

    const workflow = workflowResult.rows[0];

    // Check authorization
    const effectiveRole = userRole === 'admin' ? 'global_admin' : userRole;
    if (effectiveRole !== 'global_admin' && workflow.tenant_id !== parseInt(tenantId)) {
      return res.status(403).json({ 
        success: false,
        error: 'Unauthorized' 
      });
    }

    // Deactivate in n8n
    console.log(`[N8N] Deactivating workflow ${workflow.n8n_workflow_id}...`);
    await axios.patch(
      `${N8N_API_URL}/workflows/${workflow.n8n_workflow_id}`,
      { active: false },
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    // Update database
    console.log(`[DB] Updating workflow status...`);
    await pool.query(
      'UPDATE workflows SET active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Log deactivation
    await pool.query(
      `UPDATE workflow_activations 
       SET deactivated_at = NOW(), status = $1 
       WHERE workflow_id = $2 AND status = $3`,
      ['inactive', id, 'active']
    );

    console.log(`=== DEACTIVATION SUCCESS ===`);

    res.json({
      success: true,
      message: 'Workflow deactivated successfully'
    });

  } catch (error) {
    console.error('=== DEACTIVATION FAILED ===');
    console.error('[ERROR]', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate workflow',
      message: error.message
    });
  }
});

module.exports = router;