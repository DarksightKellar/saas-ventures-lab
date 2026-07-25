# 2026-07-22 — Implementation Plan (pick up next session)

## Context
User validated the dashboard and waitlist basics, then requested a significant visual +
structural overhaul. Rather than rush implementation in a bloated session, this plan
captures every requirement so the next session starts implementation from a clean slate.

Server: `cd /Users/kellar/saas-ventures-lab && node server.js` → localhost:8787.
Ngrok: `ngrok http 8787` → `https://blessed-honeybee-profound.ngrok-free.app`.
Formspree: `FORMSPREE_SETUP.md` has claim URLs. Free tier = 50 subs/month, no API.

## Bug fix (DONE)
- waitlist.html line 109: `var PROJECT = /*__PROJECT_JSON__*/ null;` had a space between
  the JSON and `null`, producing invalid JS after injection. Fixed to `/*__PROJECT_JSON__*/null`.
  Server restarted, verified working via curl.

## Implementation Plan (all items from user's 2026-07-22 message)

### P0 — Waitlist page redesign (public/waitlist.html)
Goal: transform from generic form into a modern SaaS landing page with studio branding.
Sections (top to bottom):
1. **Studio header**: "Leverwright Labs" with link to dashboard (or studio site). Consistent
   across all 10 waitlist pages.
2. **Hero section**: Project name + tagline. Clean, no emojis. Large type, gradient accent.
3. **Signup form**: name, email, channel dropdown. Same Formspree dual-submit logic preserved.
4. **Evidence / Why This section**: Boil down the research — 2-3 bullet quotes from
   evidence_quotes[], source links, "we found X threads of people complaining about Y."
   Pull from pain_summary + sources array.
5. **Product section**: What we're building — tagline, POC scope, desired pricing,
   target audience. Pull from project fields.
6. **Process section**: Explains the 30/45-day decision window. "We give this experiment
   X days and need Y founding members before we commit to building. Join to vote."
   Pull from waitlist_target + decision_deadline_days.
7. **Footer**: Link to studio. Consistent across all pages.

Server: the waitlist handler already injects PROJECT JSON. Ensure new project fields
(desired_pricing, waitlist_link) are present in the injected data.

### P0 — Dashboard data model additions (data/projects.json + server.js + public/index.html)
Add to every project object:
- `"desired_pricing"`: string (e.g. "$19-39/month")
- `"waitlist_link"`: string (external Netlify/ngrok URL; empty = fall back to /waitlist/:slug)
- `"posted_at"`: object, e.g. `{"Reddit":"https://reddit.com/...","Indie Hackers":"https://..."}` —
  per-channel URLs to the actual posts/threads. Empty by default.

Server changes:
- Add desired_pricing and waitlist_link to the seed data for all 10 projects.
- Add `posted_at` field to distribution object (empty initially).
- Ensure these fields survive the update endpoint's editable-keys list.
- No new endpoints needed; existing GET/POST /api/projects/:id/update handles them.

Dashboard changes:
- Card meta row: show `desired_pricing` as a chip. Show `waitlist_link` as a clickable chip
  that opens the external URL. Show `posted_at` entries in the Distribution tab (each channel
  that has a posted URL shows it as a link).
- "🔗 Waitlist" button → opens `waitlist_link` if set, else falls back to `/waitlist/:slug`.
- `[LINK]` in social_posts copy: replace with `waitlist_link` before display. If no link set,
  replace with `/waitlist/:slug` (the local fallback).

### P0 — Shared notes file (data/notes.json + server.js + public/index.html)
- New file: `data/notes.json` → `{"content":"","updated_at":""}`
- Server endpoints:
  - `GET /api/notes` → returns {content, updated_at}
  - `POST /api/notes` → body {content} → saves, returns {ok, updated_at}
- Dashboard: textarea below the studio banner (or above the grid), labeled "Shared notes
  (all projects)", with a "Save notes" button. Auto-loads on refresh.

### P0 — Decision engine page (public/decide.html + server.js)
- Server: `GET /decide` → serves public/decide.html
- The page aggregates:
  - All project statuses, signup counts, deadlines, and notes
  - Shared notes from data/notes.json
  - Market data from each project's pain_summary + evidence
  - Computes: for each active project, GO (threshold met / trending well) or NO-GO
    (deadline passed with marketing done but target missed) with a one-paragraph reasoning.
  - Outputs a clean report: project name | status | signups | days left | verdict | reasoning.
- No new API needed; the page can fetch `/api/projects` + `/api/notes` and compute client-side.

### P1 — Unique signup links
- When a signup comes through `/api/signup`, generate a `source_link` field on the record:
  the URL of the waitlist page (from the Referer header, or construct from known base + slug).
  Store in waitlists.json record.
- Dashboard live feed: show the source_link next to each signup entry.
- This lets the user trace which waitlist page URL produced each signup (local vs ngrok vs
  Netlify).

### P1 — Visual cohesion (dashboard + waitlist)
- Dashboard: apply the same gradient background + glassmorphism aesthetic as the waitlist page.
  Already mostly there; ensure KPI cards, risk panel, and card styling use consistent colors
  and border-radius.
- Waitlist page: use the same CSS variables and design language as the dashboard.
- Studio identity: center it on BOTH pages. On the dashboard, move the studio card to a
  centered banner between the header and the KPIs. On the waitlist page, add a small
  centered studio header above the hero.

### P2 — Formspree API import (only if user upgrades to Professional)
- If FORMSPREE_API_KEY env var is set, add `POST /api/import/formspree` that fetches
  submissions from Formspree's API and deduplicates against existing waitlist records.
- Call it from a dashboard button ("Import from Formspree").
- Requires Professional plan ($20/mo annual). Not implementing unless user asks.

### Doc updates
- RESEARCH_REPORT.md: add desired_pricing, waitlist_link, posted_at fields to each project
  entry if not present.
- OPERATIONS_LOG.md: append this plan + session summary.
- README.md: update API table (add /api/notes, /decide), Files section (add decide.html,
  notes.json), test count, mention new fields.

### Test updates
- Add assertions for: GET/POST /api/notes, GET /decide responds 200, waitlist_link fallback
  in social copy replacement, source_link on signup record, new fields survive update endpoint.
- Target: 45+ assertions.

### Verification
- `node test.js` must pass all.
- `curl http://localhost:8787/waitlist/subtrack | grep SubTrack` confirms injection.
- Browser: open dashboard → studio banner centered, new fields visible, notes textarea works.
  Open /decide → decision report renders.
  Open waitlist page → all 7 sections present, studio header + footer visible.

## Session state at handoff
- Server running: pid 87094, port 8787.
- Tests: 38/38 pass (the PROJECT null fix doesn't break any existing tests).
- Files modified this session: waitlist.html (null fix), OPERATIONS_LOG.md (this plan).
- Key files to reference: RESEARCH_REPORT.md, STUDIO_LAUNCH_COPY.md, DEPLOY.md, FORMSPREE_SETUP.md.
