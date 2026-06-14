-- Add visit_id to documents
ALTER TABLE documents 
ADD COLUMN visit_id UUID REFERENCES doctor_visits(id) ON DELETE SET NULL;
