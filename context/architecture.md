# Cashflow2.0 — Architecture

## Layers

```
┌─────────────────────────────────────────────────────┐
│  Web Frontend (React/Vite)  │  Mobile (Expo/RN)     │
│  App/WebUI/                 │  App/NativeAppUI/      │
└────────────────────┬────────┴──────────┬────────────┘
                     │   HTTP + JWT       │
                     ▼                   ▼
         ┌───────────────────────────────────┐
         │       Flask API (App/API/)        │
         │  backend.py → extensions.py       │
         │  routes/ | categorise/ | matching/│
         └─────────────────┬─────────────────┘
                           │  psycopg2 (raw SQL)
                           ▼
         ┌───────────────────────────────────┐
         │        Postgres (Supabase)        │
         └───────────────────────────────────┘
                           +
         ┌───────────────────────────────────┐
         │         Gemini API                │
         │  (LLM categorization tier only)   │
         └───────────────────────────────────┘
```

## Backend Components

### Entry Point
- `App/API/backend.py` — Flask app creation, imports `extensions.py` and all route blueprints
- `App/API/extensions.py` — shared Flask app instance, JWT manager, rate limiter (imported by all other modules to avoid circular imports)

### Routes (`App/API/routes/`)
| File | Responsibility |
|---|---|
| `auth.py` | Login, logout, token refresh, JWT revocation |
| `uploads.py` | CSV/Excel upload, parse, dedup, trigger pipeline |
| `transactions/` | CRUD, upload orchestration, categorization routes, shared helpers |
| `categories.py` | Category management |
| `charts.py` | Aggregated chart-summary data endpoint |
| `admin.py` | User/role/permission management, impersonation, JWT revocation |
| `health.py` | Keep-alive ping |

### Categorization Pipeline (`App/API/categorise/`)
Tiers executed cheapest-first. Each tier returns a result or passes through to the next.

```
pipeline.py (orchestrator)
  ↓
exact_tier.py          — match against category_records (user's own history)
  ↓
merchant_tier.py       — Aho-Corasick substring match on merchant list
  ↓
similarity_tier.py     — rapidfuzz fuzzy similarity
  ↓
llm_tier/              — Gemini LLM (batch + recheck + empty_result handling)
  ↓
NEEDS_MANUAL_REVIEW    — sentinel placed on unresolved transactions
```

### Matching Layer (`App/API/matching/`)
- `categories.py` — category list utilities
- `fuzzy_index.py` — rapidfuzz index management
- `similarity.py` — similarity scoring
- `gemini.py` — Gemini API call wrapper
- `merchants/` — merchant name normalization, Aho-Corasick storage, matcher, cache state

### Auth & Permissions
- `permissions.py` — `@require_permission` decorator, role/permission lookup
- Three-tier role hierarchy: **owner > admin > user**
- Tables: `roles`, `permissions`, `role_permissions`, `user_permission_overrides`
- Token revocation via `revoked_tokens` table
- Impersonation logged in `impersonation_log`

### Database
- Raw SQL via psycopg2, no ORM
- Schema source of truth: `App/API/schema.sql` (heavily commented with design rationale)
- Key tables: `transactions`, `category_records`, `uploaded_files`, `users`, `roles`, `permissions`, `role_permissions`, `user_permission_overrides`, `revoked_tokens`, `impersonation_log`

## Frontend Architecture (Web)

### Global State
`App/WebUI/src/AppContext.jsx` — React Context holding:
- `transactions`, `categories`, `categoryColors`
- `selectedCategories` (filter Set)
- Chart summary data
- Manual review flow state
- Auth/role

### Screen/Component Structure
```
App/WebUI/src/
├── screens/
│   ├── LoginScreen.jsx
│   ├── DashboardScreen.jsx    — charts + FilterPane
│   ├── ContentsScreen.jsx     — transaction table (virtualized)
│   └── ChartsScreen.jsx       — phone-mimic chart view
├── components/
│   ├── dashboard/             — FilterPane, chart popup, summary stats
│   ├── contents/              — TransactionRow, TableHeader, SelectionBar, StatusBanners, CategoryResolveModal
│   ├── charts/                — ChartSection, ChartFootnote
│   ├── homepage/              — upload flow, manual review modals
│   ├── manualReview/
│   └── loading/
├── customHooks/               — per-screen data hooks
├── config/
│   └── popupChartConfig.jsx   — chart popup placement + interaction mode (fully wired)
└── styles/                    — plain CSS per component/screen (cs-* namespace for ContentsScreen)
```

### Layout Structure (Web, post-redesign)
- `Layout.jsx` — shell with 3-column grid header (back btn left / title center / Owner badge right)
- Dashboard: `DashboardScreen` with side-by-side `FilterPane` + chart area
- ContentsScreen: `cs-container` flex column → `cs-body` flex row (sidebar + main)

### Data Flow (Web)
```
AppContext (transactions/categories/chart data)
  ↓
Screen-level data hooks (useContentsData, useChartData, etc.)
  ↓
Component render
  ↓
api.js (fetch wrapper with client-side timeout)
  ↓
Flask API
```

## Frontend Architecture (Mobile — App/NativeAppUI/)

Mirrors the web structure with platform-specific implementations:
- `AppContext.js` — same role as web AppContext.jsx
- Auth via `expo-secure-store` instead of httpOnly cookie
- Charts via `react-native-gifted-charts` instead of recharts
- Drag-to-reorder in FilterPane via `PanResponder` (not HTML5 DnD)
- RN chart popup is hardcoded, not wired to `popupChartConfig.js` (known issue — see known-problems.md)

## Upload + Data Flow

```
User picks file (CSV/Excel)
  ↓
useFilePicker / useFileProcessor hook
  ↓
POST to upload endpoint
  ↓
Parse rows → compute dedup_key per row
  ↓
INSERT into transactions (unique per user+dedup_key — re-upload is a no-op)
  ↓
Record source filename in uploaded_files (only if genuinely new rows)
  ↓
Categorization pipeline (5 tiers)
  ↓
transactions updated with category / NEEDS_MANUAL_REVIEW sentinel
  ↓
Frontend manual-review gate (if any NEEDS_MANUAL_REVIEW remain)
  ↓
ManualReviewStatsModal → ManualReviewSequentialModal
  ↓
Picks batched client-side → single flush API call
```

## Chart Data Flow

```
charts endpoint (server-side aggregates, filtered by user_id)
  ↓
useChartData / useChartWindows / useChartFilters hooks
  ↓
buildStackData.jsx — builds stacked-bar segments filtered by selectedCategories
  ↓
recharts (web) / react-native-gifted-charts (RN)
  ↓
popupChartConfig.jsx (web) — controls popup placement + hover/click interaction
```

## Admin Flow

```
App/adminClI/ standalone Python scripts
  ↓
HTTP requests to production backend (hardcoded to cashflow2-0.onrender.com)
  ↓
Flask admin routes (require owner-level permission)
  ↓
Postgres
```

## CI/CD

```
Push to main → GitHub Actions autoDeployFrontend.yml → deploy web frontend
Nightly         → supabase-backup.yml → pg_dump → artifact + append DBbackupLog.txt
Nightly         → supabase-keep-alive.yml → ping DB → append DBaliveLog.txt
```
