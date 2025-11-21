ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL;

ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS cloned_at TIMESTAMP;

ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS folder_name VARCHAR(255);

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

CREATE TABLE IF NOT EXISTS workflow_activity_log (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_template_id ON workflows(template_id);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_template ON workflows(tenant_id, is_template);
CREATE INDEX IF NOT EXISTS idx_workflow_activity_log_workflow ON workflow_activity_log(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_activity_log_user ON workflow_activity_log(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_unique_tenant_name 
ON workflows(tenant_id, name) 
WHERE is_template = false AND tenant_id IS NOT NULL;

UPDATE workflows w
SET folder_name = CONCAT(t.company_name, ' Workflows')
FROM tenants t
WHERE w.tenant_id = t.id 
AND w.folder_name IS NULL 
AND w.is_template = false;

COMMENT ON COLUMN workflows.template_id IS 'Reference to the template workflow this was cloned from';
COMMENT ON COLUMN workflows.cloned_at IS 'Timestamp when this workflow was duplicated from a template';
COMMENT ON COLUMN workflows.folder_name IS 'Folder/category name for organizing workflows in n8n';
COMMENT ON COLUMN tenants.company_name IS 'Company/business name for workflow prefixing and isolation';
COMMENT ON TABLE workflow_activity_log IS 'Audit log for all workflow-related actions';
