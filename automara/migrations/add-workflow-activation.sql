-- Add columns to track cloned workflows
ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS parent_workflow_id INTEGER REFERENCES workflows(id),
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS folder_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS cloned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_activated_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_active ON workflows(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_workflows_parent ON workflows(parent_workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON workflows(is_template);

-- Mark existing library workflows as templates
UPDATE workflows 
SET is_template = true 
WHERE tenant_id IS NULL;

-- Create activation history table
CREATE TABLE IF NOT EXISTS workflow_activations (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  activated_by INTEGER REFERENCES users(id),
  n8n_workflow_id VARCHAR(255),
  folder_name VARCHAR(255),
  cloned_workflow_name VARCHAR(255),
  activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deactivated_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_activations_workflow ON workflow_activations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_activations_tenant ON workflow_activations(tenant_id);