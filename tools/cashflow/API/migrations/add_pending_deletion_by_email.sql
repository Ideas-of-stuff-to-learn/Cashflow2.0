-- Migration: add pending_deletion_by_email to roles and categories
-- Run manually in Supabase SQL editor.
-- Stores the email of the admin who scheduled the deletion so the daily cron
-- can email them a confirmation when the hard-delete fires 48 hours later.

ALTER TABLE roles       ADD COLUMN IF NOT EXISTS pending_deletion_by_email TEXT;
ALTER TABLE categories  ADD COLUMN IF NOT EXISTS pending_deletion_by_email TEXT;
