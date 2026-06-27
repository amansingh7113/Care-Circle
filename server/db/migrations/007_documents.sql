-- Create Documents Table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Prescription', 'Reports', 'Medicines', 'Bills')),
    file_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Documents Policy
CREATE POLICY "documents_isolation_policy" ON documents
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));

-- Storage Bucket (requires pg_crypto or similar, but storage API is better used, 
-- we will use SQL to insert if possible, but usually Supabase requires storage API or dashboard. 
-- However, we can try to insert into storage.buckets and storage.objects)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false) 
ON CONFLICT (id) DO UPDATE SET public = false;

