# Cashflow2.0

Personal-finance transaction tracker: users upload bank statement CSV/Excel files, a Flask + Postgres (Supabase) backend runs them through a tiered auto-categorization pipeline (exact match → merchant match → fuzzy similarity → Gemini LLM → manual review fallback), and a React (Vite) web app plus an Expo/React Native mobile app render category-based spending charts and a searchable transaction table. There is no ORM (raw SQL via psycopg2) and no automated test suite; the web and mobile frontends share a small `App/shared/` utils module and otherwise duplicate logic per platform.

For full architecture, tech stack, data flow, file structure, and known rough edges, see [context/handoff.md](context/handoff.md) — read only the specific section you need, not the whole file, unless doing broad onboarding.

Do not read `context/overview.html` unless explicitly told to. It's a client/developer progress-report artifact, not coding context, and should only be updated at the end of a substantial task, when asked.

## Updating the docs

`context/overview.html` is developer/client-facing and follows a milestone structure: a sidebar table of contents, a "Since the last major change" section at the top for incremental work, and older content grouped under "Major change" sections below it, newest first. Small refinements get added to the top section instead of editing older milestone text.

When a change is substantial enough to count as its own milestone: promote the existing "Since the last major change" section in place — relabel it "Major change: ", move it down to sit right above the previous top-most "Major change" section (keeping newest-first order), and update its anchor/TOC entry. Then open a new, empty "Since the last major change" section at the top for whatever comes next. Never create a second parallel section and copy content into it — the existing section itself gets relabeled and repositioned.

`context/handoff.md` can follow its own structure loosely — strict adherence isn't required there, since it's Claude-facing context and having the information present matters more than the shape it's in.
