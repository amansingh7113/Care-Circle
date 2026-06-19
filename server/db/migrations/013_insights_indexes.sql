-- Add indexes to optimize insights processing and heartbeat queries

-- Index for fetching recent blood pressure logs by circle_id
CREATE INDEX IF NOT EXISTS idx_bp_logs_circle_logged_at ON blood_pressure_logs(circle_id, logged_at);

-- Index for fetching recent medicine dose logs by circle_id
CREATE INDEX IF NOT EXISTS idx_med_dose_logs_circle_taken_at ON medicine_dose_logs(circle_id, taken_at);

-- Index for fetching the latest heartbeat from ai_insights_history
CREATE INDEX IF NOT EXISTS idx_ai_insights_circle_prescription_created ON ai_insights_history(circle_id, prescription_id, created_at DESC);
