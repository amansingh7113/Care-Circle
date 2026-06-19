-- 016_nutrition_logs.sql
CREATE TABLE IF NOT EXISTS nutrition_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    meal_type TEXT,
    food_items TEXT,
    calories INT DEFAULT 0,
    sugar_g INT DEFAULT 0,
    sodium_mg INT DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    date DATE DEFAULT CURRENT_DATE
);

-- Enable RLS
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view nutrition logs for their circle"
ON nutrition_logs FOR SELECT
USING (
    circle_id IN (
        SELECT circle_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert nutrition logs for their circle"
ON nutrition_logs FOR INSERT
WITH CHECK (
    circle_id IN (
        SELECT circle_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can delete their circle's nutrition logs"
ON nutrition_logs FOR DELETE
USING (
    circle_id IN (
        SELECT circle_id FROM users WHERE id = auth.uid()
    )
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_nutrition_circle_date ON nutrition_logs(circle_id, date);
