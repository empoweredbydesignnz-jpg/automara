// backend/src/routes/webhooks.js
// Webhook endpoints with signature verification

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const EncryptionService = require('../services/encryption');

/**
 * Verify webhook signature
 */
const verifyWebhookSignature = async (req, res, next) => {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    
    if (!signature || !timestamp) {
        return res.status(401).json({ error: 'Missing webhook signature or timestamp' });
    }
    
    // Check timestamp is within 5 minutes
    const requestTime = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (Math.abs(currentTime - requestTime) > 300) {
        return res.status(401).json({ error: 'Webhook timestamp expired' });
    }
    
    const tenantId = req.params.tenantId;
    const workflowId = req.params.workflowId;
    
    try {
        // Get tenant schema
        const tenantResult = await global.db.query(
            'SELECT schema_name FROM public.tenants WHERE id = $1',
            [tenantId]
        );
        
        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        
        const schemaName = tenantResult.rows[0].schema_name;
        
        // Get workflow signing secret
        const workflowResult = await global.db.query(
            `SELECT configuration FROM ${schemaName}.workflows 
             WHERE n8n_workflow_id = $1`,
            [workflowId]
        );
        
        if (workflowResult.rows.length === 0) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        const signingSecret = workflowResult.rows[0].configuration.signing_secret;
        
        // Verify signature
        const payload = `${timestamp}.${JSON.stringify(req.body)}`;
        const expectedSignature = crypto
            .createHmac('sha256', signingSecret)
            .update(payload)
            .digest('hex');
        
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }
        
        // Attach schema to request
        req.tenantId = tenantId;
        req.schemaName = schemaName;
        req.workflowId = workflowId;
        
        next();
    } catch (err) {
        console.error('Webhook verification error:', err);
        return res.status(500).json({ error: 'Webhook verification failed' });
    }
};

/**
 * @swagger
 * /webhooks/{tenantId}/{workflowId}:
 *   post:
 *     summary: Webhook endpoint for workflow triggers
 *     tags: [Webhooks]
 */
router.post('/:tenantId/:workflowId', verifyWebhookSignature, async (req, res) => {
    try {
        const { tenantId, workflowId, schemaName } = req;
        const payload = req.body;
        
        // Log the webhook execution
        await global.db.query(
            `INSERT INTO ${schemaName}.workflow_executions 
            (workflow_id, status, started_at, input_data)
            VALUES (
                (SELECT id FROM ${schemaName}.workflows WHERE n8n_workflow_id = $1),
                $2, 
                CURRENT_TIMESTAMP, 
                $3
            )`,
            [workflowId, 'received', JSON.stringify(payload)]
        );
        
        // Update last executed timestamp
        await global.db.query(
            `UPDATE ${schemaName}.workflows 
             SET last_executed = CURRENT_TIMESTAMP, 
                 execution_count = execution_count + 1 
             WHERE n8n_workflow_id = $1`,
            [workflowId]
        );
        
        res.json({ 
            message: 'Webhook received successfully',
            tenant_id: tenantId,
            workflow_id: workflowId,
        });
    } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(500).json({ error: 'Failed to process webhook' });
    }
});

/**
 * Stripe webhook endpoint (unverified initially, Stripe will verify)
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Stripe webhook error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the event
    switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
            const subscription = event.data.object;
            await global.db.query(
                `UPDATE public.tenants 
                 SET stripe_subscription_id = $1, 
                     subscription_status = $2, 
                     subscription_plan = $3 
                 WHERE stripe_customer_id = $4`,
                [
                    subscription.id,
                    subscription.status,
                    subscription.items.data[0].price.id,
                    subscription.customer,
                ]
            );
            break;
            
        case 'customer.subscription.deleted':
            const deletedSubscription = event.data.object;
            await global.db.query(
                `UPDATE public.tenants 
                 SET subscription_status = 'canceled' 
                 WHERE stripe_subscription_id = $1`,
                [deletedSubscription.id]
            );
            break;
            
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
    
    res.json({ received: true });
});

module.exports = router;

