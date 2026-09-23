"""Rebuild .ai/knowledge.db from scratch. Run from repo root: python .ai/rebuild_db.py"""
import sqlite3, os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge.db")
os.makedirs(os.path.dirname(db_path), exist_ok=True)

conn = sqlite3.connect(db_path)
c = conn.cursor()

c.executescript("""
CREATE TABLE IF NOT EXISTS context_documents (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    path        TEXT NOT NULL,
    description TEXT,
    tags        TEXT,
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
    id           INTEGER PRIMARY KEY,
    source       TEXT NOT NULL,
    relationship TEXT NOT NULL,
    target       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS constraints (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    severity    TEXT DEFAULT 'hard'
);
CREATE TABLE IF NOT EXISTS decisions (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL UNIQUE,
    description TEXT,
    area        TEXT
);
CREATE TABLE IF NOT EXISTS known_problems (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL UNIQUE,
    description TEXT,
    area        TEXT,
    severity    TEXT DEFAULT 'medium'
);
CREATE TABLE IF NOT EXISTS failed_solutions (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL UNIQUE,
    description TEXT,
    area        TEXT,
    lesson      TEXT
);
CREATE TABLE IF NOT EXISTS realignment (
    id                   INTEGER PRIMARY KEY,
    realignment_doc      TEXT,
    overview_doc         TEXT,
    architecture_doc     TEXT,
    constraints_doc      TEXT,
    current_task_doc     TEXT,
    dependencies_doc     TEXT,
    decisions_doc        TEXT,
    known_problems_doc   TEXT,
    failed_solutions_doc TEXT,
    handoff_doc          TEXT,
    git_doc              TEXT,
    notes                TEXT
);
DROP TABLE IF EXISTS git_configuration;
CREATE TABLE git_configuration (
    id            INTEGER PRIMARY KEY,
    upstream      TEXT,
    base_branch   TEXT,
    auto_merge    INTEGER DEFAULT 0,
    branch_prefix TEXT,
    trigger_word  TEXT,
    workflow      TEXT,
    notes         TEXT
);
""")

# ── Context Documents ─────────────────────────────────────────────────────────
context_docs = [
    ("overview",         "context/overview.md",         "Project purpose, subsystems, tech stack, terminology",                    "overview,intro,stack"),
    ("architecture",     "context/architecture.md",     "Layers, data flows, component responsibilities, routing, upload flow",    "architecture,layers,flow,backend,frontend,routing"),
    ("dependencies",     "context/dependencies.md",     "File-to-file dependencies, call chains, key file responsibility map",     "dependencies,imports,calls,files"),
    ("decisions",        "context/decisions.md",        "Engineering decisions with rationale, alternatives, tradeoffs",           "decisions,rationale,design"),
    ("constraints",      "context/constraints.md",      "Hard invariants, behavioral constraints, security rules",                 "constraints,invariants,rules,security"),
    ("known-problems",   "context/known-problems.md",   "Known bugs, technical debt, fragile areas",                              "bugs,debt,problems,fragile"),
    ("failed-solutions", "context/failed-solutions.md", "Previously attempted approaches that failed and why",                    "failed,attempts,history,lessons"),
    ("current-task",     "context/current-task.md",     "Currently active task, state, next steps",                               "task,current,status"),
    ("verification",     "context/verification.md",     "Build, dev server, manual verification procedures",                      "verification,build,test"),
    ("handoff",          "context/handoff.md",          "Session handoff: recent changes, open work, notes for next session",      "handoff,session,recent"),
    ("realignment",      "context/realignment.md",      "Recovery map: how to reconstruct project understanding from scratch",     "realignment,recovery,onboarding"),
    ("gitContext",       "context/gitContext.md",        "Git repo URL, workflow rules, CI/CD summary",                            "git,workflow,ci,deploy"),
    ("revert-state",     "context/revert-state.md",      "Safe-point commit hashes recorded before each task for instant revert",   "git,revert,safety"),
    ("savings-log",      "context/savings-log.md",       "Running log of sessions using the intelligence system vs cold-scanning",  "meta,savings,log"),
    ("session-snapshot", "context/session-snapshot.md",  "Most recent pre-compact session snapshot — active task, files in flight, open decisions, open questions, what was about to happen next. Highest-priority recovery doc after a context compact.", "session,snapshot,recovery,compact,priority"),
]
c.executemany(
    "INSERT OR REPLACE INTO context_documents (name, path, description, tags, updated_at) VALUES (?, ?, ?, ?, date('now'))",
    [(name, path, desc, tags) for name, path, desc, tags in context_docs]
)

# ── Source Files ──────────────────────────────────────────────────────────────
# Format: (path, language, description, tags)
files = [

    # ── Backend ───────────────────────────────────────────────────────────────
    ("App/API/backend.py",                                "python", "Flask app entrypoint; imports extensions + all route blueprints", "backend,entrypoint"),
    ("App/API/extensions.py",                             "python", "Shared Flask app instance, JWT manager, rate limiter — imported by all modules to avoid circular imports", "backend,shared,jwt"),
    ("App/API/database.py",                               "python", "Postgres connection helpers (psycopg2)", "backend,database"),
    ("App/API/shared.py",                                 "python", "Cross-route helpers used by multiple route modules", "backend,shared"),
    ("App/API/permissions.py",                            "python", "@require_permission decorator; role/permission lookup against DB", "backend,auth,permissions"),
    ("App/API/cache.py",                                  "python", "Categorization cache tier logic", "backend,categorization,cache"),
    ("App/API/checkingName.py",                           "python", "NEEDS_MANUAL_REVIEW + NOT_YET_CATEGORISED sentinel constants (Python side)", "backend,sentinel,categorization"),
    ("App/API/schema.sql",                                "sql",    "Full annotated Postgres schema with inline design-decision comments", "database,schema"),
    # Categorization pipeline
    ("App/API/categorise/pipeline.py",                    "python", "Categorization tier orchestration — runs tiers in order, returns first match", "backend,categorization,pipeline"),
    ("App/API/categorise/exact_tier.py",                  "python", "Tier 1: exact match against category_records (user's own prior categorizations)", "backend,categorization"),
    ("App/API/categorise/merchant_tier.py",               "python", "Tier 2: Aho-Corasick merchant substring match", "backend,categorization"),
    ("App/API/categorise/similarity_tier.py",             "python", "Tier 3: rapidfuzz fuzzy similarity scoring", "backend,categorization"),
    ("App/API/categorise/helpers.py",                     "python", "Shared helpers for categorization tiers", "backend,categorization"),
    ("App/API/categorise/llm_tier/orchestrator.py",       "python", "Tier 4: Gemini LLM tier orchestration — batching, retry, empty-result handling", "backend,categorization,llm"),
    ("App/API/categorise/llm_tier/batch_recheck.py",      "python", "LLM tier: recheck logic for batch results", "backend,categorization,llm"),
    ("App/API/categorise/llm_tier/empty_result.py",       "python", "LLM tier: handle Gemini returning no usable result", "backend,categorization,llm"),
    ("App/API/categorise/llm_tier/gemini_call.py",        "python", "LLM tier: raw Gemini API call wrapper", "backend,categorization,llm,gemini"),
    # Matching
    ("App/API/matching/gemini.py",                        "python", "Gemini API client (google-genai) — used by LLM tier", "backend,llm,gemini"),
    ("App/API/matching/fuzzy_index.py",                   "python", "rapidfuzz index management for similarity tier", "backend,categorization,fuzzy"),
    ("App/API/matching/similarity.py",                    "python", "Similarity scoring logic", "backend,categorization,fuzzy"),
    ("App/API/matching/categories.py",                    "python", "Category list utilities shared across tiers", "backend,categorization"),
    ("App/API/matching/merchants/matcher.py",              "python", "Merchant name matching — Aho-Corasick pattern matching", "backend,categorization,merchant"),
    ("App/API/matching/merchants/normalise.py",            "python", "Merchant name normalization before matching", "backend,categorization,merchant"),
    ("App/API/matching/merchants/storage.py",              "python", "Merchant pattern storage and retrieval", "backend,categorization,merchant"),
    ("App/API/matching/merchants/cache_state.py",          "python", "Merchant cache state management", "backend,categorization,merchant,cache"),
    # Routes
    ("App/API/routes/auth.py",                            "python", "Login, logout, token refresh, JWT revocation, /api/me", "backend,auth,routes"),
    ("App/API/routes/uploads.py",                         "python", "Old/simple upload route (may coexist with transactions/upload.py)", "backend,upload,routes"),
    ("App/API/routes/transactions/upload.py",             "python", "CSV/Excel upload, parse, dedup, trigger categorization pipeline", "backend,upload,routes,transactions"),
    ("App/API/routes/transactions/crud.py",               "python", "Transaction CRUD operations", "backend,routes,transactions"),
    ("App/API/routes/transactions/categorisation_routes.py","python","Categorization trigger routes; manual-review resolution; put-in-Other endpoint", "backend,routes,categorization,manual-review"),
    ("App/API/routes/transactions/shared_helpers.py",     "python", "Helpers shared across transaction route modules", "backend,routes,transactions"),
    ("App/API/routes/categories.py",                      "python", "Category management routes", "backend,routes,categories"),
    ("App/API/routes/charts.py",                          "python", "Chart aggregation endpoint — server-side yearly/monthly rollups filtered by user_id", "backend,routes,charts"),
    ("App/API/routes/admin.py",                           "python", "User/role/permission management, impersonation, JWT revocation (admin routes)", "backend,routes,admin"),
    ("App/API/routes/health.py",                          "python", "Keep-alive ping route", "backend,routes,health"),

    # ── Web Frontend ──────────────────────────────────────────────────────────
    ("App/WebUI/src/main.jsx",                            "jsx", "Vite entry point — mounts React app", "web,entrypoint"),
    ("App/WebUI/src/App.jsx",                             "jsx", "Root: AppStateProvider + BrowserRouter + routes. ChartsScreen/ContentsScreen lazy-loaded", "web,routing,entrypoint"),
    ("App/WebUI/src/api.jsx",                             "jsx", "fetch wrapper with client-side timeout; httpOnly JWT cookie auth (web)", "web,api,auth"),
    # AppState (split into 4 contexts)
    ("App/WebUI/src/appState/index.jsx",                  "jsx", "AppStateProvider — composes Auth→Processing→Transactions→ChartFilter providers. Exports all 4 hooks.", "web,state,context"),
    ("App/WebUI/src/appState/AuthContext.jsx",            "jsx", "Auth state: isLoggedIn, userRole, login/logout. Calls /api/me on login.", "web,state,auth"),
    ("App/WebUI/src/appState/TransactionsContext.jsx",    "jsx", "Transactions state: transactions, categories, categoryColors, uploadCount, uploadBreakdown. Loads on login.", "web,state,transactions"),
    ("App/WebUI/src/appState/ChartFilterContext.jsx",     "jsx", "Chart/filter state: chartSummary, chartDataVersion, contentsSelectedCategories, mobileSelectedCategories, effectiveOrder (stack order).", "web,state,charts,filter"),
    ("App/WebUI/src/appState/ProcessingContext.jsx",      "jsx", "Processing state: categorising, processingStage, manualReviewFlow. Triggers manual review flow when NEEDS_MANUAL_REVIEW found.", "web,state,processing,manual-review"),
    # Screens
    ("App/WebUI/src/screens/LoginScreen.jsx",             "jsx", "Login form", "web,screens,auth"),
    ("App/WebUI/src/screens/SignupScreen.jsx",            "jsx", "Signup form", "web,screens,auth"),
    ("App/WebUI/src/screens/HomeScreen.jsx",              "jsx", "MOBILE-ONLY: upload flow + charts (maps to /home). Equivalent of RN HomeScreen.", "web,screens,mobile,upload,charts"),
    ("App/WebUI/src/screens/Dashboard.jsx",               "jsx", "DESKTOP-ONLY: main screen at /dashboard — charts + FilterPane + upload + stats. DashboardScreen.", "web,screens,desktop,charts,upload"),
    ("App/WebUI/src/screens/ChartsScreen.jsx",            "jsx", "MOBILE WEB: phone-mimic charts view at /charts — FilterPane + ChartWindowSection + ChartFootnote. NOT the same as Dashboard.", "web,screens,mobile,charts,phone-mimic"),
    ("App/WebUI/src/screens/ContentsScreen.jsx",          "jsx", "Transaction table screen — sidebar layout, virtualized rows, SelectionBar, CategoryResolveModal", "web,screens,contents,transactions"),
    # Routing/layout components
    ("App/WebUI/src/components/Layout.jsx",               "jsx", "Shell: 3-column grid header (left / title-center / Owner-right). Handles /contents back btn + title in header.", "web,layout,header"),
    ("App/WebUI/src/components/RequiresAuth.jsx",         "jsx", "Route guard: redirects unauthenticated users to /login", "web,routing,auth"),
    ("App/WebUI/src/components/ResponsiveGate.jsx",       "jsx", "Responsive routing: mobile→/home+/charts, desktop→/dashboard. Re-evaluates live on resize. Replaces OrientationGuard+RootRedirect.", "web,routing,responsive"),
    ("App/WebUI/src/components/RoleBadge.jsx",            "jsx", "Owner/Admin/User badge — always rendered top-right in Layout header", "web,layout,auth,role"),
    ("App/WebUI/src/components/OrientationGuard.jsx",     "jsx", "Legacy orientation guard (superseded by ResponsiveGate)", "web,routing,legacy"),
    ("App/WebUI/src/components/RootRedirect.jsx",         "jsx", "Legacy root redirect (superseded by ResponsiveGate)", "web,routing,legacy"),
    # Charts components
    ("App/WebUI/src/components/charts/ChartWindowSection.jsx", "jsx", "Main chart container — renders SpendingStackedChart, windowing controls, popup layer", "web,charts"),
    ("App/WebUI/src/components/charts/SpendingStackedChart.jsx","jsx","Recharts stacked bar chart with StackBars, gridlines, Y-axis, labels, income line", "web,charts"),
    ("App/WebUI/src/components/charts/StackBar.jsx",      "jsx", "Individual stacked bar (one time period)", "web,charts"),
    ("App/WebUI/src/components/charts/ChartPopupLayer.jsx","jsx","Floating/modal segment popup layer coordinator", "web,charts,popup"),
    ("App/WebUI/src/components/charts/SegmentPopupContent.jsx","jsx","Popup content (category, amount, period)", "web,charts,popup"),
    ("App/WebUI/src/components/charts/SegmentPopupFixed.jsx","jsx","Fixed-position popup variant", "web,charts,popup"),
    ("App/WebUI/src/components/charts/SegmentPopupFloating.jsx","jsx","Floating popup variant", "web,charts,popup"),
    ("App/WebUI/src/components/charts/SegmentPopupModal.jsx","jsx","Modal popup variant", "web,charts,popup"),
    ("App/WebUI/src/components/charts/DetailedChartSection.jsx","jsx","Yearly summary chart detail view", "web,charts"),
    ("App/WebUI/src/components/charts/Yearlychartsection.jsx","jsx","Yearly chart section", "web,charts"),
    ("App/WebUI/src/components/charts/ChartFootnote.jsx", "jsx", "Chart footnote (date range, file count, etc.)", "web,charts"),
    ("App/WebUI/src/components/charts/YAxisLabelColumn.jsx","jsx","Y-axis labels", "web,charts"),
    ("App/WebUI/src/components/charts/BarLabelsRow.jsx",  "jsx", "Bar labels row (period labels under bars)", "web,charts"),
    ("App/WebUI/src/components/charts/BarTotalsLayer.jsx","jsx","Total value labels above bars", "web,charts"),
    ("App/WebUI/src/components/charts/ChartGridlines.jsx","jsx","Chart gridlines", "web,charts"),
    ("App/WebUI/src/components/charts/IncomeLine.jsx",    "jsx", "Income trend line overlay on chart", "web,charts"),
    ("App/WebUI/src/components/charts/IncomeLegend.jsx",  "jsx", "Income legend", "web,charts"),
    ("App/WebUI/src/components/charts/RangeWindowSlider.jsx","jsx","Month/year range window slider", "web,charts,window"),
    ("App/WebUI/src/components/charts/StatusBanners.jsx", "jsx", "Loading/error banners for chart area", "web,charts"),
    ("App/WebUI/src/components/charts/chartWindowsToggle.jsx","jsx","Month/year toggle control", "web,charts,window"),
    ("App/WebUI/src/components/charts/monthSlicer.jsx",   "jsx", "Month slicer control", "web,charts,window"),
    ("App/WebUI/src/components/charts/categoryRecolor.jsx","jsx","Category color reassignment UI", "web,charts,categories"),
    # Dashboard / filter
    ("App/WebUI/src/components/dashboard/FilterPane.jsx", "jsx", "Category checkboxes + drag-to-reorder (HTML5 DnD). Used by Dashboard (right sidebar) and ChartsScreen (inline above chart).", "web,dashboard,filter,charts"),
    # Contents / transaction table
    ("App/WebUI/src/components/contents/TransactionRow.jsx","jsx","Single transaction row (virtualized)", "web,contents,transactions"),
    ("App/WebUI/src/components/contents/TableHeader.jsx", "jsx", "Column header row with sort controls", "web,contents"),
    ("App/WebUI/src/components/contents/SelectionBar.jsx","jsx","Slim selection-mode bar (cs-sel-* classes) — replaces old dark banner", "web,contents,selection"),
    ("App/WebUI/src/components/contents/CategoryResolveModal.jsx","jsx","Modal for re-categorizing individual transactions or bulk picks", "web,contents,modal"),
    ("App/WebUI/src/components/contents/CategoryChipRow.jsx","jsx","Category filter chip row (legacy — used in RN, kept in web but not in main ContentsScreen flow)", "web,contents,filter,legacy"),
    ("App/WebUI/src/components/contents/StatusBanners.jsx","jsx","Loading/error/sync banners for contents area", "web,contents"),
    # Homepage / upload
    ("App/WebUI/src/components/homepage/ActionButtons.jsx","jsx","Upload + logout action buttons", "web,homepage,upload"),
    ("App/WebUI/src/components/homepage/UploadFilesPopup.jsx","jsx","Upload popup with file selection and progress", "web,homepage,upload"),
    ("App/WebUI/src/components/homepage/ProgressBar.jsx", "jsx", "Upload/processing progress bar", "web,homepage,upload"),
    ("App/WebUI/src/components/homepage/homepageInfo.jsx","jsx","Stats display on homepage (transaction count, date range, file count)", "web,homepage"),
    # Manual review
    ("App/WebUI/src/components/manualReview/ManualReviewGate.jsx","jsx","Gate that blocks navigation until manual review is complete", "web,manual-review"),
    ("App/WebUI/src/components/manualReview/ManualReviewStatsModal.jsx","jsx","Stage 1: stats modal offering Categorise Now or Put in Other", "web,manual-review"),
    ("App/WebUI/src/components/manualReview/ManualReviewSequentialModal.jsx","jsx","Stage 2: steps through NEEDS_MANUAL_REVIEW items one at a time. Batches picks client-side.", "web,manual-review"),
    ("App/WebUI/src/components/loading/LoadingBarsPlaceholder.jsx","jsx","Loading placeholder animation", "web,loading"),
    # Config
    ("App/WebUI/src/config/popupChartConfig.jsx",         "jsx", "Chart popup: POPUP_VARIANT (none/floatingInChart/modalInChart/belowChart) + INTERACTION_MODE. Fully wired on web.", "web,config,charts,popup"),
    ("App/WebUI/src/config/breakpoints.js",               "js",  "Responsive breakpoint values", "web,config,responsive"),
    ("App/WebUI/src/config/categorisationConfig.jsx",     "jsx", "Categorization-related config values", "web,config,categorization"),
    ("App/WebUI/src/config/routes.jsx",                   "jsx", "Route path constants", "web,config,routing"),
    ("App/WebUI/src/config/uploadWindowConfig.jsx",       "jsx", "Upload window/popup config", "web,config,upload"),
    # Custom hooks — charts
    ("App/WebUI/src/customHooks/charts/useChartData.jsx",         "jsx", "Aggregates chart data from ChartFilterContext: windows, stack order, income, selection", "web,hooks,charts"),
    ("App/WebUI/src/customHooks/charts/useChartFilters.jsx",      "jsx", "Category filter state for charts", "web,hooks,charts,filter"),
    ("App/WebUI/src/customHooks/charts/useChartWindows.jsx",      "jsx", "Month/year window state and scroll logic", "web,hooks,charts,window"),
    ("App/WebUI/src/customHooks/charts/useStackOrder.jsx",        "jsx", "Category stack order state (drag-to-reorder persistence)", "web,hooks,charts,filter"),
    ("App/WebUI/src/customHooks/charts/useSegmentPopup.jsx",      "jsx", "Hover/click segment popup state", "web,hooks,charts,popup"),
    ("App/WebUI/src/customHooks/charts/useModalSegmentPopup.jsx", "jsx", "Modal variant of segment popup state", "web,hooks,charts,popup"),
    ("App/WebUI/src/customHooks/charts/useDataReadiness.jsx",     "jsx", "Chart data readiness check", "web,hooks,charts"),
    ("App/WebUI/src/customHooks/charts/useDetailedChartReveal.jsx","jsx","Yearly chart reveal logic", "web,hooks,charts"),
    ("App/WebUI/src/customHooks/charts/useCategoryRecolor.jsx",   "jsx", "Category color reassignment hook", "web,hooks,charts,categories"),
    # Custom hooks — contents
    ("App/WebUI/src/customHooks/contentsscreen/useContentsData.jsx",   "jsx", "Aggregator hook for ContentsScreen: combines filters, selection, category resolve, staleness sync", "web,hooks,contents"),
    ("App/WebUI/src/customHooks/contentsscreen/useCategoryFilters.jsx","jsx","Search + category filter + sort state for transaction table", "web,hooks,contents,filter"),
    ("App/WebUI/src/customHooks/contentsscreen/useSelectionMode.jsx",  "jsx","Bulk selection mode: selectedIds, select/deselect, delete", "web,hooks,contents,selection"),
    ("App/WebUI/src/customHooks/contentsscreen/useCategoryResolve.jsx","jsx","Category picker modal logic for individual and bulk re-categorization", "web,hooks,contents,modal"),
    ("App/WebUI/src/customHooks/contentsscreen/useStalenessResync.jsx","jsx","Background staleness check: re-syncs transaction categories if out of date", "web,hooks,contents,sync"),
    # Custom hooks — homescreen
    ("App/WebUI/src/customHooks/homescreen/useFilePicker.jsx",      "jsx","File picker state (selected files, status, error)", "web,hooks,upload"),
    ("App/WebUI/src/customHooks/homescreen/useFileProcessor.jsx",   "jsx","Upload + categorization trigger + progress tracking + NOT_YET_CATEGORISED handling", "web,hooks,upload,categorization"),
    ("App/WebUI/src/customHooks/homescreen/useInitialLoadLogic.jsx","jsx","Initial load: fetches transactions, categories, chart data on login", "web,hooks,load"),
    ("App/WebUI/src/customHooks/homescreen/useLogout.jsx",          "jsx","Logout logic", "web,hooks,auth"),
    ("App/WebUI/src/customHooks/homescreen/cacheTierRunner.jsx",    "jsx","Client-side cache tier runner during upload flow", "web,hooks,upload,categorization"),
    ("App/WebUI/src/customHooks/homescreen/llmTierRunner.jsx",      "jsx","Client-side LLM tier trigger during upload flow", "web,hooks,upload,categorization,llm"),
    ("App/WebUI/src/customHooks/useIsMobile.jsx",                   "jsx","Responsive breakpoint hook — drives ResponsiveGate routing", "web,hooks,responsive"),
    # Utils — charts
    ("App/WebUI/src/utils/charts/buildStackData.jsx",     "jsx", "Builds recharts stacked-bar data from transactions + selectedCategories. Empty set = nothing shown (not show-all).", "web,utils,charts,filter"),
    ("App/WebUI/src/utils/charts/chartUtils.jsx",         "jsx", "COLOR_PALETTE and chart utility functions (canonical web color source)", "web,utils,charts,colors"),
    ("App/WebUI/src/utils/charts/chartWindowConfig.jsx",  "jsx", "Chart window config constants", "web,utils,charts,window"),
    ("App/WebUI/src/utils/charts/monthWindow.jsx",        "jsx", "Month window calculation utils", "web,utils,charts,window"),
    ("App/WebUI/src/utils/charts/yearWindow.jsx",         "jsx", "Year window calculation utils", "web,utils,charts,window"),
    ("App/WebUI/src/utils/charts/yearlyChartUtils.jsx",   "jsx", "Yearly chart data utilities", "web,utils,charts"),
    ("App/WebUI/src/utils/charts/stackChartGeometry.jsx", "jsx", "Stacked chart geometry calculations", "web,utils,charts"),
    ("App/WebUI/src/utils/charts/categoryFilterToggle.jsx","jsx","Category filter toggle utilities", "web,utils,charts,filter"),
    # Utils — other
    ("App/WebUI/src/utils/contentsscreen/contentsUtils.jsx","jsx","Contents screen utilities (ROW_HEIGHT, etc.)", "web,utils,contents"),
    ("App/WebUI/src/utils/homescreen/homescreenUtils.jsx","jsx", "Homepage utilities", "web,utils,homepage"),
    # Sentinels
    ("App/WebUI/src/checkingName.jsx",                    "jsx", "NEEDS_MANUAL_REVIEW + NOT_YET_CATEGORISED sentinels (web duplicate — must match App/shared/checkingName.js)", "web,sentinel,categorization"),

    # ── Mobile (NativeAppUI) ──────────────────────────────────────────────────
    ("App/NativeAppUI/App.js",                            "js",  "Expo/RN app root — navigation stack (Stack.Navigator), safe-area provider", "rn,entrypoint,routing"),
    ("App/NativeAppUI/AppContext.js",                     "js",  "Single combined context for ALL RN state (unlike web's 4-context split): transactions, categories, chart data, auth, processing, manual review", "rn,state,context"),
    ("App/NativeAppUI/api.js",                            "js",  "fetch wrapper with timeout; RN auth via expo-secure-store (not httpOnly cookie)", "rn,api,auth"),
    ("App/NativeAppUI/checkingName.js",                   "js",  "NEEDS_MANUAL_REVIEW + NOT_YET_CATEGORISED sentinels (RN duplicate — must match App/shared/checkingName.js)", "rn,sentinel,categorization"),
    ("App/NativeAppUI/index.js",                          "js",  "Expo entry point — registers App component", "rn,entrypoint"),
    ("App/NativeAppUI/metro.config.js",                   "js",  "Metro bundler config — resolver alias for App/shared/ so RN can import shared JS utils", "rn,config,shared"),
    ("App/NativeAppUI/localConfig.js",                    "js",  "Static local config (non-generated)", "rn,config"),
    # RN Screens
    ("App/NativeAppUI/screens/LoginScreen.js",            "js",  "RN login screen", "rn,screens,auth"),
    ("App/NativeAppUI/screens/SignupScreen.js",           "js",  "RN signup screen", "rn,screens,auth"),
    ("App/NativeAppUI/screens/HomeScreen.js",             "js",  "RN main screen: upload flow + charts (equivalent to web HomeScreen + Dashboard combined for mobile)", "rn,screens,upload,charts"),
    ("App/NativeAppUI/screens/ChartsScreen.js",           "js",  "RN charts screen: FilterPane + ChartWindowSection + ChartFootnote", "rn,screens,charts"),
    ("App/NativeAppUI/screens/ContentsScreen.js",         "js",  "RN transaction table: FlatList (not virtualized like web), CategoryChipRow (not sidebar), SelectionBar", "rn,screens,contents,transactions"),
    # RN Components — charts
    ("App/NativeAppUI/components/charts/ChartWindowSection.js",   "js", "RN main chart container — hardcoded modal popup (NOT reading popupChartConfig.js)", "rn,charts,popup"),
    ("App/NativeAppUI/components/charts/SpendingStackedChart.js", "js", "RN stacked bar chart (react-native-gifted-charts)", "rn,charts"),
    ("App/NativeAppUI/components/charts/DetailedChartSection.js", "js", "RN yearly detail chart", "rn,charts"),
    ("App/NativeAppUI/components/charts/Yearlychartsection.js",   "js", "RN yearly chart section", "rn,charts"),
    ("App/NativeAppUI/components/charts/ChartFootnote.js",        "js", "RN chart footnote", "rn,charts"),
    ("App/NativeAppUI/components/charts/StatusBanners.js",        "js", "RN chart status banners", "rn,charts"),
    ("App/NativeAppUI/components/charts/categoryRecolor.js",      "js", "RN category recolor component", "rn,charts,categories"),
    ("App/NativeAppUI/components/charts/monthSlicer.js",          "js", "RN month slicer control", "rn,charts,window"),
    # RN Components — contents
    ("App/NativeAppUI/components/contents/TransactionRow.js",      "js", "RN transaction row", "rn,contents,transactions"),
    ("App/NativeAppUI/components/contents/TableHeader.js",         "js", "RN table header row", "rn,contents"),
    ("App/NativeAppUI/components/contents/SelectionBar.js",        "js", "RN selection mode bar", "rn,contents,selection"),
    ("App/NativeAppUI/components/contents/CategoryResolveModal.js","js", "RN category resolve modal", "rn,contents,modal"),
    ("App/NativeAppUI/components/contents/CategoryChipRow.js",     "js", "RN category filter chip row (used in RN ContentsScreen, not web sidebar)", "rn,contents,filter"),
    ("App/NativeAppUI/components/contents/StatusBanners.js",       "js", "RN contents status banners", "rn,contents"),
    # RN Components — dashboard/filter
    ("App/NativeAppUI/components/dashboard/FilterPane.js",         "js", "RN FilterPane: category checkboxes + drag-to-reorder via PanResponder (not HTML5 DnD). Reorders on release, not live-animated.", "rn,filter,dashboard"),
    # RN Components — homepage / manual review
    ("App/NativeAppUI/components/homepage/UploadFilesPopup.js",    "js", "RN upload popup", "rn,homepage,upload"),
    ("App/NativeAppUI/components/homepage/CategorisationProgress.js","js","RN categorization progress display", "rn,homepage,categorization"),
    ("App/NativeAppUI/components/homepage/homepageInfo.js",        "js", "RN homepage info stats", "rn,homepage"),
    ("App/NativeAppUI/components/manualReview/ManualReviewGate.js","js", "RN manual review gate", "rn,manual-review"),
    ("App/NativeAppUI/components/manualReview/ManualReviewStatsModal.js","js","RN manual review stats modal", "rn,manual-review"),
    ("App/NativeAppUI/components/manualReview/ManualReviewSequentialModal.js","js","RN sequential manual review modal", "rn,manual-review"),
    ("App/NativeAppUI/components/RoleBadge.js",                    "js", "RN Owner/role badge", "rn,auth,role"),
    # RN Config
    ("App/NativeAppUI/config/popupChartConfig.js",                "js",  "RN popup config (POPUP_VARIANT vocabulary only — NOT wired into ChartWindowSection.js)", "rn,config,charts,popup"),
    # RN Custom Hooks — charts
    ("App/NativeAppUI/customHooks/charts/useChartData.js",         "js", "RN chart data hook (reads from AppContext)", "rn,hooks,charts"),
    ("App/NativeAppUI/customHooks/charts/useChartFilters.js",      "js", "RN chart filter hook", "rn,hooks,charts,filter"),
    ("App/NativeAppUI/customHooks/charts/useChartWindows.js",      "js", "RN chart window/scroll hook", "rn,hooks,charts,window"),
    ("App/NativeAppUI/customHooks/charts/useStackOrder.js",        "js", "RN stack order hook", "rn,hooks,charts,filter"),
    ("App/NativeAppUI/customHooks/charts/useDetailedChartReveal.js","js","RN yearly chart reveal hook", "rn,hooks,charts"),
    ("App/NativeAppUI/customHooks/charts/useCategoryRecolor.js",   "js", "RN category recolor hook", "rn,hooks,charts,categories"),
    # RN Custom Hooks — contents
    ("App/NativeAppUI/customHooks/contentsscreen/useContentsData.js",   "js","RN contents aggregator hook", "rn,hooks,contents"),
    ("App/NativeAppUI/customHooks/contentsscreen/useCategoryFilters.js","js","RN contents filter hook", "rn,hooks,contents,filter"),
    ("App/NativeAppUI/customHooks/contentsscreen/useSelectionMode.js",  "js","RN contents selection mode hook", "rn,hooks,contents,selection"),
    ("App/NativeAppUI/customHooks/contentsscreen/useCategoryResolve.js","js","RN category resolve hook", "rn,hooks,contents,modal"),
    ("App/NativeAppUI/customHooks/contentsscreen/useStalenessResync.js","js","RN staleness resync hook", "rn,hooks,contents,sync"),
    # RN Custom Hooks — homescreen
    ("App/NativeAppUI/customHooks/homescreen/useFilePicker.js",      "js","RN file picker (expo-document-picker)", "rn,hooks,upload"),
    ("App/NativeAppUI/customHooks/homescreen/useFileProcessor.js",   "js","RN upload + categorization processor", "rn,hooks,upload,categorization"),
    ("App/NativeAppUI/customHooks/homescreen/useInitialLoadLogic.js","js","RN initial load hook", "rn,hooks,load"),
    ("App/NativeAppUI/customHooks/homescreen/useLogout.js",          "js","RN logout hook", "rn,hooks,auth"),
    # RN Utils
    ("App/NativeAppUI/utils/charts/chartUtils.js",        "js",  "RN COLOR_PALETTE and chart utilities (must match web chartUtils.jsx and adminClI)", "rn,utils,charts,colors"),
    ("App/NativeAppUI/utils/charts/yearlyChartUtils.js",  "js",  "RN yearly chart utilities", "rn,utils,charts"),
    ("App/NativeAppUI/utils/contentsscreen/contentsUtils.js","js","RN contents utilities (ROW_HEIGHT etc.)", "rn,utils,contents"),
    ("App/NativeAppUI/utils/homescreen/homescreenUtils.js","js",  "RN homepage utilities", "rn,utils,homepage"),
    # RN Styles
    ("App/NativeAppUI/styles/chartStyes.js",              "js",  "RN chart StyleSheet", "rn,styles,charts"),
    ("App/NativeAppUI/styles/contentsStyles.js",          "js",  "RN contents StyleSheet", "rn,styles,contents"),
    ("App/NativeAppUI/styles/homepageStyles.js",          "js",  "RN homepage StyleSheet", "rn,styles,homepage"),
    ("App/NativeAppUI/styles/stackedChartStyles.js",      "js",  "RN stacked chart StyleSheet", "rn,styles,charts"),
    # RN docs
    ("App/NativeAppUI/AGENTS.md",                         "markdown","Expo SDK 54 warning: check docs.expo.dev/versions/v54.0.0/ before any Expo API work", "rn,expo,warning,docs"),

    # ── Shared ────────────────────────────────────────────────────────────────
    ("App/shared/checkingName.js",                        "js",  "NEEDS_MANUAL_REVIEW + NOT_YET_CATEGORISED sentinel constants (canonical JS source shared by all platforms)", "shared,sentinel,categorization"),
    ("App/shared/utils/buildStackData.js",                "js",  "Shared stack data builder (JS version — may differ from web JSX version)", "shared,utils,charts"),
    ("App/shared/utils/chartUtils.js",                    "js",  "Shared chart utilities", "shared,utils,charts"),
    ("App/shared/utils/chartWindowConfig.js",             "js",  "Shared chart window config", "shared,utils,charts"),
    ("App/shared/utils/contentsUtils.js",                 "js",  "Shared contents utilities", "shared,utils,contents"),
    ("App/shared/utils/homescreenUtils.js",               "js",  "Shared homescreen utilities", "shared,utils,homepage"),
    ("App/shared/utils/monthWindow.js",                   "js",  "Shared month window utils", "shared,utils,charts"),
    ("App/shared/utils/yearWindow.js",                    "js",  "Shared year window utils", "shared,utils,charts"),
    ("App/shared/utils/yearlyChartUtils.js",              "js",  "Shared yearly chart utils", "shared,utils,charts"),

    # ── Admin CLI ─────────────────────────────────────────────────────────────
    ("App/adminClI/colours/setColorAdmin.py",             "python","Admin: set category color", "admin,colors"),
    ("App/adminClI/users/createUserAdmin.py",             "python","Admin: create user", "admin,users"),
    ("App/adminClI/users/deleteUserAdmin.py",             "python","Admin: delete user", "admin,users"),
    ("App/adminClI/users/editUserAdmin.py",               "python","Admin: edit user", "admin,users"),
    ("App/adminClI/users/impersonateUserAdmin.py",        "python","Admin: impersonate user (JWT swap)", "admin,users,auth"),
    ("App/adminClI/users/listUsersAdmin.py",              "python","Admin: list users", "admin,users"),
    ("App/adminClI/users/manageUserTransactionsAdmin.py", "python","Admin: manage user transactions", "admin,users,transactions"),
    ("App/adminClI/permissions/managePermissionsAdmin.py","python","Admin: manage permissions", "admin,permissions"),
    ("App/adminClI/permissions/manageRolesAdmin.py",      "python","Admin: manage roles", "admin,permissions"),
    ("App/adminClI/permissions/assignRoleAdmin.py",       "python","Admin: assign role to user", "admin,permissions"),
    ("App/adminClI/permissions/listImpersonationLogAdmin.py","python","Admin: list impersonation log", "admin,permissions,auth"),
]
c.executemany(
    "INSERT OR REPLACE INTO files (path, language, description, tags) VALUES (?, ?, ?, ?)",
    files
)

# ── Dependencies ──────────────────────────────────────────────────────────────
deps = [
    # Backend pipeline chain
    ("App/API/routes/transactions/upload.py",              "CALLS",       "App/API/categorise/pipeline.py"),
    ("App/API/categorise/pipeline.py",                     "CALLS",       "App/API/categorise/exact_tier.py"),
    ("App/API/categorise/pipeline.py",                     "CALLS",       "App/API/categorise/merchant_tier.py"),
    ("App/API/categorise/pipeline.py",                     "CALLS",       "App/API/categorise/similarity_tier.py"),
    ("App/API/categorise/pipeline.py",                     "CALLS",       "App/API/categorise/llm_tier/orchestrator.py"),
    ("App/API/categorise/merchant_tier.py",                "CALLS",       "App/API/matching/merchants/matcher.py"),
    ("App/API/categorise/similarity_tier.py",              "CALLS",       "App/API/matching/fuzzy_index.py"),
    ("App/API/categorise/llm_tier/orchestrator.py",        "CALLS",       "App/API/matching/gemini.py"),
    ("App/API/categorise/llm_tier/orchestrator.py",        "CALLS",       "App/API/categorise/llm_tier/gemini_call.py"),
    # Backend auth chain
    ("App/API/backend.py",                                 "IMPORTS",     "App/API/extensions.py"),
    ("App/API/routes/auth.py",                             "IMPORTS",     "App/API/extensions.py"),
    ("App/API/permissions.py",                             "IMPORTS",     "App/API/extensions.py"),
    ("App/API/routes/transactions/categorisation_routes.py","IMPORTS",    "App/API/shared.py"),
    # Sentinel usage — backend
    ("App/API/categorise/pipeline.py",                     "IMPORTS",     "App/API/checkingName.py"),
    ("App/API/shared.py",                                  "IMPORTS",     "App/API/checkingName.py"),
    # Sentinel triplication
    ("App/WebUI/src/checkingName.jsx",                     "DUPLICATES",  "App/shared/checkingName.js"),
    ("App/NativeAppUI/checkingName.js",                    "DUPLICATES",  "App/shared/checkingName.js"),
    ("App/API/checkingName.py",                            "MIRRORS",     "App/shared/checkingName.js"),
    # Web app state hierarchy
    ("App/WebUI/src/appState/index.jsx",                   "COMPOSES",    "App/WebUI/src/appState/AuthContext.jsx"),
    ("App/WebUI/src/appState/index.jsx",                   "COMPOSES",    "App/WebUI/src/appState/ProcessingContext.jsx"),
    ("App/WebUI/src/appState/index.jsx",                   "COMPOSES",    "App/WebUI/src/appState/TransactionsContext.jsx"),
    ("App/WebUI/src/appState/index.jsx",                   "COMPOSES",    "App/WebUI/src/appState/ChartFilterContext.jsx"),
    ("App/WebUI/src/appState/TransactionsContext.jsx",     "CONSUMES",    "App/WebUI/src/appState/AuthContext.jsx"),
    ("App/WebUI/src/appState/ChartFilterContext.jsx",      "CONSUMES",    "App/WebUI/src/appState/AuthContext.jsx"),
    ("App/WebUI/src/appState/ChartFilterContext.jsx",      "CONSUMES",    "App/WebUI/src/appState/TransactionsContext.jsx"),
    ("App/WebUI/src/appState/ProcessingContext.jsx",       "IMPORTS",     "App/WebUI/src/checkingName.jsx"),
    # Web routing
    ("App/WebUI/src/App.jsx",                              "IMPORTS",     "App/WebUI/src/appState/index.jsx"),
    ("App/WebUI/src/App.jsx",                              "IMPORTS",     "App/WebUI/src/components/ResponsiveGate.jsx"),
    ("App/WebUI/src/App.jsx",                              "IMPORTS",     "App/WebUI/src/components/Layout.jsx"),
    ("App/WebUI/src/App.jsx",                              "IMPORTS",     "App/WebUI/src/components/RequiresAuth.jsx"),
    ("App/WebUI/src/components/ResponsiveGate.jsx",        "IMPORTS",     "App/WebUI/src/customHooks/useIsMobile.jsx"),
    ("App/WebUI/src/components/Layout.jsx",                "IMPORTS",     "App/WebUI/src/components/RoleBadge.jsx"),
    # Web screens → appState
    ("App/WebUI/src/screens/Dashboard.jsx",               "IMPORTS",     "App/WebUI/src/appState/index.jsx"),
    ("App/WebUI/src/screens/ChartsScreen.jsx",            "IMPORTS",     "App/WebUI/src/appState/index.jsx"),
    ("App/WebUI/src/screens/HomeScreen.jsx",              "IMPORTS",     "App/WebUI/src/appState/index.jsx"),
    ("App/WebUI/src/screens/ContentsScreen.jsx",          "IMPORTS",     "App/WebUI/src/customHooks/contentsscreen/useContentsData.jsx"),
    # Web screens → components
    ("App/WebUI/src/screens/Dashboard.jsx",               "IMPORTS",     "App/WebUI/src/components/dashboard/FilterPane.jsx"),
    ("App/WebUI/src/screens/ChartsScreen.jsx",            "IMPORTS",     "App/WebUI/src/components/dashboard/FilterPane.jsx"),
    ("App/WebUI/src/screens/Dashboard.jsx",               "IMPORTS",     "App/WebUI/src/components/charts/ChartWindowSection.jsx"),
    ("App/WebUI/src/screens/ChartsScreen.jsx",            "IMPORTS",     "App/WebUI/src/components/charts/ChartWindowSection.jsx"),
    # Chart data flow
    ("App/WebUI/src/customHooks/charts/useChartData.jsx", "READS",       "App/WebUI/src/appState/ChartFilterContext.jsx"),
    ("App/WebUI/src/components/charts/ChartWindowSection.jsx","IMPORTS", "App/WebUI/src/utils/charts/buildStackData.jsx"),
    ("App/WebUI/src/utils/charts/buildStackData.jsx",     "READS",       "App/WebUI/src/appState/ChartFilterContext.jsx"),
    # Popup config (web — fully wired)
    ("App/WebUI/src/components/charts/ChartPopupLayer.jsx","READS",      "App/WebUI/src/config/popupChartConfig.jsx"),
    # Popup config (RN — NOT wired)
    ("App/NativeAppUI/components/charts/ChartWindowSection.js","NOT_READING","App/NativeAppUI/config/popupChartConfig.js"),
    # Web API calls
    ("App/WebUI/src/appState/TransactionsContext.jsx",    "CALLS",       "App/WebUI/src/api.jsx"),
    ("App/WebUI/src/appState/ChartFilterContext.jsx",     "CALLS",       "App/WebUI/src/api.jsx"),
    ("App/WebUI/src/appState/AuthContext.jsx",            "CALLS",       "App/WebUI/src/api.jsx"),
    # RN global state
    ("App/NativeAppUI/screens/HomeScreen.js",             "IMPORTS",     "App/NativeAppUI/AppContext.js"),
    ("App/NativeAppUI/screens/ChartsScreen.js",           "IMPORTS",     "App/NativeAppUI/AppContext.js"),
    ("App/NativeAppUI/screens/ContentsScreen.js",         "IMPORTS",     "App/NativeAppUI/customHooks/contentsscreen/useContentsData.js"),
    ("App/NativeAppUI/AppContext.js",                     "CALLS",       "App/NativeAppUI/api.js"),
    # Metro alias (shared utils)
    ("App/NativeAppUI/metro.config.js",                   "ALIASES",     "App/shared/"),
    # COLOR_PALETTE triplication
    ("App/WebUI/src/utils/charts/chartUtils.jsx",         "COLOR_SOURCE","canonical"),
    ("App/NativeAppUI/utils/charts/chartUtils.js",        "DUPLICATES",  "App/WebUI/src/utils/charts/chartUtils.jsx"),
    ("App/adminClI/colours/setColorAdmin.py",             "DUPLICATES",  "App/WebUI/src/utils/charts/chartUtils.jsx"),
    # Contents hook chain (web)
    ("App/WebUI/src/customHooks/contentsscreen/useContentsData.jsx","IMPORTS","App/WebUI/src/customHooks/contentsscreen/useCategoryFilters.jsx"),
    ("App/WebUI/src/customHooks/contentsscreen/useContentsData.jsx","IMPORTS","App/WebUI/src/customHooks/contentsscreen/useSelectionMode.jsx"),
    ("App/WebUI/src/customHooks/contentsscreen/useContentsData.jsx","IMPORTS","App/WebUI/src/customHooks/contentsscreen/useCategoryResolve.jsx"),
    ("App/WebUI/src/customHooks/contentsscreen/useContentsData.jsx","IMPORTS","App/WebUI/src/customHooks/contentsscreen/useStalenessResync.jsx"),
]
c.executemany(
    "INSERT OR REPLACE INTO dependencies (source, relationship, target) VALUES (?, ?, ?)",
    deps
)

# ── Constraints ───────────────────────────────────────────────────────────────
constraints_data = [
    ("Owner badge always top-right",          "Layout.jsx 3-col grid header enforces this. Never reposition RoleBadge.", "hard"),
    ("No overview.html unless explicitly told","context/overview.html is client-facing only. Do not read/edit without instruction.", "hard"),
    ("No hand-edit generated configs",        "App/.env and App/NativeAppUI/generatedLocalConfig.js are overwritten on each start-all.bat run.", "hard"),
    ("Both sentinels must sync across 4 files","NEEDS_MANUAL_REVIEW and NOT_YET_CATEGORISED must be identical in App/shared/checkingName.js, App/NativeAppUI/checkingName.js, App/WebUI/src/checkingName.jsx, App/API/checkingName.py", "hard"),
    ("Admin CLI targets production",          "BASE_URL in adminClI hardcoded to https://cashflow2-0.onrender.com. Change with intent.", "hard"),
    ("No automated tests",                    "No test suite exists anywhere. Verification is build + visual only.", "scope"),
    ("No ORM — hand-applied SQL",             "Schema changes go directly to Supabase. schema.sql is source of truth.", "scope"),
    ("Re-upload must be no-op",               "dedup_key mechanism must not be broken.", "behavioral"),
    ("Manual review single flush",            "Picks batched client-side; one API call on completion. Not per-item.", "behavioral"),
    ("Empty selectedCategories = nothing",    "buildStackData must show nothing when filter set is empty. Do not add show-all guard.", "behavioral"),
    ("No auto-merge",                         "Never auto-merge PRs. Owner manually merges.", "scope"),
    ("Web auth = httpOnly cookie",            "JWT must not be accessible to JS on web. No localStorage auth.", "security"),
    ("Expo SDK 54 docs",                      "Check docs.expo.dev/versions/v54.0.0/ before any Expo API work in NativeAppUI.", "hard"),
    ("ResponsiveGate owns routing split",     "Mobile→/home+/charts, desktop→/dashboard. Do not add routing logic elsewhere.", "behavioral"),
    ("RN popup is NOT config-driven",         "popupChartConfig.js is vocabulary only. ChartWindowSection.js has hardcoded popup. Changing config has no effect.", "behavioral"),
    ("Web AppState is 4 split contexts",      "Auth/Processing/Transactions/ChartFilter — NOT a single AppContext. RN still uses single AppContext.js.", "behavioral"),
]
c.executemany(
    "INSERT OR REPLACE INTO constraints (title, description, severity) VALUES (?, ?, ?)",
    constraints_data
)

# ── Known Problems ────────────────────────────────────────────────────────────
problems = [
    ("No automated tests anywhere",            "No unit/integration tests in backend, web, or RN.", "cross-cutting", "high"),
    ("Two sentinels in 4 files — no sync",     "NEEDS_MANUAL_REVIEW + NOT_YET_CATEGORISED each defined in 4 places with no runtime sharing.", "cross-cutting", "medium"),
    ("RN popup not config-driven",             "popupChartConfig.js exists but ChartWindowSection.js has hardcoded popup — config has no effect.", "rn", "medium"),
    ("AdminCLI hardcoded to prod",             "BASE_URL in adminCliCommon.py always hits production.", "admin-cli", "medium"),
    ("COLOR_PALETTE triplication",             "adminClI/colours, web chartUtils.jsx, RN chartUtils.js can drift.", "cross-cutting", "low"),
    ("No ORM/migrations",                      "Schema changes are hand-applied SQL, no rollback.", "backend", "medium"),
    ("FilterPane RN no live animation",        "PanResponder reorders on finger release, not animated live under finger.", "rn", "low"),
    ("Root README is placeholder",             "README.md contains only '# Cashflow2.0'.", "docs", "low"),
    ("RN ContentsScreen uses FlatList",        "RN ContentsScreen uses FlatList + CategoryChipRow (not sidebar), not virtualized like web.", "rn", "low"),
    ("sendBeacon gap on tab close",            "In-flight unflushed picks lost if user closes tab mid-categorization. Only fully-staged items protected.", "web", "low"),
    ("adminClI package structure inconsistent","categories/ and permissions/ lack __init__.py; colours/ and users/ have one.", "admin-cli", "low"),
    ("Web appState is 4 contexts",             "New sessions often mis-document this as a single AppContext.jsx — it's 4 split contexts.", "web", "medium"),
]
c.executemany(
    "INSERT OR REPLACE INTO known_problems (title, description, area, severity) VALUES (?, ?, ?, ?)",
    problems
)

# ── Failed Solutions ──────────────────────────────────────────────────────────
failures = [
    ("JWT without revocation",            "Tokens stayed valid after logout.",                               "auth",          "Always check revoked_tokens table on every authenticated request."),
    ("Empty filter = show all",           "Deselecting all categories showed everything instead of nothing.", "charts",        "Empty set must mean nothing. Do not add size===0 show-all guard to buildStackData."),
    ("Per-item manual review API calls",  "N picks = N round trips, partial-state risk.",                    "manual-review", "Batch picks client-side; single flush on completion."),
    ("Per-item Put in Other loop",        "O(n) SQL updates instead of one.",                                "backend",       "Single UPDATE WHERE category = NEEDS_MANUAL_REVIEW."),
    ("overflow-x:auto+overflow-y:visible","CSS spec forces overflow-y to auto too, causing double scrollbar.","css",          "Never pair overflow-x:auto with expectation overflow-y stays visible."),
    ("Two FilterPane components",         "Separate category list + stack-order list = duplicated state.",    "web",           "Merge into one combined FilterPane component."),
    ("localStorage minimize state",       "Stale key caused FilterPane to appear hidden after button removed.","web",         "Remove localStorage persistence when removing the UI control that writes it."),
    ("cs-topbar inside ContentsScreen",   "Two header rows; Owner badge appeared top-left.",                  "web",           "Move back btn+title into Layout.jsx header. Use 3-col grid. Remove cs-topbar."),
    ("Two NOT_YET_CATEGORISED sentinels", "Backend had 'FAILED - rerun', frontend had NOT_YET_CATEGORISED — different strings for same concept, frontend retry logic couldn't see backend failures.", "categorization", "Merged into single shared string value across all 4 files."),
    ("OrientationGuard+RootRedirect split","Two separate components for orientation/routing logic caused inconsistencies on resize/back/forward.", "web", "Replaced by single ResponsiveGate that re-evaluates live on every render."),
]
c.executemany(
    "INSERT OR REPLACE INTO failed_solutions (title, description, area, lesson) VALUES (?, ?, ?, ?)",
    failures
)

# ── Git Config ────────────────────────────────────────────────────────────────
c.execute("""
INSERT OR REPLACE INTO git_configuration (id, upstream, base_branch, auto_merge, branch_prefix, trigger_word, workflow, notes)
VALUES (
    1,
    'https://github.com/Ideas-of-stuff-to-learn/Cashflow2.0.git',
    'main',
    0,
    'ai/',
    'ship',
    'implement locally → npm run build → owner says "ship" → git add <files> → commit → git pull --rebase → git push origin main. Branch workflow (ai/<desc>) only when owner explicitly requests a PR. Never auto-merge. After PR merge: git checkout main + git pull origin main.',
    'Bot commits (Backup log, Keep-alive ping) appear in git log — ignore them. stash -u before pull --rebase if uncommitted changes exist.'
)
""")

# ── Realignment Record ────────────────────────────────────────────────────────
c.execute("""
INSERT OR REPLACE INTO realignment (
    id, realignment_doc, overview_doc, architecture_doc, constraints_doc,
    current_task_doc, dependencies_doc, decisions_doc, known_problems_doc,
    failed_solutions_doc, handoff_doc, git_doc, notes
) VALUES (
    1, 'context/realignment.md', 'context/overview.md', 'context/architecture.md',
    'context/constraints.md', 'context/current-task.md', 'context/dependencies.md',
    'context/decisions.md', 'context/known-problems.md', 'context/failed-solutions.md',
    'context/handoff.md', 'context/gitContext.md',
    'Load realignment.md first. Then overview→architecture→constraints→current-task. Others only as needed for the task.'
)
""")

conn.commit()
conn.close()
print("knowledge.db rebuilt successfully.")

conn2 = sqlite3.connect(db_path)
c2 = conn2.cursor()
for table in ["context_documents","files","dependencies","constraints","known_problems","failed_solutions"]:
    n = c2.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"  {table}: {n} rows")
conn2.close()
