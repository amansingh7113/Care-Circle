-- Migration: 021_circle_memberships_and_rls.sql
-- Purpose: Introduces circle_memberships table for clean multi-circle support,
-- sync triggers, storage_path columns, and updated RLS policies.

CREATE TABLE IF NOT EXISTS circle_memberships (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Caregiver', 'Viewer', 'Patient')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'deactivated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, circle_id)
);

ALTER TABLE circle_memberships ENABLE ROW LEVEL SECURITY;

-- Add storage_path to documents and doctor_visits
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE doctor_visits ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Create sync function and trigger for legacy users table to populate circle_memberships
CREATE OR REPLACE FUNCTION sync_user_circle_membership()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.circle_id IS NOT NULL THEN
        INSERT INTO circle_memberships (user_id, circle_id, role, status)
        VALUES (NEW.id, NEW.circle_id, NEW.role, 'active')
        ON CONFLICT (user_id, circle_id) DO UPDATE
        SET role = EXCLUDED.role, status = 'active';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_circle_membership ON users;
CREATE TRIGGER trg_sync_user_circle_membership
    AFTER INSERT OR UPDATE OF circle_id, role ON users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_circle_membership();

-- Populate existing users into circle_memberships
INSERT INTO circle_memberships (user_id, circle_id, role, status)
SELECT id, circle_id, role, 'active' FROM users WHERE circle_id IS NOT NULL
ON CONFLICT (user_id, circle_id) DO NOTHING;

-- Update RLS policies to check circle_memberships table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'circle_memberships' AND policyname = 'circle_memberships_isolation_policy'
    ) THEN
        CREATE POLICY "circle_memberships_isolation_policy" ON circle_memberships
            FOR ALL
            USING (circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid() AND status = 'active'));
    END IF;
END
$$;
