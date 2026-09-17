# Cashflow 2.0 — Task Backlog

> **Status key:** `[ ]` open &nbsp;·&nbsp; `[-]` in progress &nbsp;·&nbsp; `[x]` done &nbsp;·&nbsp; `[~]` blocked  
> **Priority key:** 🔴 P1 Critical &nbsp;·&nbsp; 🟠 P2 High &nbsp;·&nbsp; 🟡 P3 Medium &nbsp;·&nbsp; 🟢 P4 Low

---

## 🎯 Target & Progress Log

**Deadline:** 30 September 2026 — aim to have all P1 and P2 tasks complete, P3 in progress or done, P4 scoped.  
**Check-in cadence:** every 5 days — write a short progress note below.

| Check-in | Date | Notes |
|----------|------|-------|
| 1 | 22 Sep 2026 | _(write update here)_ |
| 2 | 27 Sep 2026 | _(write update here)_ |
| 3 | 02 Oct 2026 | _(extended if needed)_ |

> The deadline is an aim, not a hard constraint — extend if needed but keep the cadence.

---

## Quick Reference

| # | Task | Priority | Effort | Complexity |
|---|------|----------|--------|------------|
| [1](#1--isolate-auth-into-shared-auth--billing-service) | Isolate auth into shared service | 🔴 P1 | 2–3 weeks | Very High |
| [2](#2--company-landing-page) | Company landing page | 🔴 P1 | 3–5 days | Medium |
| [3](#3--stripe-billing-integration) | Stripe billing integration | 🔴 P1 | 1–2 weeks | High |
| [4](#4--webhook-listener-subscription-status-sync) | Webhook listener (subscription sync) | 🔴 P1 | 3–5 days | High |
| [5](#5--per-tool-jwt-access-gating) | Per-tool JWT access gating | 🟠 P2 | 3–5 days | High |
| [6](#6--deployed-subdomain-linkage) | Deployed subdomain linkage | 🟠 P2 | 2–3 days | Medium |
| [7](#7--free-trial-support) | Free trial support | 🟠 P2 | 2–3 days | Medium |
| [8](#8--stripe-customer-portal-self-service) | Stripe Customer Portal (self-service) | 🟠 P2 | 1–2 days | Low |
| [9](#9--category-list-vanishing-on-remember-this-order) | ~~Category list vanishing bug~~ | 🟠 P2 | 0.5–1 day | Low |
| [10](#10--bring-react-native-up-to-date) | Bring React Native up to date | 🟠 P2 | 3–5 days | Medium |
| [11](#11--dashboard-zero-page-scroll) | Dashboard: no page scroll | 🟡 P3 | 0.5–1 day | Low |
| [12](#12--convert-footnote-box--user-information-popup) | User Information popup | 🟡 P3 | 1–2 days | Low |
| [13](#13--add-data-security-popup) | Data Security popup | 🟡 P3 | 1 day | Low |
| [14](#14--font-size-and-colour-palette-audit) | Font, size and colour palette audit | 🟡 P3 | 2–3 days | Medium |
| [15](#15--hard-testing--all-surfaces) | Hard testing (all surfaces) | 🟡 P3 | 3–5 days | Medium |
| [16](#16--full-automated-test-suite) | Full automated test suite | 🟢 P4 | 2–4 weeks | Very High |
| [17](#17--owner-admin-page) | Owner admin page (CLI + SQL tools in UI) | 🟢 P4 | 2–3 days | Medium |

---

## 🔴 P1 — Critical (Do First · These Block Everything Else)

---

### 1 · Isolate auth into shared Auth & Billing Service

**Priority:** 🔴 P1 — Critical  
**Effort:** 2–3 weeks  
**Complexity:** Very High  
**Why first:** Every other task in this section depends on a single identity layer existing. Cashflow's current auth (login, signup, auto-login, JWT, bcrypt, refresh, revocation) needs to be extracted and deployed as a standalone service that any future tool can point at.

**What it involves:**
- Extract login, signup, logout, refresh, and `/auth/me` out of Cashflow's Flask backend into a new standalone service (new repo or clearly isolated sub-service)
- New shared `users` table with: unique ID, email, username, bcrypt-hashed password
- JWT issuance updated to include a `tools` claim — a list of tool IDs the user has active access to (starts with `["cashflow"]` for existing users)
- Auto-login (silent re-auth on page load via refresh token) must continue to work post-extraction
- Cashflow's backend stops owning auth — all auth routes delegate to, or are removed in favour of, the shared service
- Decide: keep rolling own auth (current approach, works fine) vs. move to managed provider (Supabase Auth / Clerk) — spec recommends own at this scale
- CORS, cookie domain, and cross-origin session strategy agreed before build

**What it touches:**  
`App/API/routes/auth.py` · `App/API/routes/preferences.py` · `App/WebUI/src/appState/AuthContext.jsx` · `App/WebUI/src/api.jsx` · `App/API/schema.sql` · `App/API/backend.py` · all JWT-dependent routes · deployment config on Render

---

### 2 · Company landing page

**Priority:** 🔴 P1 — Critical  
**Effort:** 3–5 days  
**Complexity:** Medium  
**Why first:** The shared service needs a home. This is the public-facing page users land on, see the product line, and are directed to login/subscribe. Must exist before subdomain linkage and Stripe flow can be tested end-to-end.

**What it involves:**
- Standalone site (separate from Cashflow) listing the company's tools with descriptions and subscribe/login CTAs
- Links to each deployed tool (initially just Cashflow)
- Login/signup redirects to the shared auth service, then back to the chosen tool
- Design consistent with the overall brand
- Deployed independently (its own Render service or static host)

**What it touches:**  
New repo / new deployment · shared auth service (redirect URLs) · Stripe Checkout URLs per tool

---

### 3 · Stripe billing integration

**Priority:** 🔴 P1 — Critical  
**Effort:** 1–2 weeks  
**Complexity:** High  
**Why first:** No money flows, no subscriptions exist, and the access-gating in task 5 has nothing to check until this is done. Needs to be live before any paying users can be onboarded.

**What it involves:**
- Create one Stripe account for the company
- Create one Stripe Product + Price per tool (e.g. "Cashflow 2.0 — Monthly")
- Add a `subscriptions` table to the shared service DB: `(user_id, tool_id, stripe_subscription_id, status, current_period_end)`
- Implement Stripe Checkout session creation endpoint — called when user clicks "Subscribe" on a tool page
- After successful payment, Stripe fires webhook → task 4 handles it
- Stripe Customer Portal link for self-service management (task 8)
- Decide trial policy (task 7) before build — affects Checkout config
- Test full payment loop in Stripe test mode before going live

**What it touches:**  
New shared service: `routes/billing.py` (or equivalent) · `schema.sql` (subscriptions table) · Stripe dashboard · environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) · Render deployment config

---

### 4 · Webhook listener (subscription status sync)

**Priority:** 🔴 P1 — Critical  
**Effort:** 3–5 days  
**Complexity:** High  
**Why first:** Without this, Stripe payments succeed but nothing in the system knows about it. The webhook listener is the bridge between Stripe and the access layer — it must exist before any end-to-end payment test is possible.

**What it involves:**
- One POST endpoint on the shared service that receives all Stripe webhook events
- Verify webhook signature (`stripe.Webhook.construct_event`) before processing — security critical
- Handle events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- On each event: update `subscriptions` table status and `current_period_end`
- Treat `trialing` the same as `active` (see task 7)
- Register endpoint in Stripe dashboard; use Stripe CLI locally to replay events during development
- Log unhandled event types but do not error — Stripe sends many event types

**What it touches:**  
Shared service: `routes/webhooks.py` · `subscriptions` table · Stripe dashboard webhook config · environment secrets

---

## 🟠 P2 — High (Build After Foundation Is Live)

---

### 5 · Per-tool JWT access gating

**Priority:** 🟠 P2 — High  
**Effort:** 3–5 days  
**Complexity:** High  
**Why:** Once auth is isolated and billing exists, each tool needs to gate its features based on whether the user has an active subscription for that tool. This is the mechanism that makes the whole architecture pay off.

**What it involves:**
- Update JWT payload on login/refresh to include `"tools": ["cashflow", ...]` — the list of tool IDs with active/trialing subscriptions for that user
- Cashflow's backend verifies the token and checks `"cashflow"` is in the `tools` claim before serving protected routes
- If not subscribed: return a 402 or redirect to the Stripe Checkout for Cashflow's product
- Frontend shows "Subscribe" CTA rather than the app when access is denied
- Existing Cashflow users need their subscriptions seeded — decide: grandfather them in free, or require them to subscribe

**What it touches:**  
Shared auth service: JWT issuance · `App/API/` JWT verification middleware · `App/WebUI/src/appState/AuthContext.jsx` · `App/WebUI/src/components/RequiresAuth.jsx` · all protected routes

---

### 6 · Deployed subdomain linkage

**Priority:** 🟠 P2 — High  
**Effort:** 2–3 days  
**Complexity:** Medium  
**Why:** Getting the cookie and redirect flow working across subdomains is a prerequisite to testing the real user journey. Easiest if all tools sit under one parent domain so a single cookie scoped to `.company.com` is readable everywhere.

**What it involves:**
- Register company domain (if not done)
- Set up subdomains: `app.company.com` (Cashflow), `tools.company.com` (landing page), `auth.company.com` (shared service)
- Configure JWT cookies with `Domain=.company.com` so they're shared across subdomains
- Update all CORS, `FRONTEND_URL`, and redirect config on Render for each service
- Test full login-on-landing-page → redirect-to-tool → token-present flow

**What it touches:**  
Render deployment config for all services · DNS / domain registrar · `App/API/backend.py` (cookie domain, CORS) · environment variables

---

### 7 · Free trial support

**Priority:** 🟠 P2 — High  
**Effort:** 2–3 days  
**Complexity:** Medium  
**Why:** Agreed as part of the architecture. Must be decided and built before Cashflow goes to paying users — retrofitting trial logic after real subscriptions exist is messier.

**What it involves:**
- Decide trial length and card-required policy (business decision, not technical — agree before build)
- Pass `trial_period_days` to Stripe Checkout session creation when creating a subscription
- Update webhook handler and subscriptions table to treat `trialing` as `active`
- Optional abuse guard: one trial per verified email (low priority for soft launch but flag for later)

**What it touches:**  
Shared service: Checkout session creation · webhook handler · subscriptions table status logic

---

### 8 · Stripe Customer Portal (self-service)

**Priority:** 🟠 P2 — High  
**Effort:** 1–2 days  
**Complexity:** Low  
**Why:** Without this, users cannot update their card, switch plans, or cancel — everything would need to be handled manually. Stripe provides this for free; it just needs enabling and linking.

**What it involves:**
- Enable Stripe Customer Portal in Stripe dashboard (configure what users can do: cancel, update card, switch plan)
- Add one endpoint to shared service: creates a Stripe portal session and redirects the user there
- Add "Manage subscription" link in Cashflow's account/settings UI
- Portal redirects back to the tool when done

**What it touches:**  
Stripe dashboard · shared service: `routes/billing.py` · Cashflow frontend: account/settings area

---

### 9 · Category list vanishing on "Remember this order"

**Status:** `[x]` Done — 2026-09-17

**Root cause:** `useStackOrder` hydration effect filtered `savedOrder` against `categoryNames` at mount time. `categoryNames` is `[]` on mount (async fetch), so the filter produced `[]` permanently — `effectiveOrder` was always empty after a reload with persist=true. Fix: hydration now sets raw `savedOrder` directly; `effectiveOrder` filters reactively on every render. Also gated both "Remember this order" and "Reset to default" on `isCustomOrder` so neither appears on the default order.

---

### 10 · Bring React Native up to date

**Priority:** 🟠 P2 — High  
**Effort:** 3–5 days  
**Complexity:** Medium  
**Why:** RN is currently behind and untested. Needed before any meaningful mobile testing and before the shared-auth changes (task 1) affect the mobile login flow.

**What it involves:**
- Review all dependencies against Expo SDK 54 docs (`docs.expo.dev/versions/v54.0.0/`)
- Update packages, resolve breaking API changes
- Verify iOS and Android builds are clean
- Check login/logout, upload, charts, and manual review flows still work end-to-end

**What it touches:**  
`App/NativeAppUI/` · `package.json` · Expo config · any Expo API calls (check `App/NativeAppUI/AGENTS.md` warnings)

---

## 🟡 P3 — Medium (Polish · Do After Core Platform Is Stable)

---

### 11 · Dashboard: zero page scroll

**Priority:** 🟡 P3 — Medium  
**Effort:** 0.5–1 day  
**Complexity:** Low  
**Why:** The dashboard should be a single contained screen. Page-level scroll breaks the fixed-height layout and looks unfinished. Includes the legal footer not pushing content outside the viewport.

**What it involves:**
- Audit all elements on the dashboard that could contribute to overflow
- Apply explicit `height` constraints so the layout is fully contained within `100vh`
- Ensure the legal footer sits inside the layout rather than extending the page
- Verify on both desktop and phone mimic

**What it touches:**  
`App/WebUI/src/screens/Dashboard.jsx` · dashboard CSS · `App/WebUI/src/components/Layout.jsx` · `Layout.css`

---

### 12 · Convert footnote box → "User Information" popup

**Priority:** 🟡 P3 — Medium  
**Effort:** 1–2 days  
**Complexity:** Low  
**Why:** The current footnote box is visually cluttered and takes up permanent space. A popup modal is cleaner, more prominent, and consistent with the ℹ pattern already used on the Transactions page.

**What it involves:**
- Remove the existing footnote box from the dashboard
- Add a prominent `ℹ` icon button to the dashboard header/UI
- Clicking it opens a modal labelled "User Information" with the same content
- Modal also surfaces links to the four legal pages (Privacy, Terms, Accessibility, Cookies)
- Style consistent with the existing Transactions info modal

**What it touches:**  
`App/WebUI/src/screens/Dashboard.jsx` · dashboard CSS · `App/WebUI/src/styles/chartFootnote.css` (removed) · `Layout.jsx` pattern reference

---

### 13 · Add "Data Security" popup

**Priority:** 🟡 P3 — Medium  
**Effort:** 1 day  
**Complexity:** Low  
**Why:** Users deserve easy access to the security explainer from within the app. Pairs naturally with the User Information popup (task 12) and uses the already-written `docs/data-security.html` content.

**What it involves:**
- Add a 🔒 lock icon button to the dashboard (near the ℹ button)
- Clicking it opens a modal whose content is drawn from `docs/data-security.html`
- The modal content should be editable by the client without a code change — consider either rendering the HTML file inline or linking to it
- Popup also links to the legal pages

**What it touches:**  
`App/WebUI/src/screens/Dashboard.jsx` · dashboard CSS · `docs/data-security.html`

---

### 14 · Font, size and colour palette audit

**Priority:** 🟡 P3 — Medium  
**Effort:** 2–3 days  
**Complexity:** Medium  
**Why:** Three surfaces (web dashboard, phone mimic, React Native) have diverged over time. Inconsistency looks unpolished and erodes trust, especially as the platform expands to multiple tools.

**What it involves:**
- Document every font family, size, weight, and colour in use across all three surfaces
- Identify mismatches — particularly between the phone mimic (web) and actual React Native
- Agree a single token set as source of truth
- Apply corrections and verify on all three surfaces

**What it touches:**  
`App/WebUI/src/styles/` · `App/NativeAppUI/` styles · phone mimic CSS · potentially a new shared tokens file

---

### 15 · Hard testing — all surfaces

**Priority:** 🟡 P3 — Medium  
**Effort:** 3–5 days  
**Complexity:** Medium  
**Why:** Pre-launch confidence pass. Should happen after the popup work (tasks 12, 13), React Native update (task 10), and dashboard scroll fix (task 11) are complete.

**What it involves:**
- Web dashboard: golden path end-to-end (upload → categorise → manual review → charts)
- Known fragile areas: virtualiser performance, column resize persistence, manual review flush, preferences sync, cold-start spinner
- Phone mimic: full flow at mobile width, all popups, legal pages, back navigation
- React Native: login, upload, charts, manual review, edge cases (empty state, offline, large file)
- Document any failures as new tasks

**What it touches:**  
All surfaces · no code changes expected — this is verification only

---

## 🟢 P4 — Low (Future · Requires Scoping Before Work Begins)

---

### 16 · Full automated test suite

**Priority:** 🟢 P4 — Low  
**Effort:** 2–4 weeks  
**Complexity:** Very High  
**Why last:** No test framework currently exists. This is a significant scoping and tooling decision before a single test is written. Wrong choices here are expensive to undo.

> ⚠️ **Requires explicit owner sign-off on scope before any code is written.**  
> See `context/constraints.md` — no test framework should be introduced without instruction.

**What it involves:**
- Scoping session: agree on unit vs. integration vs. E2E, and which surfaces (web only, RN, API)
- Choose tooling: e.g. Vitest/React Testing Library (web unit), Playwright (E2E web), Detox (RN)
- Agree what "passing suite" means and what CI triggers it
- Write tests progressively: start with the categorisation pipeline and auth routes (highest risk), then UI flows
- Set up CI to run on push to main

**What it touches:**  
Everything — this is a cross-cutting concern across `App/API/`, `App/WebUI/`, and `App/NativeAppUI/`

---

---

## 17 — Owner admin page

**Status:** `[ ]` &nbsp;·&nbsp; **Priority:** 🟢 P4 &nbsp;·&nbsp; **Effort:** 2–3 days &nbsp;·&nbsp; **Complexity:** Medium

A protected web UI page (`/admin`) visible only to the `owner` role (or a configurable high-permission role). Consolidates the admin CLI tools and the test SQL utilities into a point-and-click interface so there's no need to open a DB client or terminal for common owner tasks.

**Scope:**
- Route gated by `role = 'owner'` (or role_id threshold) — non-owners get 404 or redirect
- Sections to include:
  - **Manual review tester** — the `_mr_test_backup` query wrapped in a form: set `n`, pick source categories from a multi-select, flip/restore with one click; shows a table of what changed
  - **Category management** — view/rename/merge categories (currently adminCLI-only)
  - **User management** — view users, toggle roles (owner-only)
  - **DB health** — row counts per table, cache status, last categorisation run
- The existing `App/API/adminCLI/` logic should be extracted into reusable backend route functions that both the CLI and the admin page call — no duplication
- `_mr_test_backup` table must exist (one-time migration in `schema.sql`)

**What it touches:**
`App/API/routes/` (new `admin.py`), `App/WebUI/src/screens/` (new `AdminScreen.jsx`), `App/WebUI/src/components/Layout.jsx` (conditional nav link), `App/API/adminCLI/` (refactor shared logic out)

---

## Dependency Order

```
1 (Auth isolation) ──► 5 (JWT gating) ──► 6 (Subdomain linkage)
                   ──► 3 (Stripe)     ──► 4 (Webhooks) ──► 7 (Trials)
                                                         ──► 8 (Portal)
2 (Landing page) depends on 1 + 6

10 (RN update) ──► 15 (Hard testing)
12 (Info popup) ─┐
13 (Security popup) ─┤──► 11 (No scroll) ──► 15 (Hard testing)
9  (Category bug) ──┘

15 (Hard testing) ──► 16 (Automated tests)
```

---

## Notes

- The shared Auth & Billing Service (tasks 1–8) is a new standalone product, separate from the Cashflow codebase. It will likely live in its own repo.
- Existing Cashflow users need a migration plan when auth is isolated — decide: grandfather them in free, require subscription, or offer a grace period.
- Trial policy (card required vs. not, trial length) is a business decision that must be made before task 7 is built.
- Tasks 12 and 13 (popups) directly reduce task 11's scope — do them first.
- Task 16 (automated testing) needs a scoping conversation before any implementation begins.
