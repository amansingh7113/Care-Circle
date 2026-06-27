-- Migration: 020_enforce_rls_policies
-- Purpose: Ensures all tables in the schema have Row Level Security explicitly enabled
-- and defines robust fallback circle isolation policies where applicable.

-- Enable Row Level Security on all core and supporting tables
ALTER TABLE IF EXISTS circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS medicine_dose_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS doctor_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS circle_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS blood_pressure_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_insights_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS step_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hydration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS razorpay_orders ENABLE ROW LEVEL SECURITY;

-- Ensure robust policies exist for circle_budgets, notifications, and ai_insights_history
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'circle_budgets' AND policyname = 'circle_budgets_isolation_policy'
    ) THEN
        CREATE POLICY "circle_budgets_isolation_policy" ON circle_budgets
            FOR ALL
            USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_isolation_policy'
    ) THEN
        CREATE POLICY "notifications_isolation_policy" ON notifications
            FOR ALL
            USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ai_insights_history' AND policyname = 'ai_insights_history_isolation_policy'
    ) THEN
        CREATE POLICY "ai_insights_history_isolation_policy" ON ai_insights_history
            FOR ALL
            USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
    END IF;
END
$$;
