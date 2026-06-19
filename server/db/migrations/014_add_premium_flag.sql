-- Add premium flag to circles
ALTER TABLE circles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
