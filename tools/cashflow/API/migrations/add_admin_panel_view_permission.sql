-- Migration: add admin.panel.view permission
-- Run once in Supabase SQL editor.
-- This permission gates access to the standalone admin panel UI.
-- Deliberately NOT bundled into the 'admin' role by default — grant it
-- explicitly via the admin panel's Roles screen or a per-user override.
-- Owner bypasses all permission checks unconditionally (see permissions.py).

INSERT INTO permissions (key, description)
VALUES ('admin.panel.view', 'Access the standalone admin panel web UI')
ON CONFLICT (key) DO NOTHING;
