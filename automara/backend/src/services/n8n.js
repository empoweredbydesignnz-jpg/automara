// backend/src/services/n8n.js
// N8N workflow management service with template cloning and tenant isolation

const axios = require('axios');
const EncryptionService = require('./encryption');

const N8N_HOST = process.env.N8N_HOST || 'http://n8n:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_URL;

class N8NService {
    constructor() {
        this.client = axios.create({
            baseURL: N8N_HOST,
            headers: {
                'X-N8N-API-KEY': N8N_API_KEY,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
    }
    
    /**
     * Initialize N8N connection and verify it's working
     */
    async initialize() {
        try {
            const response = await this.client.get('/healthz');
            console.log('✅ N8N connection verified:', response.data);
            return true;
        } catch (err) {
            console.error('❌ N8N connection failed:', err.message);
            throw new Error('Failed to connect to N8N service');
        }
    }

    /** 
    * n8n getallworkflows
    */
    async getAllWorkflows() {
        try {
        const response = await this.client.get('/api/v1/workflows');
        return response.data.data || [];
    } catch (err) {
        console.error('Error fetching N8N workflows:', err.response?.data || err.message);
        throw new Error('Failed to fetch workflows from N8N');
    }
}
    
    /**
     * Get all available workflow templates
     */
    async getTemplates() {
        const templates = {
            'm365_onboarding': {
                name: 'M365 User Onboarding',
                description: 'Automate Microsoft 365 user creation, license assignment, and group membership',
                category: 'm365',
                config_fields: [
                    { name: 'tenant_id', label: 'Azure Tenant ID', type: 'text', required: true },
                    { name: 'client_id', label: 'Client ID', type: 'text', required: true },
                    { name: 'client_secret', label: 'Client Secret', type: 'password', required: true },
                ],
            },
            'm365_offboarding': {
                name: 'M365 User Offboarding',
                description: 'Automate user deactivation, license removal, and access revocation',
                category: 'm365',
                config_fields: [
                    { name: 'tenant_id', label: 'Azure Tenant ID', type: 'text', required: true },
                    { name: 'client_id', label: 'Client ID', type: 'text', required: true },
                    { name: 'client_secret', label: 'Client Secret', type: 'password', required: true },
                ],
            },
            'm365_conditional_access': {
                name: 'M365 Conditional Access Deployment',
                description: 'Deploy and manage conditional access policies across your tenant',
                category: 'm365',
                config_fields: [
                    { name: 'tenant_id', label: 'Azure Tenant ID', type: 'text', required: true },
                    { name: 'client_id', label: 'Client ID', type: 'text', required: true },
                    { name: 'client_secret', label: 'Client Secret', type: 'password', required: true },
                ],
            },
        };
        
        return templates;
    }
    
    /**
     * Create a workflow from template for a specific tenant
     * @param {string} templateType - Type of template (m365_onboarding, etc.)
     * @param {string} tenantId - Tenant UUID
     * @param {object} credentials - Encrypted credentials for the workflow
     * @param {string} schemaName - Tenant's schema name
     */
    async createWorkflowFromTemplate(templateType, tenantId, credentials, schemaName) {
        try {
            // Get the template definition
            const workflowDefinition = this.getWorkflowDefinition(templateType, tenantId, credentials);
            
            // Create workflow in N8N
            const response = await this.client.post('/api/v1/workflows', workflowDefinition);
            
            const workflowId = response.data.id;
            const webhookUrl = `${WEBHOOK_BASE_URL}/${tenantId}/${workflowId}`;
            
            // Generate signing secret for webhook verification
            const signingSecret = EncryptionService.generateToken(32);
            
            // Store workflow in tenant's schema
            await global.db.query(
                `INSERT INTO ${schemaName}.workflows 
                (n8n_workflow_id, workflow_type, name, description, webhook_url, is_active, configuration)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *`,
                [
                    workflowId,
                    templateType,
                    workflowDefinition.name,
                    workflowDefinition.description || '',
                    webhookUrl,
                    false, // Inactive by default
                    JSON.stringify({
                        signing_secret: signingSecret,
                        template_type: templateType,
                    }),
                ]
            );
            
            console.log(`✅ Workflow created for tenant ${tenantId}: ${workflowId}`);
            
            return {
                workflowId,
                webhookUrl,
                signingSecret,
                name: workflowDefinition.name,
            };
        } catch (err) {
            console.error('Error creating workflow from template:', err.response?.data || err.message);
            throw new Error(`Failed to create workflow: ${err.message}`);
        }
    }
    
    /**
     * Get workflow definition based on template type
     */
    getWorkflowDefinition(templateType, tenantId, credentials) {
        const baseDefinition = {
            tags: [{ name: `tenant_${tenantId}` }],
            settings: {
                executionOrder: 'v1',
            },
        };
        
        switch (templateType) {
            case 'm365_onboarding':
                return {
                    ...baseDefinition,
                    name: `M365 Onboarding - Tenant ${tenantId}`,
                    description: 'Automated Microsoft 365 user onboarding workflow',
                    nodes: [
                        {
                            parameters: {
                                httpMethod: 'POST',
                                path: `${tenantId}/onboarding`,
                                responseMode: 'onReceived',
                                options: {},
                            },
                            name: 'Webhook',
                            type: 'n8n-nodes-base.webhook',
                            typeVersion: 1,
                            position: [250, 300],
                            webhookId: EncryptionService.generateToken(16),
                        },
                        {
                            parameters: {
                                authentication: 'oAuth2',
                                resource: 'user',
                                operation: 'create',
                                accountEnabled: true,
                                displayName: '={{$json["displayName"]}}',
                                mailNickname: '={{$json["mailNickname"]}}',
                                userPrincipalName: '={{$json["userPrincipalName"]}}',
                                additionalFields: {
                                    givenName: '={{$json["givenName"]}}',
                                    surname: '={{$json["surname"]}}',
                                    jobTitle: '={{$json["jobTitle"]}}',
                                    department: '={{$json["department"]}}',
                                },
                            },
                            name: 'Create User',
                            type: 'n8n-nodes-base.microsoftGraph',
                            typeVersion: 1,
                            position: [450, 300],
                            credentials: {
                                microsoftGraphOAuth2Api: {
                                    clientId: credentials.client_id,
                                    clientSecret: credentials.client_secret,
                                    tenantId: credentials.tenant_id,
                                },
                            },
                        },
                        {
                            parameters: {
                                resource: 'user',
                                operation: 'assignLicense',
                                userId: '={{$json["id"]}}',
                                addLicenses: {
                                    addLicense: [
                                        {
                                            skuId: '={{$json["licenseSkuId"]}}',
                                        },
                                    ],
                                },
                            },
                            name: 'Assign License',
                            type: 'n8n-nodes-base.microsoftGraph',
                            typeVersion: 1,
                            position: [650, 300],
                            credentials: {
                                microsoftGraphOAuth2Api: {
                                    clientId: credentials.client_id,
                                    clientSecret: credentials.client_secret,
                                    tenantId: credentials.tenant_id,
                                },
                            },
                        },
                        {
                            parameters: {
                                httpMethod: 'POST',
                                url: `${process.env.API_DOMAIN}/api/workflows/callback`,
                                authentication: 'genericCredentialType',
                                options: {},
                            },
                            name: 'Callback',
                            type: 'n8n-nodes-base.httpRequest',
                            typeVersion: 1,
                            position: [850, 300],
                        },
                    ],
                    connections: {
                        Webhook: {
                            main: [[{ node: 'Create User', type: 'main', index: 0 }]],
                        },
                        'Create User': {
                            main: [[{ node: 'Assign License', type: 'main', index: 0 }]],
                        },
                        'Assign License': {
                            main: [[{ node: 'Callback', type: 'main', index: 0 }]],
                        },
                    },
                };
                
            case 'm365_offboarding':
                return {
                    ...baseDefinition,
                    name: `M365 Offboarding - Tenant ${tenantId}`,
                    description: 'Automated Microsoft 365 user offboarding workflow',
                    nodes: [
                        {
                            parameters: {
                                httpMethod: 'POST',
                                path: `${tenantId}/offboarding`,
                                responseMode: 'onReceived',
                                options: {},
                            },
                            name: 'Webhook',
                            type: 'n8n-nodes-base.webhook',
                            typeVersion: 1,
                            position: [250, 300],
                            webhookId: EncryptionService.generateToken(16),
                        },
                        {
                            parameters: {
                                resource: 'user',
                                operation: 'update',
                                userId: '={{$json["userId"]}}',
                                updateFields: {
                                    accountEnabled: false,
                                },
                            },
                            name: 'Disable User',
                            type: 'n8n-nodes-base.microsoftGraph',
                            typeVersion: 1,
                            position: [450, 300],
                            credentials: {
                                microsoftGraphOAuth2Api: {
                                    clientId: credentials.client_id,
                                    clientSecret: credentials.client_secret,
                                    tenantId: credentials.tenant_id,
                                },
                            },
                        },
                        {
                            parameters: {
                                resource: 'user',
                                operation: 'removeLicense',
                                userId: '={{$json["userId"]}}',
                                removeLicenses: '={{$json["licenses"]}}',
                            },
                            name: 'Remove Licenses',
                            type: 'n8n-nodes-base.microsoftGraph',
                            typeVersion: 1,
                            position: [650, 300],
                            credentials: {
                                microsoftGraphOAuth2Api: {
                                    clientId: credentials.client_id,
                                    clientSecret: credentials.client_secret,
                                    tenantId: credentials.tenant_id,
                                },
                            },
                        },
                        {
                            parameters: {
                                httpMethod: 'POST',
                                url: `${process.env.API_DOMAIN}/api/workflows/callback`,
                                options: {},
                            },
                            name: 'Callback',
                            type: 'n8n-nodes-base.httpRequest',
                            typeVersion: 1,
                            position: [850, 300],
                        },
                    ],
                    connections: {
                        Webhook: {
                            main: [[{ node: 'Disable User', type: 'main', index: 0 }]],
                        },
                        'Disable User': {
                            main: [[{ node: 'Remove Licenses', type: 'main', index: 0 }]],
                        },
                        'Remove Licenses': {
                            main: [[{ node: 'Callback', type: 'main', index: 0 }]],
                        },
                    },
                };
                
            case 'm365_conditional_access':
                return {
                    ...baseDefinition,
                    name: `M365 Conditional Access - Tenant ${tenantId}`,
                    description: 'Deploy conditional access policies',
                    nodes: [
                        {
                            parameters: {
                                httpMethod: 'POST',
                                path: `${tenantId}/conditional-access`,
                                responseMode: 'onReceived',
                                options: {},
                            },
                            name: 'Webhook',
                            type: 'n8n-nodes-base.webhook',
                            typeVersion: 1,
                            position: [250, 300],
                            webhookId: EncryptionService.generateToken(16),
                        },
                        {
                            parameters: {
                                httpMethod: 'POST',
                                url: 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies',
                                authentication: 'oAuth2',
                                options: {},
                                bodyParametersJson: '={{$json["policy"]}}',
                            },
                            name: 'Create Policy',
                            type: 'n8n-nodes-base.httpRequest',
                            typeVersion: 1,
                            position: [450, 300],
                            credentials: {
                                oAuth2Api: {
                                    clientId: credentials.client_id,
                                    clientSecret: credentials.client_secret,
                                    accessTokenUrl: `https://login.microsoftonline.com/${credentials.tenant_id}/oauth2/v2.0/token`,
                                    authUrl: `https://login.microsoftonline.com/${credentials.tenant_id}/oauth2/v2.0/authorize`,
                                    scope: 'https://graph.microsoft.com/.default',
                                },
                            },
                        },
                        {
                            parameters: {
                                httpMethod: 'POST',
                                url: `${process.env.API_DOMAIN}/api/workflows/callback`,
                                options: {},
                            },
                            name: 'Callback',
                            type: 'n8n-nodes-base.httpRequest',
                            typeVersion: 1,
                            position: [650, 300],
                        },
                    ],
                    connections: {
                        Webhook: {
                            main: [[{ node: 'Create Policy', type: 'main', index: 0 }]],
                        },
                        'Create Policy': {
                            main: [[{ node: 'Callback', type: 'main', index: 0 }]],
                        },
                    },
                };
                
            default:
                throw new Error(`Unknown template type: ${templateType}`);
        }
    }
    
    /**
     * Activate a workflow
     */
    async activateWorkflow(workflowId) {
        try {
            await this.client.patch(`/api/v1/workflows/${workflowId}`, {
                active: true,
            });
            return true;
        } catch (err) {
            console.error('Error activating workflow:', err.response?.data || err.message);
            throw new Error('Failed to activate workflow');
        }
    }
    
    /**
     * Deactivate a workflow
     */
    async deactivateWorkflow(workflowId) {
        try {
            await this.client.patch(`/api/v1/workflows/${workflowId}`, {
                active: false,
            });
            return true;
        } catch (err) {
            console.error('Error deactivating workflow:', err.response?.data || err.message);
            throw new Error('Failed to deactivate workflow');
        }
    }
    
    /**
     * Delete a workflow
     */
    async deleteWorkflow(workflowId) {
        try {
            await this.client.delete(`/api/v1/workflows/${workflowId}`);
            return true;
        } catch (err) {
            console.error('Error deleting workflow:', err.response?.data || err.message);
            throw new Error('Failed to delete workflow');
        }
    }
    
    /**
     * Get workflow executions
     */
    async getExecutions(workflowId, limit = 20) {
        try {
            const response = await this.client.get('/api/v1/executions', {
                params: {
                    workflowId,
                    limit,
                },
            });
            return response.data.data;
        } catch (err) {
            console.error('Error fetching executions:', err.response?.data || err.message);
            return [];
        }
    }
    
    /**
     * Get workflow executions
     */
    async getExecutions(workflowId, limit = 20) {
        try {
            const response = await this.client.get('/api/v1/executions', {
                params: {
                    workflowId,
                    limit,
                },
            });
            return response.data.data;
        } catch (err) {
            console.error('Error fetching executions:', err.response?.data || err.message);
            return [];
        }
    }
    
    /**
     * Execute a workflow manually
     */
    async executeWorkflow(workflowId, data = {}) {
        try {
            const response = await this.client.post(`/api/v1/workflows/${workflowId}/execute`, {
                data,
            });
            return response.data;
        } catch (err) {
            console.error('Error executing workflow:', err.response?.data || err.message);
            throw new Error('Failed to execute workflow');
        }
    }

    /**
     * Get or create company folder (tag) in n8n.
     * @param {string} companyName - The name of the company/tenant.
     * @returns {string} The ID of the n8n tag/folder.
     */
    async getOrCreateCompanyFolder(companyName) {
        try {
            console.log(`[N8N] Fetching tags for company: ${companyName}`);
            const tagsResponse = await this.client.get('/api/v1/tags');
            
            const existingFolder = tagsResponse.data.data.find(
                tag => tag.name === companyName
            );
            
            if (existingFolder) {
                console.log(`[N8N] Found existing folder (ID: ${existingFolder.id})`);
                return existingFolder.id;
            }
            
            console.log(`[N8N] Creating new folder for: ${companyName}`);
            const createResponse = await this.client.post('/api/v1/tags', { name: companyName });
            
            console.log(`[N8N] Folder created (ID: ${createResponse.data.data.id})`);
            return createResponse.data.data.id;
        } catch (error) {
            console.error('[N8N] Error managing company folder:', error.response?.data || error.message);
            throw new Error(`Failed to create company folder: ${error.message}`);
        }
    }

    /**
     * Clones an n8n workflow and assigns it to a folder (tag).
     * @param {string} workflowId - The ID of the workflow to clone.
     * @param {string} newName - The name for the cloned workflow.
     * @param {string} folderId - The ID of the folder (tag) to assign the cloned workflow to.
     * @returns {object} The data of the newly cloned workflow.
     */
    async cloneWorkflowToFolder(workflowId, newName, folderId) {
        try {
            console.log(`[N8N] Fetching workflow ${workflowId}`);
            const workflowResponse = await this.client.get(`/api/v1/workflows/${workflowId}`);
            
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
            const createResponse = await this.client.post('/api/v1/workflows', clonedWorkflow);
            
            console.log(`[N8N] Clone created (ID: ${createResponse.data.data.id})`);
            return createResponse.data.data;
        } catch (error) {
            console.error('[N8N] Error cloning workflow:', error.response?.data || error.message);
            throw new Error(`Failed to clone workflow: ${error.message}`);
        }
    }
}

// Singleton instance
let n8nServiceInstance = null;

const initializeN8N = async () => {
    if (!n8nServiceInstance) {
        n8nServiceInstance = new N8NService();
        await n8nServiceInstance.initialize();
    }
    return n8nServiceInstance;
};

const getN8NService = () => {
    if (!n8nServiceInstance) {
        throw new Error('N8N service not initialized. Call initializeN8N() first.');
    }
    return n8nServiceInstance;
};

module.exports = { N8NService, initializeN8N, getN8NService };
