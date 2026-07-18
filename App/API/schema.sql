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

-- =====================================================================
-- Permission system
-- =====================================================================
-- Replaces the old hardcoded "is your username literally the string
-- 'admin'?" check that used to be duplicated inline in every
-- admin-only endpoint in backend.py. Three pieces:
--
--   roles              - named tiers (owner/admin/user, extensible)
--   permissions        - master list of fine-grained action keys
--   role_permissions   - which permissions each role bundles by default
--   user_permission_overrides - per-PERSON exceptions on top of their role
--
-- `level` on roles is a plain integer, higher = more senior. It's used
-- for hierarchy GUARDS at assignment time (e.g. "you can't promote
-- someone to your own level or above"), not for the permission check
-- itself - the permission check only ever asks "does this specific
-- key apply to this user," never "is this role high enough."
--
-- The OWNER role is a hard ceiling, deliberately NOT implemented by
-- seeding every permission row against it. See user_has_permission()
-- in permissions.py: a user whose role is literally named 'owner'
-- passes every check unconditionally, regardless of what rows exist
-- in role_permissions. This means a permission added months from now,
-- that nobody remembered to explicitly grant to 'owner', still can't
-- accidentally lock the owner out of their own app - the ceiling is
-- structural, not a maintained list.
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per distinct gate point in the app. `key` is what backend.py's
-- @require_permission(...) decorator and the CLI/admin-panel checklists
-- both refer to - think of this table as the single canonical list of
-- "every distinct thing you could possibly be allowed or forbidden to
-- do." Adding a brand new gated feature later means one INSERT here
-- plus wiring the decorator onto its route - no code changes needed
-- anywhere that already reads this table generically (CLI pickers,
-- /admin/permissions).
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL
);

-- Which permissions a ROLE bundles by default. A user's role_id is
-- what pulls this in - see get_user_role_and_permissions() in
-- permissions.py.
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Per-PERSON exceptions, layered on top of whatever their role already
-- gives them. granted=true grants one extra permission beyond the
-- role; granted=false explicitly revokes one the role would otherwise
-- give - useful for "give this one admin everything except category
-- deletion" without inventing a whole new role just for that one
-- person. Deleting the row (rather than setting granted) returns that
-- permission to "whatever the role alone says" - see
-- clear_user_permission_override() in permissions.py.
CREATE TABLE IF NOT EXISTS user_permission_overrides (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL,
    PRIMARY KEY (user_id, permission_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);

INSERT INTO roles (name, level) VALUES
    ('owner', 100),
    ('admin', 50),
    ('user', 0)
ON CONFLICT (name) DO NOTHING;

-- Every permission key the app currently checks anywhere. The
-- categories.* keys are an exact 1:1 replacement for what the old
-- hardcoded username=='admin' check used to gate - no behavior change
-- for the existing category admin tools, just a real table backing it
-- instead of a string comparison. The users.*/roles.* keys are new -
-- they gate the permission-management system itself.
INSERT INTO permissions (key, description) VALUES
    ('categories.create', 'Add a new category'),
    ('categories.rename', 'Rename an existing category'),
    ('categories.recolor', 'Change a category''s current colour'),
    ('categories.set_default_color', 'Change a category''s default colour'),
    ('categories.combine', 'Merge two or more categories into one'),
    ('categories.delete', 'Delete a category'),
    ('users.view', 'List every user and their assigned role'),
    ('users.assign_role', 'Change which role a user has'),
    ('users.manage_permissions', 'Grant or revoke individual permission overrides for a user'),
    ('roles.view', 'List every role and the permissions it bundles'),
    ('roles.manage', 'Create, edit, or delete roles and their permission bundles')
ON CONFLICT (key) DO NOTHING;

-- Default bundle for the 'admin' role - originally exactly the set of
-- actions the old hardcoded check used to gate (categories.*), plus
-- four direct account-management actions (users.create/edit/delete/
-- impersonate) added afterward - see the block below. Deliberately
-- still does NOT include users.view/users.assign_role/
-- users.manage_permissions or either roles.* permission - managing
-- other people's ROLES and PERMISSIONS (as opposed to their account
-- itself) stays owner-only unless explicitly granted via a custom
-- role or per-user override, not a silent side effect of being
-- "admin."
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.key IN (
    'categories.create', 'categories.rename', 'categories.recolor',
    'categories.set_default_color', 'categories.combine', 'categories.delete'
  )
ON CONFLICT DO NOTHING;

-- Added after the initial round: direct account-lifecycle actions
-- (create/edit/delete an account, or borrow its session) for
-- admin-and-up, per explicit request. These are distinct from the
-- users.*/roles.* keys above (which govern managing ROLES and
-- PERMISSIONS, and remain owner-only by default) - these four act on
-- the account itself.
INSERT INTO permissions (key, description) VALUES
    ('users.create', 'Create a new user account directly, without them signing up themselves'),
    ('users.edit', 'Edit a user''s username and/or password'),
    ('users.delete', 'Delete a user account (cascades to their transactions, uploads, and personal category data)'),
    ('users.impersonate', 'Generate a valid login session for another user''s account without their password')
ON CONFLICT (key) DO NOTHING;

-- Bundled into 'admin' by default, unlike users.view/assign_role/
-- manage_permissions/roles.* above - see this block's own comment for
-- why account-lifecycle actions and role/permission-management
-- actions are treated differently.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.key IN ('users.create', 'users.edit', 'users.delete', 'users.impersonate')
ON CONFLICT DO NOTHING;

-- ONE-TIME: renames the pre-existing account (username 'admin') to
-- 'owner', so the account itself isn't confusingly named the same
-- thing as the separate 'admin' ROLE this migration also creates below
-- (level 50, one tier under owner) - two different concepts that
-- happened to share a name before this round. Only matches a row that
-- still has the old username, so it's a no-op on every run after the
-- first (there's nothing left named 'admin' to match).


-- One-time backfill for accounts that existed before role_id did. The
-- pre-existing single admin account (now renamed to 'owner', see the
-- UPDATE directly above) becomes the first owner; everyone else
-- defaults to the plain 'user' role. Both UPDATEs only touch rows
-- where role_id IS NULL, so this is safe to run again on every deploy
-- without re-clobbering a role that's since been deliberately changed
-- via the admin tools.
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'owner')
    WHERE username = 'owner' AND role_id IS NULL;
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'user')
    WHERE role_id IS NULL;