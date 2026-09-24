-- Soft-delete grace period for admin-initiated role and category deletions.
-- When an admin schedules a deletion, pending_deletion_at is set to NOW().
-- A daily GitHub Actions job hard-deletes rows where pending_deletion_at
-- is older than 48 hours and sends a confirmation email.
-- Cancelling before 48 hours clears pending_deletion_at back to NULL.

ALTER TABLE roles       ADD COLUMN IF NOT EXISTS pending_deletion_at TIMESTAMPTZ;
ALTER TABLE categories  ADD COLUMN IF NOT EXISTS pending_deletion_at TIMESTAMPTZ;
