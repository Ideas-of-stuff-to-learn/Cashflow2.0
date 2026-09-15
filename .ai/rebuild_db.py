"""Rebuild .ai/knowledge.db from scratch. Run from repo root: python .ai/rebuild_db.py"""
import sqlite3, os

# Resolve path relative to this script's location (works regardless of cwd)
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge.db")
os.makedirs(os.path.dirname(db_path), exist_ok=True)

conn = sqlite3.connect(db_path)
c = conn.cursor()

# ── Schema ────────────────────────────────────────────────────────────────────

c.executescript("""
CREATE TABLE IF NOT EXISTS context_documents (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    path        TEXT NOT NULL,
    description TEXT,
    tags        TEXT,   -- comma-separated
    updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS files (
    id          INTEGER PRIMARY KEY,
    path        TEXT NOT NULL UNIQUE,
    language    TEXT,
    description TEXT,
    tags        TEXT
);

CREATE TABLE IF NOT EXISTS dependencies (
    id          INTEGER PRIMARY KEY,
    source      TEXT NOT NULL,
    relationship TEXT NOT NULL,  -- IMPORTS, CALLS, DEPENDS_ON, DUPLICATES
    target      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS constraints (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    severity    TEXT DEFAULT 'hard'  -- hard, behavioral, scope, security
);

CREATE TABLE IF NOT EXISTS decisions (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    area        TEXT   -- auth, database, pipeline, frontend, etc.
);

CREATE TABLE IF NOT EXISTS known_problems (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    area        TEXT,
    severity    TEXT DEFAULT 'medium'
);

CREATE TABLE IF NOT EXISTS failed_solutions (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    area        TEXT,
    lesson      TEXT
);

CREATE TABLE IF NOT EXISTS realignment (
    id                  INTEGER PRIMARY KEY,
    realignment_doc     TEXT,
    overview_doc        TEXT,
    architecture_doc    TEXT,
    constraints_doc     TEXT,
    current_task_doc    TEXT,
    dependencies_doc    TEXT,
    decisions_doc       TEXT,
    known_problems_doc  TEXT,
    failed_solutions_doc TEXT,
    handoff_doc         TEXT,
    git_doc             TEXT,
    notes               TEXT
);

CREATE TABLE IF NOT EXISTS git_configuration (
    id            INTEGER PRIMARY KEY,
    upstream      TEXT,
    base_branch   TEXT,
    auto_merge    INTEGER DEFAULT 0,
    branch_prefix TEXT,
    notes         TEXT
);
""")

# ── Context Documents ─────────────────────────────────────────────────────────

context_docs = [
    ("overview",          "context/overview.md",          "Project purpose, subsystems, tech stack, terminology",                   "overview,intro,stack"),
    ("architecture",      "context/architecture.md",      "Layers, data flows, component responsibilities, upload flow, chart flow","architecture,layers,flow,backend,frontend"),
    ("dependencies",      "context/dependencies.md",      "File-to-file dependencies, call chains, key file responsibility map",    "dependencies,imports,calls,files"),
    ("decisions",         "context/decisions.md",         "Engineering decisions with rationale, alternatives, tradeoffs",          "decisions,rationale,design"),
    ("constraints",       "context/constraints.md",       "Hard invariants, behavioral constraints, security rules",                "constraints,invariants,rules,security"),
    ("known-problems",    "context/known-problems.md",    "Known bugs, technical debt, fragile areas",                             "bugs,debt,problems,fragile"),
    ("failed-solutions",  "context/failed-solutions.md",  "Previously attempted approaches that failed and why",                   "failed,attempts,history,lessons"),
    ("current-task",      "context/current-task.md",      "Currently active task, state, next steps",                              "task,current,status"),
    ("verification",      "context/verification.md",      "Build, dev server, manual verification procedures",                     "verification,build,test"),
    ("handoff",           "context/handoff.md",           "Session handoff: recent changes, open work, notes for next session",     "handoff,session,recent"),
    ("realignment",       "context/realignment.md",       "Recovery map: how to reconstruct project understanding from scratch",    "realignment,recovery,onboarding"),
    ("gitContext",        "context/gitContext.md",         "Git repo URL, workflow rules, CI/CD summary",                           "git,workflow,ci,deploy"),
]

c.executemany(
    "INSERT OR REPLACE INTO context_documents (name, path, description, tags, updated_at) VALUES (?, ?, ?, ?, date('now'))",
    [(name, path, desc, tags) for name, path, desc, tags in context_docs]
)

# ── Key Source Files ──────────────────────────────────────────────────────────

files = [
    # Backend
    ("App/API/backend.py",                          "python",     "Flask app entrypoint, route registration",              "backend,entrypoint"),
    ("App/API/extensions.py",                       "python",     "Shared Flask/JWT/limiter instance (prevents circular imports)", "backend,shared"),
    ("App/API/database.py",                         "python",     "DB connection helpers",                                 "backend,database"),
    ("App/API/permissions.py",                      "python",     "@require_permission decorator, role/permission lookup",  "backend,auth,permissions"),
    ("App/API/cache.py",                            "python",     "Categorization cache tier",                             "backend,categorization"),
    ("App/API/schema.sql",                          "sql",        "Full Postgres schema with inline design-decision comments","database,schema"),
    ("App/API/categorise/pipeline.py",              "python",     "Categorization tier orchestration (5 tiers)",           "backend,categorization,pipeline"),
    ("App/API/categorise/exact_tier.py",            "python",     "Exact match tier against category_records",             "backend,categorization"),
    ("App/API/categorise/merchant_tier.py",         "python",     "Aho-Corasick merchant substring match",                 "backend,categorization"),
    ("App/API/categorise/similarity_tier.py",       "python",     "rapidfuzz similarity tier",                             "backend,categorization"),
    ("App/API/categorise/llm_tier/orchestrator.py", "python",     "Gemini LLM tier orchestration",                         "backend,categorization,llm"),
    ("App/API/matching/gemini.py",                  "python",     "Gemini API call wrapper",                               "backend,llm,gemini"),
    ("App/API/routes/auth.py",                      "python",     "Login, logout, token refresh, JWT revocation routes",   "backend,auth"),
    ("App/API/routes/uploads.py",                   "python",     "CSV/Excel upload, parse, dedup, trigger pipeline",      "backend,upload"),
    ("App/API/routes/charts.py",                    "python",     "Chart aggregation endpoint",                            "backend,charts"),
    ("App/API/routes/admin.py",                     "python",     "User/role/permission management, impersonation",        "backend,admin"),
    # Web frontend
    ("App/WebUI/src/AppContext.jsx",                "jsx",        "Web global state: transactions, categories, chart data, auth", "web,state,context"),
    ("App/WebUI/src/api.js",                        "js",         "fetch wrapper with client-side timeout (web auth via cookie)", "web,api,auth"),
    ("App/WebUI/src/components/Layout.jsx",         "jsx",        "Shell: 3-column grid header (left/title-center/Owner-right)", "web,layout,header"),
    ("App/WebUI/src/styles/Layout.css",             "css",        "Layout shell styles including app-header grid",         "web,layout,css"),
    ("App/WebUI/src/screens/ContentsScreen.jsx",    "jsx",        "Transaction table screen (virtualized, sidebar layout)", "web,contents,transactions"),
    ("App/WebUI/src/styles/contentsStyles.css",     "css",        "cs-* namespace styles for ContentsScreen",              "web,contents,css"),
    ("App/WebUI/src/components/dashboard/FilterPane.jsx", "jsx",  "Category checkboxes + drag-to-reorder (HTML5 DnD)",     "web,dashboard,filter"),
    ("App/WebUI/src/utils/charts/buildStackData.jsx","jsx",       "Chart segment visibility/filtering (empty set = nothing)", "web,charts,filter"),
    ("App/WebUI/src/config/popupChartConfig.jsx",   "jsx",        "Chart popup placement + interaction mode (fully wired)", "web,charts,popup,config"),
    ("App/WebUI/src/customHooks/contentsscreen/useContentsData.jsx", "jsx", "ContentsScreen data hook aggregator", "web,contents,hooks"),
    # Mobile
    ("App/NativeAppUI/AppContext.js",               "js",         "RN global state (mirrors web AppContext)",               "rn,state,context"),
    ("App/NativeAppUI/config/popupChartConfig.js",  "js",         "RN chart popup config (vocabulary only — NOT wired into ChartWindowSection.js)", "rn,charts,popup,config"),
    ("App/NativeAppUI/AGENTS.md",                   "markdown",   "Expo SDK 54 warning — read before any Expo API work",   "rn,expo,warning"),
    # Shared
    ("App/shared/checkingName.js",                  "js",         "NEEDS_MANUAL_REVIEW sentinel constant (canonical source)", "shared,sentinel,categorization"),
    ("App/WebUI/src/checkingName.jsx",              "jsx",        "NEEDS_MANUAL_REVIEW sentinel (web duplicate — must match shared)", "web,sentinel"),
    ("App/NativeAppUI/checkingName.js",             "js",         "NEEDS_MANUAL_REVIEW sentinel (RN duplicate — must match shared)", "rn,sentinel"),
    # Local dev
    ("start-all.bat",                               "batch",      "Local dev launcher: LAN IP detection, env generation, multi-process start", "dev,launch"),
]

c.executemany(
    "INSERT OR REPLACE INTO files (path, language, description, tags) VALUES (?, ?, ?, ?)",
    files
)

# ── Dependencies ──────────────────────────────────────────────────────────────

deps = [
    # Pipeline
    ("App/API/routes/uploads.py",                   "CALLS",      "App/API/categorise/pipeline.py"),
    ("App/API/categorise/pipeline.py",              "CALLS",      "App/API/categorise/exact_tier.py"),
    ("App/API/categorise/pipeline.py",              "CALLS",      "App/API/categorise/merchant_tier.py"),
    ("App/API/categorise/pipeline.py",              "CALLS",      "App/API/categorise/similarity_tier.py"),
    ("App/API/categorise/pipeline.py",              "CALLS",      "App/API/categorise/llm_tier/orchestrator.py"),
    ("App/API/categorise/merchant_tier.py",         "CALLS",      "App/API/matching/merchants/matcher.py"),
    ("App/API/categorise/llm_tier/orchestrator.py", "CALLS",      "App/API/matching/gemini.py"),
    # Auth
    ("App/API/routes/auth.py",                      "IMPORTS",    "App/API/extensions.py"),
    ("App/API/permissions.py",                      "IMPORTS",    "App/API/extensions.py"),
    ("App/WebUI/src/api.js",                        "CALLS",      "App/API/routes/auth.py"),
    ("App/NativeAppUI/api.jsx",                     "CALLS",      "App/API/routes/auth.py"),
    # Web state
    ("App/WebUI/src/AppContext.jsx",                "CALLS",      "App/WebUI/src/api.js"),
    ("App/WebUI/src/screens/ContentsScreen.jsx",    "IMPORTS",    "App/WebUI/src/customHooks/contentsscreen/useContentsData.jsx"),
    ("App/WebUI/src/screens/ContentsScreen.jsx",    "IMPORTS",    "App/WebUI/src/components/Layout.jsx"),
    ("App/WebUI/src/utils/charts/buildStackData.jsx","READS",     "App/WebUI/src/AppContext.jsx"),
    ("App/WebUI/src/config/popupChartConfig.jsx",   "IMPORTED_BY","App/WebUI/src/components/dashboard/"),
    # Sentinels (triplication)
    ("App/WebUI/src/checkingName.jsx",              "DUPLICATES", "App/shared/checkingName.js"),
    ("App/NativeAppUI/checkingName.js",             "DUPLICATES", "App/shared/checkingName.js"),
    # Layout
    ("App/WebUI/src/components/Layout.jsx",         "IMPORTS",    "App/WebUI/src/components/RoleBadge.jsx"),
    ("App/WebUI/src/screens/ContentsScreen.jsx",    "RENDERED_BY","App/WebUI/src/components/Layout.jsx"),
]

c.executemany(
    "INSERT OR REPLACE INTO dependencies (source, relationship, target) VALUES (?, ?, ?)",
    deps
)

# ── Constraints ───────────────────────────────────────────────────────────────

constraints_data = [
    ("Owner badge always top-right",      "Layout.jsx 3-col grid header enforces this. Never reposition RoleBadge.", "hard"),
    ("No overview.html unless told",      "context/overview.html is client-facing only. Do not read/edit without explicit instruction.", "hard"),
    ("No hand-edit generated configs",    "App/.env and App/NativeAppUI/generatedLocalConfig.js are overwritten on each start-all.bat run.", "hard"),
    ("NEEDS_MANUAL_REVIEW sentinel sync", "Must be identical in App/shared/checkingName.js, App/NativeAppUI/checkingName.js, App/WebUI/src/checkingName.jsx", "hard"),
    ("Admin CLI targets production",      "BASE_URL in adminClI/adminCliCommon.py is hardcoded to production. Change carefully.", "hard"),
    ("No automated tests",                "No test suite exists. Verification is build + visual only.", "scope"),
    ("No ORM — hand-applied SQL",         "Schema changes go directly to Supabase. No migration framework or rollback.", "scope"),
    ("Re-upload must be no-op",           "dedup_key mechanism must not be broken. Re-uploading same CSV must be safe.", "behavioral"),
    ("Manual review: single flush",       "Picks batched client-side; one API call on completion. Not per-item.", "behavioral"),
    ("Empty selectedCategories = nothing","buildStackData must show nothing when filter set is empty. Do not revert.", "behavioral"),
    ("No auto-merge",                     "Never auto-merge PRs. Owner manually merges.", "scope"),
    ("Web auth = httpOnly cookie only",   "JWT must not be accessible to JS on web. No localStorage auth.", "security"),
    ("Expo SDK 54 warning",               "Check docs.expo.dev/versions/v54.0.0/ before any Expo API work in NativeAppUI.", "hard"),
]

c.executemany(
    "INSERT OR REPLACE INTO constraints (title, description, severity) VALUES (?, ?, ?)",
    constraints_data
)

# ── Known Problems ────────────────────────────────────────────────────────────

problems = [
    ("No automated tests",              "No unit/integration tests in backend, web, or RN.", "cross-cutting", "high"),
    ("NEEDS_MANUAL_REVIEW triplicated", "Sentinel defined in 3 files; no sync mechanism.", "cross-cutting", "medium"),
    ("RN popup not config-driven",      "popupChartConfig.js exists but ChartWindowSection.js has hardcoded popup.", "rn", "medium"),
    ("AdminCLI hardcoded to prod",      "BASE_URL in adminCliCommon.py always hits production.", "admin-cli", "medium"),
    ("COLOR_PALETTE triplication",      "adminCliCommon.py may drift from web/RN chartUtils COLOR_PALETTE.", "cross-cutting", "low"),
    ("No ORM/migrations",               "Schema changes are hand-applied SQL, no rollback.", "backend", "medium"),
    ("FilterPane RN no live animation", "PanResponder reorders on release, not animated under finger.", "rn", "low"),
    ("Root README is placeholder",      "README.md contains only '# Cashflow2.0'.", "docs", "low"),
    ("Scratch CSVs in API dir",         "App/API/categorised.csv and TransactionHistory.csv are scratch data, not fixtures.", "backend", "low"),
]

c.executemany(
    "INSERT OR REPLACE INTO known_problems (title, description, area, severity) VALUES (?, ?, ?, ?)",
    problems
)

# ── Failed Solutions ──────────────────────────────────────────────────────────

failures = [
    ("JWT without revocation",           "Tokens stayed valid after logout.", "auth", "Always check revoked_tokens table on every authenticated request."),
    ("Empty filter = show all",          "deselecting all categories showed everything instead of nothing.", "charts", "Empty set must mean nothing. Do not add 'show all if empty' guard to buildStackData."),
    ("Per-item manual review API calls", "N picks = N slow round trips, partial-state risk.", "manual-review", "Batch picks client-side; single flush on completion."),
    ("Per-item Put in Other loop",       "O(n) SQL updates instead of one.", "backend", "Single UPDATE WHERE category = NEEDS_MANUAL_REVIEW."),
    ("overflow-x:auto + overflow-y:visible", "CSS spec forces overflow-y to auto too, causing double scrollbar.", "css", "Never pair overflow-x:auto with expectation that overflow-y stays visible."),
    ("Two FilterPane components",        "Separate category list + stack-order list = duplicated state and UI.", "web", "Merge into one combined FilterPane component."),
    ("localStorage minimize state",      "Stale key caused FilterPane to initialize hidden after collapse button was removed.", "web", "Remove localStorage persistence when removing the UI control that writes it."),
    ("cs-topbar inside ContentsScreen",  "Two header rows; Owner badge appeared top-left.", "web", "Move back btn + title into Layout.jsx header. Use 3-col grid. Remove cs-topbar."),
]

c.executemany(
    "INSERT OR REPLACE INTO failed_solutions (title, description, area, lesson) VALUES (?, ?, ?, ?)",
    failures
)

# ── Git Configuration ─────────────────────────────────────────────────────────

c.execute("""
INSERT OR REPLACE INTO git_configuration (id, upstream, base_branch, auto_merge, branch_prefix, notes)
VALUES (1, 'https://github.com/Ideas-of-stuff-to-learn/Cashflow2.0.git', 'main', 0, 'ai/',
'Direct to main by default. PR only if owner requests. Bot commits (Backup log, Keep-alive ping) appear in git log — ignore them.')
""")

# ── Realignment Record ────────────────────────────────────────────────────────

c.execute("""
INSERT OR REPLACE INTO realignment (
    id, realignment_doc, overview_doc, architecture_doc, constraints_doc,
    current_task_doc, dependencies_doc, decisions_doc, known_problems_doc,
    failed_solutions_doc, handoff_doc, git_doc, notes
) VALUES (
    1,
    'context/realignment.md',
    'context/overview.md',
    'context/architecture.md',
    'context/constraints.md',
    'context/current-task.md',
    'context/dependencies.md',
    'context/decisions.md',
    'context/known-problems.md',
    'context/failed-solutions.md',
    'context/handoff.md',
    'context/gitContext.md',
    'Load realignment.md first. Then overview → architecture → constraints → current-task. Load others only as needed for the specific task.'
)
""")

conn.commit()
conn.close()
print("knowledge.db built successfully.")

# Print a quick summary
conn2 = sqlite3.connect(db_path)
c2 = conn2.cursor()
for table in ["context_documents","files","dependencies","constraints","known_problems","failed_solutions"]:
    count = c2.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"  {table}: {count} rows")
conn2.close()
