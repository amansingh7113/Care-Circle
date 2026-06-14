-- Create AI Insights History Table
CREATE TABLE ai_insights_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    insight_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE ai_insights_history ENABLE ROW LEVEL SECURITY;

-- AI Insights Isolation Policy
CREATE POLICY "ai_insights_isolation_policy" ON ai_insights_history
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
