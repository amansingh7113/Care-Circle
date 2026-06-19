CREATE TABLE IF NOT EXISTS hydration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    amount_ml INT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hydration_logs ENABLE ROW LEVEL SECURITY;

-- Hydration Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'hydration_logs' AND policyname = 'hydration_isolation_policy'
    ) THEN
        CREATE POLICY "hydration_isolation_policy" ON hydration_logs
            FOR ALL
            USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
    END IF;
END
$$;

-- Create index for quick daily lookups
CREATE INDEX IF NOT EXISTS idx_hydration_circle_date ON hydration_logs (circle_id, date);
