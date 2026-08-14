# What Changed — Evalora Update

This update adds a persisted, shared recruiter workspace on top of the existing ranking dashboard. Nothing in the original ranking engine, ATS Analyzer, or AI Copilot was altered — this is purely additive.

## New features

1. **Team Sync** — recruiter decisions (Shortlist/Needs review/Rejected + notes) can now be pushed from the browser's local board to a shared, database-backed board, so every recruiter viewing the app sees the same state.
2. **Talent Pools** — named, reusable candidate shortlists (e.g. "Final round," "Backup bench"), independent of the shortlist/review/reject status.
3. **Analytics Dashboard** — a new section showing pipeline funnel, score distribution, top skills/locations, risk-flag frequency, and average score per ranking component, computed live from the ranked pool and current decisions.
4. **Activity Log** — an audit trail of every decision change, pool edit, AI Copilot call, ATS analysis, and export.
5. **Shortlist Export** — one-click CSV download of the shared decision board (candidate, title, location, score, status, tags, notes) for handoff to hiring managers, with an optional status filter.

## New files

- `recruiter/models.py` — added `CandidateDecision`, `TalentPool`, `ActivityLog` models
- `recruiter/migrations/0001_initial.py` — migration creating the three new tables
- `recruiter/static/recruiter/js/team.js` — new, self-contained JS module powering Analytics, Team Sync, Talent Pools, and the Activity Log. Deliberately separate from `dashboard.js` so the original local decision board is untouched.
- `wiki/*.md` — five wiki pages ready to paste into the GitHub repo's Wiki (Home, Architecture, Feature Guide, API Reference, Setup & Configuration)

## Modified files

- `recruiter/admin.py` — registered the three new models for `/admin/`
- `recruiter/services.py` — added decision/pool/analytics/activity/export service functions (existing ranking logic untouched)
- `recruiter/views.py` — added the new API endpoints (existing endpoints untouched, only wrapped with activity logging)
- `recruiter/urls.py` — added routes for the new endpoints
- `recruiter/templates/recruiter/dashboard.html` — added "Analytics" and "Team Sync" sections plus nav links, and an export button in the Workflow section
- `recruiter/static/recruiter/css/dashboard.css` — added styling for the new sections, reusing the existing design system's variables and component patterns (bars, chips, panels)
- `README.md` — documents all new features, the extended API reference, and the new data model

## New API endpoints

```
GET    /api/decisions/
POST   /api/decisions/save/
DELETE /api/decisions/<candidate_id>/
GET    /api/pools/
POST   /api/pools/create/
POST   /api/pools/<pool_id>/members/
DELETE /api/pools/<pool_id>/
GET    /api/analytics/
GET    /api/activity/
GET    /api/export/shortlist/
GET    /download/shortlist-report/
```

Full request/response shapes are in `wiki/API-Reference.md`.

## How this was verified

- `python manage.py makemigrations --check` — confirmed no missing migrations
- `python manage.py migrate` — confirmed all three new tables create cleanly on SQLite
- `python manage.py check` — no system check issues
- Every new endpoint was hit with `curl` against a live dev server and returned `200` (decisions save/list/delete, pools create/members/delete, analytics, activity, export JSON and CSV download)
- `node --check` on `team.js` and `dashboard.js` — both syntactically valid
- HTML tag balance check on `dashboard.html` — `<section>`/`</section>` counts match, all new element IDs are unique

## Applying this update to your local clone

1. Copy the files in this package into your local `Evalora/` checkout, preserving the folder structure (`recruiter/models.py`, `recruiter/migrations/0001_initial.py`, etc.)
2. Run `python manage.py migrate` to create the new tables
3. Run `python manage.py runserver` as usual — the new "Analytics" and "Team Sync" nav links will appear in the dashboard
4. Copy the contents of `wiki/*.md` into your GitHub repository's Wiki (Settings → Wikis, or directly via the Wiki tab → New Page), matching each file name to the page title
