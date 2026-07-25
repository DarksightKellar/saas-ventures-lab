# SaaS Ventures Lab — README

A self-contained experimentation engine for finding a winning SaaS by iterating fast: 10
validated, sub-2-week SaaS ideas, each run through a RESEARCH → POC → WAITLIST → BUILD / KILLED
pipeline, managed from one modern dashboard.

- **Zero dependencies.** Pure Node.js stdlib. No `npm install`, no API keys, runs offline.
- **Manager dashboard** at `/` — KPIs, pipeline funnel, risk/auto-cancel monitor, live waitlist
  feed, an editable Studio identity, and a **real working SubTrack prototype**, plus per-project
  cards with search/filter/sort, inline editing, and an edit modal.
- **Public waitlist pages** at `/waitlist/:slug` — real email-capture landing pages.
- **Auto-pilot:** a project flips to BUILD the moment its waitlist crosses the threshold; the
  decision engine flags KILL when the deadline passes with marketing done but target missed.

## Run it

```bash
cd saas-ventures-lab
node server.js            # serves http://localhost:8787
# or in the background:
node server.js &
```

Open:
- Dashboard:        http://localhost:8787/
- A waitlist page:  http://localhost:8787/waitlist/subtrack
- Raw data:         http://localhost:8787/api/projects

## The pipeline (per project)

```
RESEARCH → POC → WAITLIST → BUILD
                   ↓ (deadline + marketing, under target)
                 KILLED
```

- **RESEARCH** — pain validated from real demand signals (see `data/projects.json` evidence).
- **POC** — build a proof of concept + draft social posts + launch the waitlist.
- **WAITLIST** — collect signups. When `signups >= waitlist_target` → **auto-flips to BUILD**.
- **BUILD** — green-lit; start building the real software.
- **KILLED** — if `now - poc_launched_at > decision_deadline_days` AND `signups < target` AND
  `marketing_posts_published >= 3` → flagged for KILL. (Marketing incomplete → not killed.)

## Dashboard controls

- **▶ Advance** — move RESEARCH→POC→WAITLIST→BUILD manually.
- **📣 Mark post live** — increment `marketing_posts_published` (counts toward the kill gate).
- **Distribution tab** (per card) — mark a channel posted **from the studio identity** (Reddit,
  Indie Hackers, LinkedIn, Product Hunt, etc.). Each mark increments the marketing gate and is
  logged studio-sourced. **Personal accounts are never used.**
- **＋ Simulate 10** — add 10 demo signups (to watch the funnel flip a project to BUILD).
- **🔗 Waitlist page** — open the live waitlist landing page in a new tab.
- **✕ Kill** — manually mark KILLED.
- **Run auto-cancel check** — calls `/api/tick` and shows which projects are flagged.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/projects` | All projects (dashboard source) |
| POST | `/api/signup` | Record a waitlist signup `{slug,name,email,channel}` |
| POST | `/api/projects/:id/advance` | Step status forward |
| POST | `/api/projects/:id/cancel` | Mark KILLED `{reason}` |
| POST | `/api/projects/:id/simulate` | Dev: add `n` signups `{n}` |
| POST | `/api/projects/:id/publish` | Increment marketing post count |
| POST | `/api/projects/:id/post` | Mark a distribution channel posted (studio identity) |
| GET  | `/api/studio` | Studio identity (name, handle, founder, policy) |
| PUT  | `/api/studio` | Edit studio identity (persisted) |
| GET  | `/api/waitlist` | Live signup feed (total + recent) |
| POST | `/api/projects/:id/update` | Persist editable fields (target, tagline, status, …) |
| POST | `/api/projects/:id/clear` | Reset this project's waitlist to zero |

## Test

```bash
node test.js     # 29-assertion in-process integration suite (no network needed)
```

The test drives the **real** request handler through every route using fake req/res objects, so
it verifies the same code the live endpoints run. (Note: localhost egress is blocked in the build
environment, so live port checks use this in-process harness instead.)

## Files

```
saas-ventures-lab/
├── server.js              # zero-dep Node server + pipeline engine
├── test.js                # in-process integration test (38 assertions)
├── data/
│   ├── projects.json      # the 10 seeded experiments (evidence, WTP, targets, posts, distribution)
│   ├── studio.json        # studio identity + separation policy
│   └── waitlists.json     # live signup store
├── public/
│   ├── index.html         # modern manager dashboard v2 (interactive, no CDN)
│   └── waitlist.html      # public waitlist landing page
├── RESEARCH_REPORT.md     # full evidence + sources + WTP per idea
├── STUDIO_LAUNCH_COPY.md  # @leverwrightlabs identity + launch posts + posting rules
├── OPERATIONS_LOG.md      # compression-proof master log (goal, SOP, decisions, status)
└── README.md
```

## Separation policy (personal vs studio)

Kelvin keeps his **personal** social accounts out of these experiments. All validation posts,
replies, and outreach go out under one deliberate **studio identity** (Leverwright Labs,
`@leverwrightlabs`) — defined in `data/studio.json`. For B2B ideas the founder is credited as a
visible-but-branded face; for consumer ideas the studio speaks alone. **No code path posts from
or touches personal credentials** — the dashboard only drafts posts (Copy buttons) and the
Distribution tab marks channels posted (manually) from the studio account. This avoids the trap of
validating from a zero-reach throwaway account, which would falsely trigger auto-kill on good ideas.

## Add a project

Append an object to `data/projects.json` following the existing schema
(`id, slug, rank, name, tagline, category, status, pain_summary, target_audience,
willingness_to_pay, evidence_quotes[], sources[], poc_scope, build_time_weeks,
waitlist_target, decision_deadline_days, marketing_required_posts, signups,
signups_by_channel, marketing_posts_published, social_posts[], distribution{owner,channels,cadence,posted,policy},
created_at, poc_launched_at, notes`). The dashboard picks it up on next refresh.
