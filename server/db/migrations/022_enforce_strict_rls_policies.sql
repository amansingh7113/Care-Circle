-- Migration: 022_enforce_strict_rls_policies
-- Purpose: Establishes mathematically strict RLS policies across all core tables referencing circle_memberships
-- to ensure robust multi-circle access control and user isolation in accordance with DPDP Act standards.

DO $$
BEGIN
    -- Drop legacy policies if they exist to replace them with strict circle_memberships verification
    DROP POLICY IF EXISTS "circle_isolation_policy" ON circles;
    DROP POLICY IF EXISTS "user_isolation_policy" ON users;
    DROP POLICY IF EXISTS "medicine_isolation_policy" ON medicines;
    DROP POLICY IF EXISTS "dose_log_isolation_policy" ON medicine_dose_logs;
    DROP POLICY IF EXISTS "task_isolation_policy" ON tasks;
    DROP POLICY IF EXISTS "circle_budgets_isolation_policy" ON circle_budgets;
    DROP POLICY IF EXISTS "notifications_isolation_policy" ON notifications;
    DROP POLICY IF EXISTS "ai_insights_history_isolation_policy" ON ai_insights_history;
    DROP POLICY IF EXISTS "vitals_isolation_policy" ON blood_pressure_logs;
    DROP POLICY IF EXISTS "sleep_logs_isolation_policy" ON sleep_logs;

    -- Recreate strict policies checking circle_memberships
    CREATE POLICY "circle_isolation_policy" ON circles
        FOR ALL
        USING (id IN (SELECT circle_id FROM circle_memberships WHERE user_id = (SELECT auth.uid()) AND status = 'active'));

    CREATE POLICY "user_isolation_policy" ON users
        FOR ALL
        USING (circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = (SELECT auth.uid()) AND status = 'active'));

    CREATE POLICY "medicine_isolation_policy" ON medicines
        FOR ALL
        USING (circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = (SELECT auth.uid()) AND status = 'active'));

    CREATE POLICY "dose_log_isolation_policy" ON medicine_dose_logs
        FOR ALL
        USING (circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = (SELECT auth.uid()) AND status = 'active'));

    CREATE POLICY "task_isolation_policy" ON tasks
        FOR ALL
        USING (circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = (SELECT auth.uid()) AND status = 'active'));

    CREATE POLICY "circle_budgets_isolation_policy" ON circle_budgets
        FOR ALL
        USING (circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = (SELECT auth.uid()) AND status = 'active'));

    CREATE POLICY "notifications_isolation_policy" ON notifications
        FOR ALL
        USING (circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = (SELECT auth.uid()) AND status = 'active'));

    CREATE POLICY "ai_insights_history_isolation_policy" ON ai_insights_history
        FOR ALL
        USING (circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = (SELECT auth.uid()) AND status = 'active'));

    CREATE POLICY "vitals_isolation_policy" ON blood_pressure_logs
        FOR ALL
        USING (circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = (SELECT auth.uid()) AND status = 'active'));

    CREATE POLICY "sleep_logs_isolation_policy" ON sleep_logs
        FOR ALL
        USING (circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = (SELECT auth.uid()) AND status = 'active'));
END
$$;
