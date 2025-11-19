// backend/src/middleware/tenant.js
// Tenant isolation middleware - ensures all requests are scoped to a tenant

const { verifySession } = require('supertokens-node/recipe/session/framework/express');
const crypto = require('crypto');

// Extract tenant ID from JWT or header
const tenantMiddleware = async (req, res, next) => {
    try {
        // First verify the session
        await verifySession()(req, res, async () => {
            const session = req.session;
            
            // Get tenant ID from JWT payload
            let tenantId = session.getAccessTokenPayload().tenantId;
            
            // Alternatively, check header (for API key access)
            if (!tenantId && req.headers['x-tenant-id']) {
                tenantId = req.headers['x-tenant-id'];
            }
            
            if (!tenantId) {
                return res.status(403).json({ 
                    error: 'Tenant ID required',
                    message: 'No tenant context found in session or headers',
                });
            }
            
            // Fetch tenant details and verify it's active
            const tenantResult = await global.db.query(
                'SELECT id, schema_name, status FROM public.tenants WHERE id = $1',
                [tenantId]
            );
            
            if (tenantResult.rows.length === 0) {
                return res.status(404).json({ error: 'Tenant not found' });
            }
            
            const tenant = tenantResult.rows[0];
            
            if (tenant.status !== 'active') {
                return res.status(403).json({ 
                    error: 'Tenant inactive',
                    message: 'Your account is not active. Please contact support.',
                });
            }
            
            // Attach tenant info to request
            req.tenant = tenant;
            req.tenantId = tenantId;
            req.schemaName = tenant.schema_name;
            
            // Set search path for this request to isolate queries
            await global.db.query(`SET search_path TO ${tenant.schema_name}, public`);
            
            next();
        });
    } catch (err) {
        console.error('Tenant middleware error:', err);
        return res.status(500).json({ error: 'Failed to verify tenant context' });
    }
};

// Middleware to verify tenant ownership of resources
const verifyResourceOwnership = (resourceTable, resourceIdParam = 'id') => {
    return async (req, res, next) => {
        const resourceId = req.params[resourceIdParam];
        const schemaName = req.schemaName;
        
        try {
            const result = await global.db.query(
                `SELECT id FROM ${schemaName}.${resourceTable} WHERE id = $1`,
                [resourceId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Resource not found',
                    message: `${resourceTable} with ID ${resourceId} not found in your account`,
                });
            }
            
            next();
        } catch (err) {
            console.error('Resource ownership verification error:', err);
            return res.status(500).json({ error: 'Failed to verify resource ownership' });
        }
    };
};

module.exports = { tenantMiddleware, verifyResourceOwnership };
