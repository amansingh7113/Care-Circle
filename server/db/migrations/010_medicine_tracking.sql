-- Add new columns to medicines table
ALTER TABLE medicines 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS stock_quantity INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS refill_alert_threshold INT NOT NULL DEFAULT 5;

-- Create index for active medicines
CREATE INDEX IF NOT EXISTS idx_active_medicines ON medicines (circle_id) WHERE is_archived = false;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    priority TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notifications Policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'notifications' AND policyname = 'notification_isolation_policy'
    ) THEN
        CREATE POLICY "notification_isolation_policy" ON notifications
            FOR ALL
            USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
    END IF;
END
$$;
