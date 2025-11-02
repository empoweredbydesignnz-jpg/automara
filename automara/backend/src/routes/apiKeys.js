// backend/src/routes/apiKeys.js
// API key management with encryption

const express = require('express');
const router = express.Router();
const EncryptionService = require('../services/encryption');

/**
 * @swagger
 * /api/keys:
 *   get:
 *     summary: Get all API keys for the tenant
 */
router.get('/', async (req, res) => {
    try {
        const result = await global.db.query(
            `SELECT id, service_name, key_name, is_active, created_at, updated_at, last_used 
             FROM ${req.schemaName}.api_keys 
             ORDER BY created_at DESC`
        );
        
        res.json({ api_keys: result.rows });
    } catch (err) {
        console.error('Error fetching API keys:', err);
        res.status(500).json({ error: 'Failed to fetch API keys' });
    }
});

/**
 * @swagger
 * /api/keys:
 *   post:
 *     summary: Create a new API key
 */
router.post('/', async (req, res) => {
    const { service_name, key_name, api_key, api_secret } = req.body;
    
    if (!service_name || !key_name || !api_key) {
        return res.status(400).json({ 
            error: 'service_name, key_name, and api_key are required',
        });
    }
    
    try {
        // Encrypt the sensitive data
        const encryptedKey = EncryptionService.encrypt(api_key);
        const encryptedSecret = api_secret ? EncryptionService.encrypt(api_secret) : null;
        
        const result = await global.db.query(
            `INSERT INTO ${req.schemaName}.api_keys 
            (service_name, key_name, encrypted_key, encrypted_secret, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING id, service_name, key_name, is_active, created_at`,
            [service_name, key_name, encryptedKey, encryptedSecret]
        );
        
        res.status(201).json({ 
            message: 'API key created successfully',
            api_key: result.rows[0],
        });
    } catch (err) {
        console.error('Error creating API key:', err);
        res.status(500).json({ error: 'Failed to create API key' });
    }
});

/**
 * @swagger
 * /api/keys/{id}:
 *   delete:
 *     summary: Revoke/delete an API key
 */
router.delete('/:id', async (req, res) => {
    try {
        const result = await global.db.query(
            `DELETE FROM ${req.schemaName}.api_keys 
             WHERE id = $1 
             RETURNING id`,
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'API key not found' });
        }
        
        res.json({ message: 'API key revoked successfully' });
    } catch (err) {
        console.error('Error revoking API key:', err);
        res.status(500).json({ error: 'Failed to revoke API key' });
    }
});

/**
 * @swagger
 * /api/keys/{id}/toggle:
 *   patch:
 *     summary: Enable or disable an API key
 */
router.patch('/:id/toggle', async (req, res) => {
    try {
        const result = await global.db.query(
            `UPDATE ${req.schemaName}.api_keys 
             SET is_active = NOT is_active, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 
             RETURNING id, is_active`,
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'API key not found' });
        }
        
        res.json({ 
            message: 'API key status updated',
            is_active: result.rows[0].is_active,
        });
    } catch (err) {
        console.error('Error toggling API key:', err);
        res.status(500).json({ error: 'Failed to toggle API key status' });
    }
});

module.exports = router;
