<!-- last-verified: eb0073b 2026-09-23 -->
# Auth & Platform Architecture — Design Document

**Session:** 2026-09-21  
**Status:** Discussion complete — agreed design, not yet implemented

---

## 1. Platform Vision

Cashflow2.0 is being evolved into a **multi-tool platform**. The repo will be renamed to the platform name. Auth lives at the platform level, not inside any individual tool.

```
Landing Page  (platform root)
    ↓
One Auth System  (login / signup / OAuth / billing)
    ↓
Workspace / tool selector
    ├── Cashflow  (current App/ → tools/cashflow/)
    ├── Tool 2   (future)
    └── ...
```

**Repo structure (target):**
```
/
├── landing/          ← landing page + auth UI
├── tools/
│   ├── cashflow/     ← current App/ moves here
│   └── ...
└── shared/           ← auth logic, shared types, common utils
```

**One monorepo** — not separate repos per tool. Rationale: one person, one CI/CD pipeline, shared auth code not duplicated, scales without coordination overhead until there are separate teams.

---

## 2. Identity Model

### Login credential
- **Email address** — primary identifier, used to log in
- **Display name** — optional, user-settable, used in UI ("Welcome, Armaan"), not for auth
- Current `username` column → migrate as `display_name` for existing users

### Users table additions
```sql
ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN oauth_provider TEXT;   -- 'google', 'microsoft', null
ALTER TABLE users ADD COLUMN oauth_sub TEXT;         -- provider's user ID
-- password_hash becomes nullable (OAuth-only users have no password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'none';
                                               -- 'none','trialing','active','past_due','canceled'
```

### Existing users
- Soft migration: `email` column nullable — existing accounts unaffected
- On first profile visit, user is prompted to add an email (verified via confirmation link)
- No forced migration / no blocking redirect at login — gradual

---

## 3. Profile UI

### Click target in header (top-right, always present)
- User has a role badge (admin/owner) → badge is clickable
- Regular `user` role (no badge) → generic avatar icon (circle head + shoulder arc SVG), same size/position as a badge
- Constraint preserved: owner badge stays top-right per existing hard constraint

### Profile popup (on click)
Small card anchored to the click target:
- Display name, email, role
- "Edit Profile" → navigates to `/profile`
- "Logout" quick action

### Profile page (`/profile`)
Full page, themed, back button top-left. Sections:
- **Display name** — editable, saves immediately
- **Email** — shows current verified email; "Add email" if none; "Change email" opens re-verification flow
- **Password** — change password (requires current password; OAuth-only users shown info message)
- **Danger zone** — Delete account (bottom of page)

---

## 4. Email Sending

### Method
Python `smtplib` (stdlib — no third-party SDK) via **Gmail SMTP**:
- `smtp.gmail.com:465` (SSL)
- One Gmail account owned by the platform (e.g. `noreply@...`)
- Gmail App Password stored in `.env` as `SMTP_PASSWORD` (requires 2FA enabled on the Gmail account, then generate App Password under Google Account → Security → App Passwords)
- Users never see or interact with this account; it is purely a dispatch pipe

### `.env` additions
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=yourapp@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
```

### Rate limiting
- Route-level: new `RL_AUTH_EMAIL_*` constants in `rate_limits.py` (per-endpoint, toggleable)
- Per-user cooldown: `last_email_sent_at` column on `users` — enforced in route logic (e.g. 60s minimum between requests)
- Gmail hard cap: ~500 emails/day (backstop, not primary guard)

### Flows that send email
1. **Email verification** — on add/change email: signed time-limited token in link → `POST /auth/verify-email?token=...`
2. **Password reset** — "Forgot password": signed token → `POST /auth/reset-password` with token + new password
3. **Welcome email** — on first confirmed sign-in (optional, low priority)

### Token approach
Short-lived JWT (15 min expiry) containing `user_id` + `new_email` + `action` — no extra DB table needed. On use: decode, verify not expired, verify `action` matches endpoint, save email, mark verified, invalidate by checking `iat` against a `last_token_used_at` timestamp.

---

## 5. OAuth — Google & Microsoft

### Scope
- **Google:** personal (`@gmail.com`) + Google Workspace (`@company.com`) — both via same flow
- **Microsoft:** personal (`@outlook.com`, `@hotmail.com`) + Microsoft 365 / Entra work accounts — use `/common` tenant endpoint to accept both
- **Cost:** free for both providers

### Flow (identical for both providers)
1. User clicks "Sign in with Google/Microsoft" → redirect to `/auth/google` or `/auth/microsoft`
2. Backend redirects to provider consent page
3. Provider redirects back to `/auth/google/callback` (or `/microsoft/callback`) with a `code`
4. Backend exchanges `code` for `id_token` via provider's token endpoint
5. Decode `id_token` → extract `email`, `name`, provider `sub` (user ID)
6. DB lookup on email:
   - Match found → log in, issue JWT
   - No match → create user row (`oauth_provider`, `oauth_sub`, `email`, `email_verified=true`), log in
7. Issue JWT as normal — session from here is identical to email/password login

### Setup (one-time, per provider)
**Google:**
- Google Cloud Console → create project → enable OAuth → OAuth credentials → `CLIENT_ID` + `CLIENT_SECRET`
- Redirect URI: `https://yourapp.com/auth/google/callback`
- Cost: free

**Microsoft:**
- Azure Portal → App registrations → register app → `CLIENT_ID` + `CLIENT_SECRET` + tenant = `common`
- Redirect URI: `https://yourapp.com/auth/microsoft/callback`
- Cost: free

### Library
`authlib` (Python) — handles code exchange, token decoding, provider configs for both providers

### `.env` additions
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```

### React Native
RN OAuth is parked — different mechanism (device native browser / provider SDK). Will need updating when RN is brought up to date (task 10). Note when implementing: RN uses a different redirect URI scheme (`cashflow://auth/callback`) and needs `expo-auth-session` or similar.

---

## 6. Stripe Billing

### Model
- **Per-tool gating** — each tool has its own subscription; a user can be on free for Cashflow but paying for Tool 2
- **Free trial** — configurable by platform owner: trial length, card-required or not, per-user or global
- **Admin-configurable** — gates and trial terms adjustable without a code deploy (DB config or owner admin page)
- **No paywall on the whole platform** — individual tools are gated, not the auth layer itself

### Stripe setup
- One Stripe account for the platform
- One Stripe Product + Price per tool (e.g. "Cashflow — Monthly")
- `stripe_customer_id` stored on `users` row (created at signup)
- `subscription_status` column: `none` | `trialing` | `active` | `past_due` | `canceled`

### Subscriptions table
```sql
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_id TEXT NOT NULL,                          -- 'cashflow', 'tool2', etc.
    stripe_subscription_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'none',
    current_period_end TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Webhook endpoint (`POST /stripe/webhook`)
Handles events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Verify Stripe signature before processing (`stripe.Webhook.construct_event`)
- Update `subscriptions` table on each event
- `trialing` treated same as `active` for access checks

### Feature gating
- JWT payload includes `tools` claim: list of tool IDs with `active`/`trialing` subscription
- Each tool's backend verifies its own ID is in `tools` claim
- Free tier / trial: controlled via `subscription_status`; specific feature limits configurable in DB

### Cost
Stripe takes ~2.9% + 30¢ per transaction. No monthly platform fee.

---

## 7. Security Controls (DB-driven)

Columns on `users` (or `user_security` companion table), flippable via DB or owner admin page (task 17) without a code change:

| Column | Type | Purpose |
|---|---|---|
| `login_locked` | `boolean` | Manually lock account — login rejected regardless of password |
| `failed_attempts` | `integer` | Counter incremented on bad password; reset on success |
| `locked_until` | `timestamptz` | Auto-lock expiry — account unlocks automatically |
| `max_attempts` | `integer` | Per-user override for lockout threshold (null = global default) |
| `require_password_reset` | `boolean` | Force password reset on next login |
| `oauth_only` | `boolean` | Disallow password login — OAuth sign-in only |

**Lockout logic:**
1. Failed password → increment `failed_attempts`; if threshold hit → set `locked_until = now() + duration`
2. Login attempt → if `login_locked = true` OR `locked_until > now()` → reject (don't leak account existence)
3. Successful login → reset `failed_attempts = 0`, clear `locked_until`
4. Global defaults (threshold, duration) in `config` table or env; individual overrides via `max_attempts`

---

## 8. Isolation Audit (Required Before Launch)

Before any paying users, every DB query touching `transactions`, `categorized_records`, `uploads`, `preferences` must be confirmed to filter by the JWT identity's `user_id`. A dedicated audit pass is needed:
- Review all route files in `App/API/routes/`
- Confirm `scope='global'` categorized_records are intentionally shared (not a leak)
- Confirm admin routes are gated behind roles/permissions system

---

## 9. Agreed Implementation Order

```
0. Repo rename propagation                                ← owner renames repo on GitHub;
                                                            Claude then updates all hardcoded
                                                            references throughout codebase
                                                            (package.json, render config,
                                                            CORS origins, README, any
                                                            github.com URLs in docs/code)
0b. Fix rename breakages                                  ← after GitHub rename, update the
                                                            3 source files and 4 tooling/docs
                                                            files that hardcode the old name:
                                                            · App/WebUI/vite.config.js (base path)
                                                            · App/WebUI/src/App.jsx (router basename)
                                                            · App/WebUI/public/404.html (SPA redirect)
                                                            · context/gitContext.md (remote URL)
                                                            · .ai/rebuild_db.py (remote URL in seed)
                                                            · App/handoffFiles/chatLog.txt (link)
                                                            · App/handoffFiles/10_web-migration.txt
                                                            Run sync_context.py after doc updates.
                                                            Verify GitHub Pages build still works.
1. Email migration (schema + auth routes + login UI)       ← prerequisite for everything
2. Gmail SMTP setup + email sending module                 ← prerequisite for verify + reset
3. Email verification flow                                 ← prerequisite for trusted emails
4. Password reset flow                                     ← pairs with SMTP setup
5. Profile UI (popup + /profile page)                     ← now has full data to display
6. Isolation audit                                        ← safety before more users
7. Google OAuth                                           ← highest demand social login
8. Microsoft OAuth                                        ← same code path, low marginal effort
9. Stripe billing + webhooks + feature gating             ← last, depends on all above
10. Free trial config                                     ← part of Stripe setup
```

---

## 10. Open Questions / Decisions Not Yet Made

- Platform / company name (for repo rename, domain, Stripe account)
- Gmail address to use for sending (`noreply@...`)
- Stripe tier model specifics: what does free tier allow vs paid per tool? Upload limits? Feature limits?
- Trial length and whether card is required for trial
- Whether existing Cashflow users are grandfathered in free or required to subscribe
- Domain name (needed for OAuth redirect URIs and subdomain linkage)
