const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db'); // Adjust path to your database connection

// N8N Configuration
const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

// Helper: Get or create company folder in n8n
async function getOrCreateCompanyFolder(companyName) {
  try {
    // Get all tags/folders from n8n
    const tagsResponse = await axios.get(`${N8N_API_URL}/tags`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });

    // Check if folder exists
    const existingFolder = tagsResponse.data.data.find(
      tag => tag.name === companyName
    );

    if (existingFolder) {
      return existingFolder.id;
    }

    // Create new folder/tag
    const createResponse = await axios.post(
      `${N8N_API_URL}/tags`,
      { name: companyName },
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    return createResponse.data.data.id;
  } catch (error) {
    console.error('Error managing company folder:', error);
    throw new Error('Failed to create company folder in n8n');
  }
}

// Helper: Clone workflow in n8n
async function cloneWorkflowToFolder(workflowId, newName, folderId) {
  try {
    // Get original workflow
    const workflowResponse = await axios.get(
      `${N8N_API_URL}/workflows/${workflowId}`,
      { headers: { 'X-N8N-API-KEY': N8N_API_KEY } }
    );

    const originalWorkflow = workflowResponse.data.data;

    // Create cloned workflow
    const clonedWorkflow = {
      name: newName,
      nodes: originalWorkflow.nodes,
      connections: originalWorkflow.connections,
      settings: originalWorkflow.settings || {},
      staticData: null,
      tags: [{ id: folderId }],
      active: false
    };

    // Create new workflow
    const createResponse = await axios.post(
      `${N8N_API_URL}/workflows`,
      clonedWorkflow,
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    return createResponse.data.data;
  } catch (error) {
    console.error('Error cloning workflow:', error);
    throw new Error('Failed to clone workflow in n8n');
  }
}

// POST /api/workflows/:id/activate
router.post('/workflows/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    const tenantId = req.headers['x-tenant-id'];

    // Get tenant information
    const tenantResult = await pool.query(
      'SELECT id, name FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = tenantResult.rows[0];
    const companyName = tenant.name;

    // Get workflow to activate
    const workflowResult = await pool.query(
      'SELECT id, n8n_workflow_id, name FROM workflows WHERE id = $1',
      [id]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = workflowResult.rows[0];

    // Step 1: Get or create company folder
    console.log(`Creating folder for: ${companyName}`);
    const folderId = await getOrCreateCompanyFolder(companyName);

    // Step 2: Clone workflow
    const clonedWorkflowName = `${companyName} - ${workflow.name}`;
    console.log(`Cloning workflow: ${clonedWorkflowName}`);
    const clonedWorkflow = await cloneWorkflowToFolder(
      workflow.n8n_workflow_id,
      clonedWorkflowName,
      folderId
    );

    // Step 3: Create workflow record
    const insertResult = await pool.query(`
      INSERT INTO workflows (
        tenant_id, n8n_workflow_id, name, workflow_data, 
        n8n_data, active, created_by, parent_workflow_id,
        folder_name, cloned_at, is_template
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), false)
      RETURNING *
    `, [
      tenantId,
      clonedWorkflow.id,
      clonedWorkflowName,
      JSON.stringify(clonedWorkflow),
      JSON.stringify(clonedWorkflow),
      true,
      userId,
      workflow.id,
      companyName
    ]);

    const newWorkflow = insertResult.rows[0];

    // Step 4: Activate in n8n
    await axios.patch(
      `${N8N_API_URL}/workflows/${clonedWorkflow.id}`,
      { active: true },
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    // Step 5: Log activation
    await pool.query(`
      INSERT INTO workflow_activations (
        workflow_id, tenant_id, activated_by, 
        n8n_workflow_id, folder_name, cloned_workflow_name
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      newWorkflow.id,
      tenantId,
      userId,
      clonedWorkflow.id,
      companyName,
      clonedWorkflowName
    ]);

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
    console.error('Error activating workflow:', error);
    res.status(500).json({
      error: 'Failed to activate workflow',
      message: error.message
    });
  }
});

// POST /api/workflows/:id/deactivate
router.post('/workflows/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'];

    // Get workflow
    const workflowResult = await pool.query(
      'SELECT id, n8n_workflow_id, tenant_id FROM workflows WHERE id = $1',
      [id]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = workflowResult.rows[0];

    // Check authorization
    if (workflow.tenant_id !== parseInt(tenantId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Deactivate in n8n
    await axios.patch(
      `${N8N_API_URL}/workflows/${workflow.n8n_workflow_id}`,
      { active: false },
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    // Update database
    await pool.query(
      'UPDATE workflows SET active = false WHERE id = $1',
      [id]
    );

    // Log deactivation
    await pool.query(
      'UPDATE workflow_activations SET deactivated_at = NOW(), status = $1 WHERE workflow_id = $2 AND status = $3',
      ['inactive', id, 'active']
    );

    res.json({
      success: true,
      message: 'Workflow deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating workflow:', error);
    res.status(500).json({
      error: 'Failed to deactivate workflow',
      message: error.message
    });
  }
});

module.exports = router;