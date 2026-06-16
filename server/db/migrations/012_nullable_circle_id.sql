-- Migration: 012_nullable_circle_id.sql
-- Allow users to exist without a circle (e.g. after being removed or before joining)
-- Also add phone and email for profile management

ALTER TABLE users ALTER COLUMN circle_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
