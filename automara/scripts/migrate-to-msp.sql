-- Migration Script: Add MSP Support to Existing Automara Installation
-- This script safely adds MSP hierarchy support to existing databases
-- Run this AFTER backing up your database!

-- ============================================================================
-- STEP 1: Add new columns to client_tenants table (if they don't exist)
-- ============================================================================

-- Add tenant_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_tenants' AND column_name = 'tenant_type'
    ) THEN
        ALTER TABLE client_tenants ADD COLUMN tenant_type VARCHAR(50) DEFAULT 'client' CHECK (tenant_type IN ('msp', 'sub_tenant', 'client'));
        RAISE NOTICE 'Added tenant_type column';
    END IF;
END $$;

-- Add parent_tenant_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_tenants' AND column_name = 'parent_tenant_id'
    ) THEN
        ALTER TABLE client_tenants ADD COLUMN parent_tenant_id INT REFERENCES client_tenants(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added parent_tenant_id column';
    END IF;
END $$;

-- Add msp_root_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_tenants' AND column_name = 'msp_root_id'
    ) THEN
        ALTER TABLE client_tenants ADD COLUMN msp_root_id INT REFERENCES client_tenants(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added msp_root_id column';
    END IF;
END $$;

-- Add metadata column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_tenants' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE client_tenants ADD COLUMN metadata JSONB DEFAULT '{}';
        RAISE NOTICE 'Added metadata column';
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_tenants' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE client_tenants ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updated_at column';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Populate msp_root_id for existing tenants
-- ============================================================================

-- For all existing top-level tenants (no parent), set msp_root_id to themselves
UPDATE client_tenants
SET msp_root_id = id
WHERE parent_tenant_id IS NULL AND msp_root_id IS NULL;

-- For any sub-tenants, inherit msp_root_id from parent
UPDATE client_tenants t
SET msp_root_id = (
    SELECT COALESCE(p.msp_root_id, p.id)
    FROM client_tenants p
    WHERE p.id = t.parent_tenant_id
)
WHERE t.parent_tenant_id IS NOT NULL AND t.msp_root_id IS NULL;

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_client_tenants_domain ON client_tenants(domain);
CREATE INDEX IF NOT EXISTS idx_client_tenants_parent_id ON client_tenants(parent_tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_tenants_msp_root_id ON client_tenants(msp_root_id);
CREATE INDEX IF NOT EXISTS idx_client_tenants_status ON client_tenants(status);
CREATE INDEX IF NOT EXISTS idx_client_tenants_tenant_type ON client_tenants(tenant_type);

-- ============================================================================
-- STEP 4: Create/update triggers
-- ============================================================================

-- Trigger function to automatically set msp_root_id
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

-- Apply to users (if users table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Add updated_at column to users if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'updated_at'
        ) THEN
            ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;

        -- Add trigger
        DROP TRIGGER IF EXISTS update_users_updated_at ON users;
        CREATE TRIGGER update_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Create helper views
-- ============================================================================

-- View to see the full MSP hierarchy
CREATE OR REPLACE VIEW v_msp_hierarchy AS
WITH RECURSIVE hierarchy AS (
    -- Base case: top-level tenants
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
-- STEP 6: Create helper function
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
-- STEP 7: Verify migration
-- ============================================================================

-- Check that all tenants have msp_root_id set
DO $$
DECLARE
    v_null_count INT;
BEGIN
    SELECT COUNT(*) INTO v_null_count
    FROM client_tenants
    WHERE msp_root_id IS NULL;

    IF v_null_count > 0 THEN
        RAISE WARNING 'Found % tenants without msp_root_id set. Please review.', v_null_count;
    ELSE
        RAISE NOTICE 'All tenants have msp_root_id set correctly!';
    END IF;
END $$;

-- ============================================================================
-- Migration Complete!
-- ============================================================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'MSP Migration Complete!';
RAISE NOTICE '===========================================';
RAISE NOTICE 'Summary:';
RAISE NOTICE '- Added msp_root_id, tenant_type, parent_tenant_id columns';
RAISE NOTICE '- Created indexes for performance';
RAISE NOTICE '- Created triggers for automatic msp_root_id management';
RAISE NOTICE '- Created helper views and functions';
RAISE NOTICE '';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Restart your backend server';
RAISE NOTICE '2. Test MSP isolation with different user roles';
RAISE NOTICE '3. Convert tenants to MSP type as needed via the UI';
RAISE NOTICE '===========================================';
