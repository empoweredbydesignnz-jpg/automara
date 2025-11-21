-- Add missing columns to workflows table for proper template/tenant separation
ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS n8n_data JSONB;

-- Update existing workflows to be templates if they don't have a tenant
UPDATE workflows 
SET is_template = true 
WHERE tenant_id IS NULL AND is_template IS NULL;

-- Update existing workflows with tenant to not be templates
UPDATE workflows 
SET is_template = false 
WHERE tenant_id IS NOT NULL;
