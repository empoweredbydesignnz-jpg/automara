// backend/src/services/encryption.js
// AES encryption service for sensitive data

const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

class EncryptionService {
    /**
     * Encrypts text using AES-256-GCM
     * @param {string} text - Plain text to encrypt
     * @returns {string} - Base64 encoded encrypted data
     */
    static encrypt(text) {
        if (!text) return null;
        
        const iv = crypto.randomBytes(IV_LENGTH);
        const salt = crypto.randomBytes(SALT_LENGTH);
        
        const key = crypto.pbkdf2Sync(
            ENCRYPTION_KEY,
            salt,
            100000,
            32,
            'sha512'
        );
        
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([
            cipher.update(String(text), 'utf8'),
            cipher.final(),
        ]);
        
        const tag = cipher.getAuthTag();
        
        const result = Buffer.concat([salt, iv, tag, encrypted]);
        return result.toString('base64');
    }
    
    /**
     * Decrypts AES-256-GCM encrypted text
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @returns {string} - Decrypted plain text
     */
    static decrypt(encryptedData) {
        if (!encryptedData) return null;
        
        try {
            const buffer = Buffer.from(encryptedData, 'base64');
            
            const salt = buffer.slice(0, SALT_LENGTH);
            const iv = buffer.slice(SALT_LENGTH, TAG_POSITION);
            const tag = buffer.slice(TAG_POSITION, ENCRYPTED_POSITION);
            const encrypted = buffer.slice(ENCRYPTED_POSITION);
            
            const key = crypto.pbkdf2Sync(
                ENCRYPTION_KEY,
                salt,
                100000,
                32,
                'sha512'
            );
            
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(tag);
            
            const decrypted = decipher.update(encrypted) + decipher.final('utf8');
            return decrypted;
        } catch (err) {
            console.error('Decryption error:', err);
            return null;
        }
    }
    
    /**
     * Generates a secure random token
     * @param {number} length - Token length in bytes
     * @returns {string} - Hex encoded token
     */
    static generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    /**
     * Creates HMAC signature for webhook verification
     * @param {string} payload - Payload to sign
     * @param {string} secret - Secret key
     * @returns {string} - Hex encoded signature
     */
    static signPayload(payload, secret) {
        return crypto
            .createHmac('sha256', secret)
            .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
            .digest('hex');
    }
    
    /**
     * Verifies HMAC signature
     * @param {string} payload - Original payload
     * @param {string} signature - Signature to verify
     * @param {string} secret - Secret key
     * @returns {boolean} - True if signature is valid
     */
    static verifySignature(payload, signature, secret) {
        const expectedSignature = this.signPayload(payload, secret);
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }
}

module.exports = EncryptionService;
