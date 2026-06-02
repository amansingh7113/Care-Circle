CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE circle_budgets (
    circle_id UUID PRIMARY KEY REFERENCES circles(id) ON DELETE CASCADE,
    monthly_limit NUMERIC(12,2) DEFAULT 10000.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage expenses in their circle"
ON expenses
FOR ALL
USING (circle_id = get_user_circle_id());

CREATE POLICY "Users can manage budgets in their circle"
ON circle_budgets
FOR ALL
USING (circle_id = get_user_circle_id());
