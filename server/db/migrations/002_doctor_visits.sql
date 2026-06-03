CREATE TABLE doctor_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    doctor_name VARCHAR(255) NOT NULL,
    visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    notes TEXT,
    attachment_urls TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE doctor_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their circle's doctor visits"
    ON doctor_visits
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
