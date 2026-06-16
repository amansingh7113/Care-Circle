-- Migration: 011_missing_tables
-- Adds missing tables and columns identified during the hardening audit

CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access task comments in their circle"
ON task_comments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM tasks t
        JOIN circles c ON t.circle_id = c.id
        WHERE t.id = task_comments.task_id
        AND c.id IN (
            SELECT circle_id FROM users WHERE id = auth.uid()
        )
    )
);

CREATE TABLE IF NOT EXISTS step_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    step_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(circle_id, patient_id, date)
);

ALTER TABLE step_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access step logs in their circle"
ON step_logs
FOR ALL
USING (
    circle_id IN (
        SELECT circle_id FROM users WHERE id = auth.uid()
    )
);

-- Add missing columns to existing tables
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
