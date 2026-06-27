-- 1. Create composite and partial indexes for dashboard performance
CREATE INDEX IF NOT EXISTS idx_medicines_active ON medicines(circle_id) WHERE NOT is_archived;
CREATE INDEX IF NOT EXISTS idx_dose_logs_circle_time ON medicine_dose_logs(circle_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_circle_status ON tasks(circle_id, status);
CREATE INDEX IF NOT EXISTS idx_bp_logs_circle_time ON blood_pressure_logs(circle_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_circle_time ON sleep_logs(circle_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_step_logs_circle_date ON step_logs(circle_id, date DESC);

-- 2. Add explicit WITH CHECK clauses to RLS write policies for strict circle isolation
-- Drop existing FOR ALL policies to recreate them with proper USING and WITH CHECK clauses
DROP POLICY IF EXISTS "circle_isolation_policy" ON circles;
CREATE POLICY "circle_isolation_policy" ON circles
    FOR ALL
    USING (id = (SELECT circle_id FROM users WHERE id = auth.uid()))
    WITH CHECK (id = (SELECT circle_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "user_isolation_policy" ON users;
CREATE POLICY "user_isolation_policy" ON users
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()))
    WITH CHECK (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "medicine_isolation_policy" ON medicines;
CREATE POLICY "medicine_isolation_policy" ON medicines
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()))
    WITH CHECK (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "dose_log_isolation_policy" ON medicine_dose_logs;
CREATE POLICY "dose_log_isolation_policy" ON medicine_dose_logs
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()))
    WITH CHECK (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "task_isolation_policy" ON tasks;
CREATE POLICY "task_isolation_policy" ON tasks
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()))
    WITH CHECK (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
