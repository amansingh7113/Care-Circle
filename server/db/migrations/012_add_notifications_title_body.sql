-- Migration: 012_add_notifications_title_body
-- Adds title and body columns to notifications table to support emergency SOS, refill alerts, and missed dose alerts

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
