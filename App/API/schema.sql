-- Cashflow app schema
-- Run once against Supabase via: psql "<session-pooler-connection-string>" -f schema.sql
-- Or paste into Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per categorized (description, date, amount) record.
-- scope='global' rows are shared across all users (user_id NULL).
-- scope='personal' rows belong to one user (personal overrides,
-- transfers, ambiguity placeholders that shouldn't generalize).
CREATE TABLE IF NOT EXISTS category_records (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    txn_date TEXT NOT NULL,
    amount TEXT NOT NULL,
    category TEXT NOT NULL,
    scope VARCHAR(10) NOT NULL CHECK (scope IN ('personal', 'global')),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT scope_user_consistency CHECK (
        (scope = 'global' AND user_id IS NULL) OR
        (scope = 'personal' AND user_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_category_records_lookup
    ON category_records (description, scope, user_id);

-- Substring-matchable merchant name -> category. Shared globally.
CREATE TABLE IF NOT EXISTS merchants (
    normalized_name TEXT PRIMARY KEY,
    category TEXT NOT NULL
);

-- User-facing, renamable spending categories. The 'MANUALLY CATEGORISE'
-- sentinel is deliberately NOT a row here - it's infrastructure (a
-- system state meaning "needs a human"), not a real category anyone
-- picks or renames, so it stays a hardcoded constant in the app code.
--
-- `color` is whatever's currently applied - changeable any time via the
-- in-app picker. `default_color` is the ORIGINAL colour for that
-- category - seeded identical to `color` here, and never touched by
-- ordinary recolouring. It only changes via the separate admin
-- setDefaultColorAdmin.py tool, and is what "reset to default" resets
-- `color` back to.
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_order INTEGER NOT NULL,
    color TEXT NOT NULL,
    default_color TEXT NOT NULL
);

INSERT INTO categories (name, display_order, color, default_color) VALUES
    ('Entertainment (Games)', 1, '#E07A3E', '#E07A3E'),
    ('Personal development (music,driving)', 2, '#3D8B5F', '#3D8B5F'),
    ('IT/Software', 3, '#9B3D8A', '#9B3D8A'),
    ('Sports/Fitness', 4, '#C4A227', '#C4A227'),
    ('Phone', 5, '#D94F4F', '#D94F4F'),
    ('Travel', 6, '#4FA8D9', '#4FA8D9'),
    ('Clothes', 7, '#7A5C3D', '#7A5C3D'),
    ('Households, medicines and stationary', 8, '#5C8A2E', '#5C8A2E'),
    ('Eating out', 9, '#D97AB8', '#D97AB8'),
    ('Groceries', 10, '#3D5C8A', '#3D5C8A'),
    ('Housing & Rent', 11, '#8A3D3D', '#8A3D3D'),
    ('Transfers', 12, '#4DBFBF', '#4DBFBF'),
    ('Income', 13, '#A67C52', '#A67C52')
ON CONFLICT (name) DO NOTHING;

-- Every parsed transaction a user has ever uploaded, so re-uploading
-- the same CSV is a no-op (see dedup_key + UNIQUE constraint) and
-- history survives across sessions/app restarts.
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    txn_date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT,
    dedup_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, dedup_key)
);

-- Every query in the app filters transactions by user_id, including
-- /charts/summary's aggregates - without this, Postgres has to scan the
-- WHOLE table, across every user combined, to find one user's rows.
-- Irrelevant at small scale, a permanent zero-downside thing to have in
-- place before the table has many users each with years of history.
CREATE INDEX IF NOT EXISTS idx_transactions_user_id
    ON transactions (user_id);

-- One row per accepted CSV FILE (not per transaction row inside it) -
-- powers the "you've uploaded N files" summary on the home screen. A
-- re-upload of the exact same file still adds a new row here (this
-- tracks upload EVENTS, not distinct files), matching what a user would
-- intuitively expect "how many times have I uploaded a file" to mean.
CREATE TABLE IF NOT EXISTS uploaded_files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id
    ON uploaded_files (user_id);