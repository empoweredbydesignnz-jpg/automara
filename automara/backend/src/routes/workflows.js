// backend/src/routes/workflows.js
// Workflow management routes with template provisioning

const express = require('express');
const router = express.Router();
const { getN8NService } = require('../services/n8n');
const { verifyResourceOwnership } = require('../middleware/tenant');
const EncryptionService = require('../services/encryption');

/**
 * @swagger
 * /api/workflows/templates:
 *   get:
 *     summary: Get available workflow templates
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available workflow templates
 */
router.get('/templates', async (req, res) => {
    try {
        const n8n = getN8NService();
        const templates = await n8n.getTemplates();
        res.json({ templates });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/workflows:
 *   get:
 *     summary: Get all workflows for the tenant
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', async (req, res) => {
    try {
        const result = await global.db.query(
            `SELECT id, n8n_workflow_id, workflow_type, name, description, 
                    webhook_url, is_active, created_at, updated_at, 
                    last_executed, execution_count
             FROM ${req.schemaName}.workflows
             ORDER BY created_at DESC`
        );
        
        res.json({ workflows: result.rows });
    } catch (err) {
        console.error('Error fetching workflows:', err);
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
});

/**
 * @swagger
 * /api/workflows:
 *   post:
 *     summary: Create a new workflow from template
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', async (req, res) => {
    const { template_type, credentials } = req.body;
    
    if (!template_type) {
        return res.status(400).json({ error: 'template_type is required' });
    }
    
    if (!credentials) {
        return res.status(400).json({ error: 'credentials are required' });
    }
    
    try {
        // Encrypt credentials before storing
        const encryptedCredentials = {
            client_id: EncryptionService.encrypt(credentials.client_id),
            client_secret: EncryptionService.encrypt(credentials.client_secret),
            tenant_id: EncryptionService.encrypt(credentials.tenant_id),
        };
        
        // Store M365 config in tenant schema
        await global.db.query(
            `INSERT INTO ${req.schemaName}.m365_configs 
            (tenant_id, encrypted_client_id, encrypted_client_secret, encrypted_tenant_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE 
            SET encrypted_client_id = $2, 
                encrypted_client_secret = $3, 
                encrypted_tenant_id = $4,
                updated_at = CURRENT_TIMESTAMP`,
            [
                credentials.tenant_id,
                encryptedCredentials.client_id,
                encryptedCredentials.client_secret,
                encryptedCredentials.tenant_id,
            ]
        );
        
        // Create workflow in N8N
        const n8n = getN8NService();
        
        // For N8N, we need decrypted credentials
        const workflowResult = await n8n.createWorkflowFromTemplate(
            template_type,
            req.tenantId,
            credentials, // Pass original credentials to N8N
            req.schemaName
        );
        
        // Fetch the created workflow
        const result = await global.db.query(
            `SELECT * FROM ${req.schemaName}.workflows 
             WHERE n8n_workflow_id = $1`,
            [workflowResult.workflowId]
        );
        
        res.status(201).json({
            message: 'Workflow created successfully',
            workflow: result.rows[0],
            webhook_url: workflowResult.webhookUrl,
        });
    } catch (err) {
        console.error('Error creating workflow:', err);
        res.status(500).json({ 
            error: 'Failed to create workflow',
            details: err.message,
        });
    }
});

/**
 * @swagger
 * /api/workflows/{id}:
 *   get:
 *     summary: Get a specific workflow
 */
router.get('/:id', verifyResourceOwnership('workflows'), async (req, res) => {
    try {
        const result = await global.db.query(
            `SELECT * FROM ${req.schemaName}.workflows WHERE id = $1`,
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        res.json({ workflow: result.rows[0] });
    } catch (err) {
        console.error('Error fetching workflow:', err);
        res.status(500).json({ error: 'Failed to fetch workflow' });
    }
});

/**
 * @swagger
 * /api/workflows/{id}/activate:
 *   post:
 *     summary: Activate a workflow
 */
router.post('/:id/activate', verifyResourceOwnership('workflows'), async (req, res) => {
    try {
        // Get workflow
        const workflowResult = await global.db.query(
            `SELECT n8n_workflow_id FROM ${req.schemaName}.workflows WHERE id = $1`,
            [req.params.id]
        );
        
        if (workflowResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        const n8nWorkflowId = workflowResult.rows[0].n8n_workflow_id;
        
        // Activate in N8N
        const n8n = getN8NService();
        await n8n.activateWorkflow(n8nWorkflowId);
        
        // Update status in database
        await global.db.query(
            `UPDATE ${req.schemaName}.workflows 
             SET is_active = true, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [req.params.id]
        );
        
        res.json({ message: 'Workflow activated successfully' });
    } catch (err) {
        console.error('Error activating workflow:', err);
        res.status(500).json({ error: 'Failed to activate workflow' });
    }
});

/**
 * @swagger
 * /api/workflows/{id}/deactivate:
 *   post:
 *     summary: Deactivate a workflow
 */
router.post('/:id/deactivate', verifyResourceOwnership('workflows'), async (req, res) => {
    try {
        const workflowResult = await global.db.query(
            `SELECT n8n_workflow_id FROM ${req.schemaName}.workflows WHERE id = $1`,
            [req.params.id]
        );
        
        if (workflowResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        const n8nWorkflowId = workflowResult.rows[0].n8n_workflow_id;
        
        const n8n = getN8NService();
        await n8n.deactivateWorkflow(n8nWorkflowId);
        
        await global.db.query(
            `UPDATE ${req.schemaName}.workflows 
             SET is_active = false, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [req.params.id]
        );
        
        res.json({ message: 'Workflow deactivated successfully' });
    } catch (err) {
        console.error('Error deactivating workflow:', err);
        res.status(500).json({ error: 'Failed to deactivate workflow' });
    }
});

/**
 * @swagger
 * /api/workflows/{id}/execute:
 *   post:
 *     summary: Manually execute a workflow
 */
router.post('/:id/execute', verifyResourceOwnership('workflows'), async (req, res) => {
    try {
        const { data } = req.body;
        
        const workflowResult = await global.db.query(
            `SELECT n8n_workflow_id, webhook_url FROM ${req.schemaName}.workflows WHERE id = $1`,
            [req.params.id]
        );
        
        if (workflowResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        const workflow = workflowResult.rows[0];
        
        // Execute via N8N
        const n8n = getN8NService();
        const execution = await n8n.executeWorkflow(workflow.n8n_workflow_id, data);
        
        // Log execution
        await global.db.query(
            `INSERT INTO ${req.schemaName}.workflow_executions 
            (workflow_id, n8n_execution_id, status, input_data)
            VALUES ($1, $2, $3, $4)`,
            [req.params.id, execution.id, 'running', JSON.stringify(data)]
        );
        
        // Update workflow execution count
        await global.db.query(
            `UPDATE ${req.schemaName}.workflows 
             SET execution_count = execution_count + 1, 
                 last_executed = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [req.params.id]
        );
        
        res.json({ 
            message: 'Workflow execution started',
            execution_id: execution.id,
        });
    } catch (err) {
        console.error('Error executing workflow:', err);
        res.status(500).json({ error: 'Failed to execute workflow' });
    }
});

/**
 * @swagger
 * /api/workflows/{id}/executions:
 *   get:
 *     summary: Get execution history for a workflow
 */
router.get('/:id/executions', verifyResourceOwnership('workflows'), async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        
        const result = await global.db.query(
            `SELECT * FROM ${req.schemaName}.workflow_executions 
             WHERE workflow_id = $1 
             ORDER BY started_at DESC 
             LIMIT $2 OFFSET $3`,
            [req.params.id, limit, offset]
        );
        
        res.json({ executions: result.rows });
    } catch (err) {
        console.error('Error fetching executions:', err);
        res.status(500).json({ error: 'Failed to fetch executions' });
    }
});

/**
 * @swagger
 * /api/workflows/{id}:
 *   delete:
 *     summary: Delete a workflow
 */
router.delete('/:id', verifyResourceOwnership('workflows'), async (req, res) => {
    try {
        const workflowResult = await global.db.query(
            `SELECT n8n_workflow_id FROM ${req.schemaName}.workflows WHERE id = $1`,
            [req.params.id]
        );
        
        if (workflowResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        const n8nWorkflowId = workflowResult.rows[0].n8n_workflow_id;
        
        // Delete from N8N
        const n8n = getN8NService();
        await n8n.deleteWorkflow(n8nWorkflowId);
        
        // Delete from database
        await global.db.query(
            `DELETE FROM ${req.schemaName}.workflows WHERE id = $1`,
            [req.params.id]
        );
        
        res.json({ message: 'Workflow deleted successfully' });
    } catch (err) {
        console.error('Error deleting workflow:', err);
        res.status(500).json({ error: 'Failed to delete workflow' });
    }
});

module.exports = router;
