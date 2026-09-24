-- Migration: add users.unlock permission and grant to admin role
-- Run once in Supabase SQL editor.

-- 1. Insert the permission key (idempotent)
INSERT INTO permissions (key, description)
VALUES ('users.unlock', 'Unlock a user account: clear login lockout and email rate-limit counters')
ON CONFLICT (key) DO NOTHING;

-- 2. Grant it to the admin role (and any role at or above admin level)
--    Owner bypasses all checks unconditionally (hardcoded in permissions.py),
--    so only admin needs an explicit row here.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE p.key = 'users.unlock'
  AND r.name IN ('admin')
ON CONFLICT DO NOTHING;
