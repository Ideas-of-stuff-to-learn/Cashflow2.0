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

-- Kept in sync with the LIVE category state (as of the admin tools'
-- rename/combine/add/delete history) rather than the original launch
-- set. This matters more than it might look: ON CONFLICT (name) DO
-- NOTHING only skips a row whose NAME already exists - it does nothing
-- to stop a stale name that's since been renamed/combined/deleted away
-- from getting silently re-inserted as a brand new row on the next
-- schema.sql run (fresh deploy, new environment, DB recreation). The
-- original seed had exactly this problem: 'Entertainment (Games)' (renamed
-- since), 'Households, medicines and stationary' + 'Groceries' (combined
-- into one since), and 'Housing & Rent' + 'Transfers' (gone entirely)
-- would all have come back from the dead alongside the real, current
-- categories on the next fresh install.
--
-- color/default_color both reflect CURRENT values - same convention
-- every other category-creation path in this app already follows
-- (default_color = color at creation time, see create_category() in
-- backend.py). A handful of these have been actively recoloured away
-- from their original launch palette (Entertainment, IT/Software,
-- Sports/Fitness, Phone, Groceries and Households, Other) - this
-- reseed treats that recolouring as the new baseline, not the old
-- launch colours. "Reset to default" on a fresh install of one of
-- those will correctly be a no-op until recoloured again from here.
INSERT INTO categories (name, display_order, color, default_color) VALUES
    ('Entertainment (Movies,Games)', 1, '#e03e48', '#e03e48'),
    ('Personal development (music,driving)', 2, '#3D8B5F', '#3D8B5F'),
    ('IT/Software', 3, '#9f939d', '#9f939d'),
    ('Sports/Fitness', 4, '#0be40e', '#0be40e'),
    ('Phone', 5, '#d8da1d', '#d8da1d'),
    ('Travel', 6, '#4FA8D9', '#4FA8D9'),
    ('Clothes', 7, '#7A5C3D', '#7A5C3D'),
    ('Groceries and Households (medicine & stationary)', 8, '#eada18', '#eada18'),
    ('Eating out', 9, '#D97AB8', '#D97AB8'),
    ('Accomodation & Bills', 10, '#8A3D3D', '#8A3D3D'),
    ('Other', 11, '#bf4db1', '#bf4db1'),
    ('Income', 12, '#A67C52', '#A67C52'),
    ('Trading and investments', 13, '#4FA8D9', '#4FA8D9')
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

-- One row per CSV file that actually contributed at least one
-- genuinely new transaction (not per transaction row inside it, and
-- not per file merely accepted) - powers the "you've uploaded N files"
-- summary on the home screen. An exact re-upload of a file already on
-- record, or a multi-month file whose rows turn out to already exist,
-- contributes nothing new and does NOT add a row here - see the
-- post-dedup novelty check in /api/parse-csv (backend.py).
CREATE TABLE IF NOT EXISTS uploaded_files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id
    ON uploaded_files (user_id);