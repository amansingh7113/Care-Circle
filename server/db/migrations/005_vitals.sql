-- Blood Pressure Logs table
CREATE TABLE IF NOT EXISTS "BloodPressureLogs" (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    circle_id UUID REFERENCES "Circles"(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES "Users"(id) ON DELETE CASCADE,
    systolic INTEGER NOT NULL,
    diastolic INTEGER NOT NULL,
    pulse INTEGER,
    image_url TEXT,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS Policies
ALTER TABLE "BloodPressureLogs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle members can read vitals"
    ON "BloodPressureLogs" FOR SELECT
    USING (
        circle_id IN (
            SELECT circle_id FROM "CircleMembers" WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Circle members can insert vitals"
    ON "BloodPressureLogs" FOR INSERT
    WITH CHECK (
        circle_id IN (
            SELECT circle_id FROM "CircleMembers" WHERE user_id = auth.uid()
        )
    );
