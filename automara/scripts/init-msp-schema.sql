-- Automara Multi-MSP Database Schema
-- This schema implements strict tenant isolation with MSP hierarchy support
-- Global Admin -> MSPs -> Client Tenants (Sub-tenants) -> Users

-- ============================================================================
-- ROLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert the three core roles
INSERT INTO roles (name, display_name, description) VALUES
    ('global_admin', 'Global Administrator', 'Platform administrator with access to all MSPs and tenants'),
    ('client_admin', 'Client Administrator', 'MSP or tenant administrator with access to their organization and sub-tenants'),
    ('client_user', 'Client User', 'Regular user with access to their tenant only')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- CLIENT TENANTS TABLE (Main tenant hierarchy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    owner_email VARCHAR(255) NOT NULL,

    -- Status management
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),

    -- Tenant type and hierarchy
    tenant_type VARCHAR(50) DEFAULT 'client' CHECK (tenant_type IN ('msp', 'sub_tenant', 'client')),
    parent_tenant_id INT REFERENCES client_tenants(id) ON DELETE CASCADE,
    msp_root_id INT REFERENCES client_tenants(id) ON DELETE CASCADE,

    -- Schema name for data isolation (if using per-tenant schemas)
    schema_name VARCHAR(100),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_client_tenants_domain ON client_tenants(domain);
CREATE INDEX IF NOT EXISTS idx_client_tenants_parent_id ON client_tenants(parent_tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_tenants_msp_root_id ON client_tenants(msp_root_id);
CREATE INDEX IF NOT EXISTS idx_client_tenants_status ON client_tenants(status);
CREATE INDEX IF NOT EXISTS idx_client_tenants_tenant_type ON client_tenants(tenant_type);

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),

    -- Role and tenant association
    role VARCHAR(50) DEFAULT 'client_user' REFERENCES roles(name) ON UPDATE CASCADE,
    tenant_id INT REFERENCES client_tenants(id) ON DELETE CASCADE,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

    -- Password hash (for future use)
    password_hash TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,

    -- Ensure email is unique per tenant (global_admin has NULL tenant_id)
    UNIQUE(email, tenant_id)
);

-- ============================================================================
-- INDEXES for Users
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================================
-- MSP HIERARCHY CONSTRAINTS
-- ============================================================================

-- Trigger to automatically set msp_root_id when creating a tenant
CREATE OR REPLACE FUNCTION set_msp_root_id()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is an MSP (top-level), set msp_root_id to itself
    IF NEW.tenant_type = 'msp' AND NEW.parent_tenant_id IS NULL THEN
        NEW.msp_root_id := NEW.id;

    -- If this is a sub-tenant, inherit msp_root_id from parent
    ELSIF NEW.parent_tenant_id IS NOT NULL THEN
        SELECT COALESCE(msp_root_id, id) INTO NEW.msp_root_id
        FROM client_tenants
        WHERE id = NEW.parent_tenant_id;

    -- If this is a standalone client (no parent), set msp_root_id to itself
    ELSE
        NEW.msp_root_id := NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set msp_root_id
DROP TRIGGER IF EXISTS trigger_set_msp_root_id ON client_tenants;
CREATE TRIGGER trigger_set_msp_root_id
    BEFORE INSERT ON client_tenants
    FOR EACH ROW
    EXECUTE FUNCTION set_msp_root_id();

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to client_tenants
DROP TRIGGER IF EXISTS update_client_tenants_updated_at ON client_tenants;
CREATE TRIGGER update_client_tenants_updated_at
    BEFORE UPDATE ON client_tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR EASY QUERYING
-- ============================================================================

-- View to see the full MSP hierarchy
CREATE OR REPLACE VIEW v_msp_hierarchy AS
WITH RECURSIVE hierarchy AS (
    -- Base case: top-level MSPs
    SELECT
        t.id,
        t.name,
        t.domain,
        t.tenant_type,
        t.parent_tenant_id,
        t.msp_root_id,
        t.status,
        0 AS level,
        t.name AS path,
        ARRAY[t.id] AS id_path
    FROM client_tenants t
    WHERE t.parent_tenant_id IS NULL

    UNION ALL

    -- Recursive case: children
    SELECT
        t.id,
        t.name,
        t.domain,
        t.tenant_type,
        t.parent_tenant_id,
        t.msp_root_id,
        t.status,
        h.level + 1,
        h.path || ' > ' || t.name,
        h.id_path || t.id
    FROM client_tenants t
    INNER JOIN hierarchy h ON t.parent_tenant_id = h.id
)
SELECT * FROM hierarchy ORDER BY id_path;

-- View to see tenant with user counts
CREATE OR REPLACE VIEW v_tenants_with_stats AS
SELECT
    t.id,
    t.name,
    t.domain,
    t.tenant_type,
    t.parent_tenant_id,
    t.msp_root_id,
    t.status,
    t.owner_email,
    t.created_at,
    COUNT(u.id) AS user_count,
    COUNT(CASE WHEN u.status = 'active' THEN 1 END) AS active_user_count,
    (SELECT COUNT(*) FROM client_tenants WHERE parent_tenant_id = t.id) AS sub_tenant_count
FROM client_tenants t
LEFT JOIN users u ON t.id = u.tenant_id
GROUP BY t.id;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a user can access a tenant (respecting MSP boundaries)
CREATE OR REPLACE FUNCTION can_user_access_tenant(
    p_user_role VARCHAR,
    p_user_tenant_id INT,
    p_target_tenant_id INT
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_msp_root_id INT;
    v_target_msp_root_id INT;
BEGIN
    -- Global admin can access everything
    IF p_user_role = 'global_admin' THEN
        RETURN TRUE;
    END IF;

    -- Get MSP root IDs
    SELECT msp_root_id INTO v_user_msp_root_id
    FROM client_tenants
    WHERE id = p_user_tenant_id;

    SELECT msp_root_id INTO v_target_msp_root_id
    FROM client_tenants
    WHERE id = p_target_tenant_id;

    -- Users can only access tenants within their MSP hierarchy
    RETURN v_user_msp_root_id = v_target_msp_root_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Note: Actual data will be inserted by the application
-- This is just a structure reference

-- Example MSP setup:
-- MSP 1: "Stratus Blue IT" (id=1, msp_root_id=1)
--   └─ Client A (id=2, parent_tenant_id=1, msp_root_id=1)
--   └─ Client B (id=3, parent_tenant_id=1, msp_root_id=1)
--
-- MSP 2: "TechCorp MSP" (id=4, msp_root_id=4)
--   └─ Client C (id=5, parent_tenant_id=4, msp_root_id=4)
--   └─ Client D (id=6, parent_tenant_id=4, msp_root_id=4)

-- ============================================================================
-- AUDIT LOG (Optional - for tracking changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    tenant_id INT REFERENCES client_tenants(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INT,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE client_tenants IS 'Stores MSP and client tenant information with hierarchical structure';
COMMENT ON COLUMN client_tenants.tenant_type IS 'Type: msp (top-level MSP), sub_tenant (client under MSP), client (standalone)';
COMMENT ON COLUMN client_tenants.msp_root_id IS 'Points to the root MSP that owns this tenant hierarchy. Set automatically via trigger.';
COMMENT ON COLUMN client_tenants.parent_tenant_id IS 'Points to parent tenant. NULL for top-level MSPs.';

COMMENT ON TABLE users IS 'User accounts associated with tenants';
COMMENT ON COLUMN users.role IS 'User role: global_admin, client_admin, or client_user';
COMMENT ON COLUMN users.tenant_id IS 'NULL for global_admin, otherwise references the user tenant';

COMMENT ON FUNCTION can_user_access_tenant IS 'Security function to check if a user can access a tenant based on MSP boundaries';
