// backend/src/routes/workflows.js
const express = require('express');
const router = express.Router();
const { getN8NService } = require('../services/n8n');
const { verifyResourceOwnership } = require('../middleware/tenant');

router.post('/sync', async (req, res) => {
    try {
        const n8n = getN8NService();
        const n8nWorkflows = await n8n.getAllWorkflows();
        const syncedWorkflows = [];
        
        for (const n8nWorkflow of n8nWorkflows) {
            const workflowName = n8nWorkflow.name || '';
            const tags = n8nWorkflow.tags || [];
            
            if (workflowName.includes(' - ')) {
                continue;
            }
            
            const hasLibraryTag = tags.some(tag => tag.name === 'library');
            if (!hasLibraryTag) {
                continue;
            }
            
            const existing = await global.db.query(
                `SELECT id FROM public.workflows WHERE n8n_workflow_id = $1`,
                [n8nWorkflow.id]
            );

            if (existing.rows.length === 0) {
                const result = await global.db.query(
                    `INSERT INTO public.workflows
                    (n8n_workflow_id, name, n8n_data, is_template, tenant_id, active, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING *`,
                    [n8nWorkflow.id, n8nWorkflow.name, JSON.stringify(n8nWorkflow), true, null, false]
                );
                syncedWorkflows.push(result.rows[0]);
            } else {
                // Update existing workflow to ensure it's marked as template
                const result = await global.db.query(
                    `UPDATE public.workflows
                    SET is_template = true, tenant_id = NULL, n8n_data = $1, name = $2, updated_at = CURRENT_TIMESTAMP
                    WHERE n8n_workflow_id = $3
                    RETURNING *`,
                    [JSON.stringify(n8nWorkflow), n8nWorkflow.name, n8nWorkflow.id]
                );
                syncedWorkflows.push(result.rows[0]);
            }
        }
        
        res.json({ success: true, message: `Synced ${syncedWorkflows.length} templates`, workflows: syncedWorkflows });
    } catch (err) {
        console.error('Error syncing workflows:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/templates', async (req, res) => {
    try {
        const result = await global.db.query(
            `SELECT id, n8n_workflow_id, name, n8n_data, active, created_at, updated_at,
                    manual_time_minutes, n8n_time_seconds
             FROM public.workflows
             WHERE is_template = true AND tenant_id IS NULL
             ORDER BY created_at DESC`
        );
        res.json({ templates: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];

        // If no tenantId (e.g., global_admin), return empty array
        if (!tenantId) {
            return res.json({ workflows: [] });
        }

        const result = await global.db.query(
            `SELECT id, n8n_workflow_id, name, n8n_data, active, is_template, tenant_id,
                    created_at, updated_at, cloned_at, folder_name, template_id,
                    manual_time_minutes, n8n_time_seconds
             FROM public.workflows
             WHERE tenant_id = $1 AND is_template = false
             ORDER BY created_at DESC`,
            [tenantId]
        );

        res.json({ workflows: result.rows });
    } catch (err) {
        console.error('Error fetching workflows:', err);
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
});

router.get('/n8n', async (req, res) => {
    try {
        const n8n = getN8NService();
        const workflows = await n8n.getAllWorkflows();
        res.json({ workflows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    const { template_id } = req.body;
    const tenantId = req.tenantId;
    const schemaName = req.schemaName;
    const userId = req.headers['x-user-id'];

    if (!template_id) {
        return res.status(400).json({ error: 'template_id is required' });
    }

    try {
        const n8n = getN8NService();

        // 1. Fetch template details from public.workflows
        const templateResult = await global.db.query(
            `SELECT id, n8n_workflow_id, name, n8n_data FROM public.workflows WHERE id = $1 AND is_template = true`,
            [template_id]
        );

        if (templateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const template = templateResult.rows[0];

        // 2. Get tenant details to create folder name
        const tenantResult = await global.db.query(
            'SELECT name FROM public.tenants WHERE id = $1',
            [tenantId]
        );

        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        const companyName = tenantResult.rows[0].name;

        // 3. Get or create company folder in n8n
        const folderId = await n8n.getOrCreateCompanyFolder(companyName);

        // 4. Clone workflow in n8n
        const clonedWorkflowName = `${companyName} - ${template.name}`;
        const clonedWorkflow = await n8n.cloneWorkflowToFolder(
            template.n8n_workflow_id,
            clonedWorkflowName,
            folderId
        );

        // 5. Insert new workflow record into the tenant's schema
        const insertResult = await global.db.query(`
            INSERT INTO ${schemaName}.workflows (
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
            true, // Active by default after cloning
            template.id,
            companyName
        ]);

        const newWorkflow = insertResult.rows[0];

        // 6. Activate the newly cloned workflow in n8n
        await n8n.activateWorkflow(clonedWorkflow.id);

        // 7. Log activation
        await global.db.query(`
            INSERT INTO ${schemaName}.workflow_activations (
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
        
        res.status(201).json({
            message: 'Workflow created and activated successfully',
            workflow: {
                id: newWorkflow.id,
                name: newWorkflow.name,
                n8n_workflow_id: clonedWorkflow.id,
                folder: companyName,
                active: true
            }
        });
    } catch (err) {
        console.error('Error creating workflow from template:', err.message);
        res.status(500).json({ error: 'Failed to create workflow', details: err.message });
    }
});

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
        res.status(500).json({ error: 'Failed to fetch workflow' });
    }
});

router.post('/:id/activate', verifyResourceOwnership('workflows'), async (req, res) => {
    try {
        const workflowResult = await global.db.query(
            `SELECT n8n_workflow_id FROM ${req.schemaName}.workflows WHERE id = $1`,
            [req.params.id]
        );
        
        if (workflowResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        const n8n = getN8NService();
        await n8n.activateWorkflow(workflowResult.rows[0].n8n_workflow_id);
        
        await global.db.query(
            `UPDATE ${req.schemaName}.workflows SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [req.params.id]
        );
        
        res.json({ message: 'Workflow activated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to activate workflow' });
    }
});

router.post('/:id/deactivate', verifyResourceOwnership('workflows'), async (req, res) => {
    try {
        const workflowResult = await global.db.query(
            `SELECT n8n_workflow_id FROM ${req.schemaName}.workflows WHERE id = $1`,
            [req.params.id]
        );
        
        if (workflowResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        const n8n = getN8NService();
        await n8n.deactivateWorkflow(workflowResult.rows[0].n8n_workflow_id);
        
        await global.db.query(
            `UPDATE ${req.schemaName}.workflows SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [req.params.id]
        );
        
        res.json({ message: 'Workflow deactivated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to deactivate workflow' });
    }
});

router.delete('/:id', verifyResourceOwnership('workflows'), async (req, res) => {
    try {
        const workflowResult = await global.db.query(
            `SELECT n8n_workflow_id FROM ${req.schemaName}.workflows WHERE id = $1`,
            [req.params.id]
        );

        if (workflowResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        const n8n = getN8NService();
        await n8n.deleteWorkflow(workflowResult.rows[0].n8n_workflow_id);

        await global.db.query(
            `DELETE FROM ${req.schemaName}.workflows WHERE id = $1`,
            [req.params.id]
        );

        res.json({ message: 'Workflow deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete workflow' });
    }
});

// Update time estimates for a workflow (admin only)
router.patch('/:id/time-estimates', async (req, res) => {
    try {
        const { id } = req.params;
        const { manual_time_minutes, n8n_time_seconds } = req.body;
        const userRole = req.headers['x-user-role'];

        // Only global_admin can update time estimates
        if (userRole !== 'global_admin' && userRole !== 'admin') {
            return res.status(403).json({ error: 'Only administrators can update time estimates' });
        }

        const result = await global.db.query(
            `UPDATE public.workflows
             SET manual_time_minutes = $1, n8n_time_seconds = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id, name, manual_time_minutes, n8n_time_seconds`,
            [manual_time_minutes, n8n_time_seconds, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        res.json({
            success: true,
            message: 'Time estimates updated successfully',
            workflow: result.rows[0]
        });
    } catch (err) {
        console.error('Error updating time estimates:', err);
        res.status(500).json({ error: 'Failed to update time estimates' });
    }
});

module.exports = router;