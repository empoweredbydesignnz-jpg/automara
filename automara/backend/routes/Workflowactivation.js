const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const axios = require('axios');

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;

router.post('/api/workflows/:id/activate', async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  let tenantId = req.headers['x-tenant-id'];

  // Global admins must specify target tenant in request body
  if (userRole === 'global_admin' && !tenantId) {
    tenantId = req.body.tenantId;
    if (!tenantId) {
      return res.status(400).json({ 
        error: 'Global admins must specify target tenant ID in request body',
        requiresTenantSelection: true
      });
    }
  }

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  try {
    const workflowQuery = await pool.query(
      `SELECT w.*, t.name as tenant_name, t.company_name 
       FROM workflows w
       LEFT JOIN tenants t ON w.tenant_id = t.id
       WHERE w.id = $1`,
      [id]
    );

    if (workflowQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const templateWorkflow = workflowQuery.rows[0];

    const tenantQuery = await pool.query(
      `SELECT id, name, company_name, parent_tenant_id 
       FROM tenants 
       WHERE id = $1`,
      [tenantId]
    );

    if (tenantQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const userTenant = tenantQuery.rows[0];
    const companyName = userTenant.company_name || userTenant.name || 'Company';

    let workflowData;
    try {
      workflowData = typeof templateWorkflow.n8n_data === 'string' 
        ? JSON.parse(templateWorkflow.n8n_data) 
        : templateWorkflow.n8n_data;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid workflow data format' });
    }

    const originalName = workflowData.name || templateWorkflow.name;
    const newWorkflowName = `${companyName} - ${originalName}`;

    const existingWorkflowCheck = await pool.query(
      `SELECT id, n8n_workflow_id, active 
       FROM workflows 
       WHERE tenant_id = $1 
       AND name = $2 
       AND is_template = false`,
      [tenantId, newWorkflowName]
    );

    if (existingWorkflowCheck.rows.length > 0) {
      const existingWorkflow = existingWorkflowCheck.rows[0];
      
      return res.status(409).json({ 
        error: 'Workflow already activated for your company',
        workflow: {
          id: existingWorkflow.id,
          n8nWorkflowId: existingWorkflow.n8n_workflow_id,
          name: newWorkflowName,
          active: existingWorkflow.active
        }
      });
    }

    const n8nCreatePayload = {
      name: newWorkflowName,
      nodes: workflowData.nodes || [],
      connections: workflowData.connections || {},
      settings: workflowData.settings || {},
      staticData: workflowData.staticData || null,
      tags: [
        ...(workflowData.tags || []),
        { name: companyName },
        { name: `tenant_${tenantId}` }
      ],
      active: false
    };

    try {
      const n8nResponse = await axios.post(
        `${N8N_BASE_URL}/api/v1/workflows`,
        n8nCreatePayload,
        {
          headers: {
            'X-N8N-API-KEY': N8N_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      n8nWorkflowId = n8nResponse.data.id;
      duplicatedWorkflow = n8nResponse.data;

    } catch (n8nError) {
      console.error('Error creating workflow in n8n:', n8nError.response?.data || n8nError.message);
      return res.status(500).json({ 
        error: 'Failed to create workflow in n8n',
        details: n8nError.response?.data || n8nError.message
      });
    }

    const folderName = `${companyName} Workflows`;

    const insertQuery = await pool.query(
      `INSERT INTO workflows (
        name, 
        n8n_workflow_id, 
        tenant_id, 
        created_by, 
        is_template, 
        template_id, 
        n8n_data,
        active,
        folder_name,
        cloned_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        newWorkflowName,
        n8nWorkflowId,
        tenantId,
        userId,
        false,
        templateWorkflow.id,
        JSON.stringify(duplicatedWorkflow),
        false,
        folderName
      ]
    );

    const createdWorkflow = insertQuery.rows[0];

    await pool.query(
      `INSERT INTO workflow_activity_log (
        workflow_id, 
        user_id, 
        action, 
        details
      ) VALUES ($1, $2, $3, $4)`,
      [
        createdWorkflow.id,
        userId,
        'activated',
        JSON.stringify({
          templateId: templateWorkflow.id,
          templateName: templateWorkflow.name,
          companyName: companyName,
          n8nWorkflowId: n8nWorkflowId
        })
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Workflow activated successfully',
      workflow: {
        id: createdWorkflow.id,
        name: newWorkflowName,
        n8nWorkflowId: n8nWorkflowId,
        tenantId: tenantId,
        companyName: companyName,
        folder: folderName,
        active: createdWorkflow.active,
        templateId: templateWorkflow.id,
        createdAt: createdWorkflow.created_at
      }
    });

  } catch (error) {
    console.error('Error activating workflow:', error);
    return res.status(500).json({ 
      error: 'Failed to activate workflow',
      message: error.message 
    });
  }
});

router.delete('/api/workflows/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const tenantId = req.headers['x-tenant-id'];

  try {
    const workflowQuery = await pool.query(
      `SELECT w.*, w.n8n_workflow_id 
       FROM workflows w
       WHERE w.id = $1`,
      [id]
    );

    if (workflowQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = workflowQuery.rows[0];

    if (workflow.tenant_id !== parseInt(tenantId) && userRole !== 'global_admin') {
      return res.status(403).json({ error: 'Not authorized to delete this workflow' });
    }

    if (workflow.is_template) {
      return res.status(400).json({ error: 'Cannot delete template workflows' });
    }

    // Delete from n8n first
    if (workflow.n8n_workflow_id) {
      try {
        await axios.delete(
          `${N8N_BASE_URL}/api/v1/workflows/${workflow.n8n_workflow_id}`,
          {
            headers: {
              'X-N8N-API-KEY': N8N_API_KEY
            }
          }
        );
      } catch (n8nError) {
        console.error('Error deleting workflow from n8n:', n8nError.response?.data || n8nError.message);
        // If n8n deletion fails, don't delete from database
        return res.status(500).json({ 
          error: 'Failed to delete workflow from n8n',
          details: n8nError.response?.data?.message || n8nError.message
        });
      }
    }

    // Log before deleting
    await pool.query(
      `INSERT INTO workflow_activity_log (
        workflow_id, 
        user_id, 
        action, 
        details
      ) VALUES ($1, $2, $3, $4)`,
      [
        id,
        userId,
        'deactivated',
        JSON.stringify({
          workflowName: workflow.name,
          n8nWorkflowId: workflow.n8n_workflow_id
        })
      ]
    );

    // Delete from database
    await pool.query(
      `DELETE FROM workflows WHERE id = $1`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating workflow:', error);
    return res.status(500).json({ 
      error: 'Failed to deactivate workflow',
      message: error.message 
    });
  }
});

module.exports = router;