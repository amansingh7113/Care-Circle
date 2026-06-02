-- Create Circles Table
CREATE TABLE circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY, -- Intended to reference auth.users(id)
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Caregiver', 'Viewer', 'Patient')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Medicines Table
CREATE TABLE medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Medicine Dose Logs Table
CREATE TABLE medicine_dose_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    taken_at TIMESTAMPTZ,
    status TEXT NOT NULL,
    logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Tasks Table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'TODO',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_dose_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for circle_id isolation

-- Circles Policy
CREATE POLICY "circle_isolation_policy" ON circles
    FOR ALL
    USING (id = (SELECT circle_id FROM users WHERE id = auth.uid()));

-- Users Policy
CREATE POLICY "user_isolation_policy" ON users
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));

-- Medicines Policy
CREATE POLICY "medicine_isolation_policy" ON medicines
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));

-- Medicine Dose Logs Policy
CREATE POLICY "dose_log_isolation_policy" ON medicine_dose_logs
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));

-- Tasks Policy
CREATE POLICY "task_isolation_policy" ON tasks
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
