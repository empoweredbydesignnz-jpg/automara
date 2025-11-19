// backend/src/routes/tenants.js
// Tenant management and signup routes

const express = require('express');
const router = express.Router();
const { verifySession } = require('supertokens-node/recipe/session/framework/express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const EncryptionService = require('../services/encryption');

/**
 * @swagger
 * /api/tenants/register:
 *   post:
 *     summary: Register a new tenant
 *     tags: [Tenants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               subdomain:
 *                 type: string
 *               email:
 *                 type: string
 *               plan:
 *                 type: string
 */
router.post('/register', async (req, res) => {
    const { name, subdomain, email, plan = 'basic' } = req.body;
    
    if (!name || !subdomain || !email) {
        return res.status(400).json({ 
            error: 'name, subdomain, and email are required',
        });
    }
    
    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomain)) {
        return res.status(400).json({ 
            error: 'Invalid subdomain format. Use lowercase letters, numbers, and hyphens only.',
        });
    }
    
    const client = await global.db.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if subdomain is already taken
        const existingTenant = await client.query(
            'SELECT id FROM public.tenants WHERE subdomain = $1',
            [subdomain]
        );
        
        if (existingTenant.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Subdomain already taken' });
        }
        
        // Create Stripe customer
        const customer = await stripe.customers.create({
            email,
            name,
            metadata: {
                subdomain,
            },
        });
        
        // Generate schema name (tenant_subdomain)
        const schemaName = `tenant_${subdomain.replace(/-/g, '_')}`;
        
        // Create tenant record
        const tenantResult = await client.query(
            `INSERT INTO public.tenants 
            (name, subdomain, schema_name, status, stripe_customer_id, subscription_plan)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [name, subdomain, schemaName, 'pending', customer.id, plan]
        );
        
        const tenant = tenantResult.rows[0];
        
        // Create tenant schema
        await client.query(`SELECT create_tenant_schema($1)`, [schemaName]);
        
        await client.query('COMMIT');
        
        res.status(201).json({
            message: 'Tenant registered successfully',
            tenant: {
                id: tenant.id,
                name: tenant.name,
                subdomain: tenant.subdomain,
                status: tenant.status,
            },
            stripe_customer_id: customer.id,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error registering tenant:', err);
        
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Tenant already exists' });
        }
        
        res.status(500).json({ 
            error: 'Failed to register tenant',
            details: err.message,
        });
    } finally {
        client.release();
    }
});

/**
 * @swagger
 * /api/tenants/me:
 *   get:
 *     summary: Get current tenant information
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', verifySession(), async (req, res) => {
    try {
        const session = req.session;
        const tenantId = session.getAccessTokenPayload().tenantId;
        
        if (!tenantId) {
            return res.status(403).json({ error: 'No tenant context' });
        }
        
        const result = await global.db.query(
            `SELECT id, name, subdomain, status, subscription_status, 
                    subscription_plan, created_at, metadata 
             FROM public.tenants 
             WHERE id = $1`,
            [tenantId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        
        res.json({ tenant: result.rows[0] });
    } catch (err) {
        console.error('Error fetching tenant:', err);
        res.status(500).json({ error: 'Failed to fetch tenant information' });
    }
});

/**
 * @swagger
 * /api/tenants/me:
 *   patch:
 *     summary: Update tenant information
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/me', verifySession(), async (req, res) => {
    try {
        const session = req.session;
        const tenantId = session.getAccessTokenPayload().tenantId;
        const { name, metadata } = req.body;
        
        if (!tenantId) {
            return res.status(403).json({ error: 'No tenant context' });
        }
        
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (name) {
            updates.push(`name = $${paramCount}`);
            values.push(name);
            paramCount++;
        }
        
        if (metadata) {
            updates.push(`metadata = $${paramCount}`);
            values.push(JSON.stringify(metadata));
            paramCount++;
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(tenantId);
        
        const result = await global.db.query(
            `UPDATE public.tenants 
             SET ${updates.join(', ')} 
             WHERE id = $${paramCount} 
             RETURNING *`,
            values
        );
        
        res.json({ 
            message: 'Tenant updated successfully',
            tenant: result.rows[0],
        });
    } catch (err) {
        console.error('Error updating tenant:', err);
        res.status(500).json({ error: 'Failed to update tenant' });
    }
});

/**
 * @swagger
 * /api/tenants/subscription:
 *   post:
 *     summary: Create or update subscription
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 */
router.post('/subscription', verifySession(), async (req, res) => {
    try {
        const session = req.session;
        const tenantId = session.getAccessTokenPayload().tenantId;
        const { price_id, payment_method_id } = req.body;
        
        if (!price_id) {
            return res.status(400).json({ error: 'price_id is required' });
        }
        
        // Get tenant
        const tenantResult = await global.db.query(
            'SELECT stripe_customer_id FROM public.tenants WHERE id = $1',
            [tenantId]
        );
        
        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        
        const customerId = tenantResult.rows[0].stripe_customer_id;
        
        // Attach payment method if provided
        if (payment_method_id) {
            await stripe.paymentMethods.attach(payment_method_id, {
                customer: customerId,
            });
            
            await stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: payment_method_id,
                },
            });
        }
        
        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: price_id }],
            expand: ['latest_invoice.payment_intent'],
        });
        
        // Update tenant
        await global.db.query(
            `UPDATE public.tenants 
             SET stripe_subscription_id = $1, 
                 subscription_status = $2, 
                 subscription_plan = $3,
                 status = 'active',
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $4`,
            [subscription.id, subscription.status, price_id, tenantId]
        );
        
        res.json({
            message: 'Subscription created successfully',
            subscription: {
                id: subscription.id,
                status: subscription.status,
                current_period_end: subscription.current_period_end,
            },
        });
    } catch (err) {
        console.error('Error creating subscription:', err);
        res.status(500).json({ 
            error: 'Failed to create subscription',
            details: err.message,
        });
    }
});

/**
 * @swagger
 * /api/tenants/usage:
 *   get:
 *     summary: Get tenant usage statistics
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 */
router.get('/usage', verifySession(), async (req, res) => {
    try {
        const session = req.session;
        const tenantId = session.getAccessTokenPayload().tenantId;
        
        const tenantResult = await global.db.query(
            'SELECT schema_name FROM public.tenants WHERE id = $1',
            [tenantId]
        );
        
        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        
        const schemaName = tenantResult.rows[0].schema_name;
        
        // Get workflow count
        const workflowCount = await global.db.query(
            `SELECT COUNT(*) as count FROM ${schemaName}.workflows`
        );
        
        // Get execution count (last 30 days)
        const executionCount = await global.db.query(
            `SELECT COUNT(*) as count 
             FROM ${schemaName}.workflow_executions 
             WHERE started_at > NOW() - INTERVAL '30 days'`
        );
        
        // Get API key count
        const apiKeyCount = await global.db.query(
            `SELECT COUNT(*) as count FROM ${schemaName}.api_keys WHERE is_active = true`
        );
        
        res.json({
            usage: {
                workflows: parseInt(workflowCount.rows[0].count),
                executions_30d: parseInt(executionCount.rows[0].count),
                active_api_keys: parseInt(apiKeyCount.rows[0].count),
            },
        });
    } catch (err) {
        console.error('Error fetching usage:', err);
        res.status(500).json({ error: 'Failed to fetch usage statistics' });
    }
});

module.exports = router;
