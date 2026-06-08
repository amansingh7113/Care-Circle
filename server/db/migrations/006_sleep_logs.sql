-- Sleep Logs table
CREATE TABLE IF NOT EXISTS sleep_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sleep_start TIMESTAMPTZ NOT NULL,
    sleep_end TIMESTAMPTZ,
    duration_minutes INTEGER,
    is_auto_detected BOOLEAN DEFAULT false,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sleep_logs_isolation_policy" ON sleep_logs
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
