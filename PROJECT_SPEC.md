# JalSuraksha Nepal — Project Specification

> **Know the Risk. Find Safety. Get Help.**
>
> This document is the source of truth for the project. Read it before any major
> change; update it in the same commit when a decision changes.

---

## 1. Objective

Build a polished, production-style **flood emergency response and evacuation
platform** for Nepal as a single-developer hackathon MVP. It turns flood
warnings and community reports into coordinated action: evacuation routes,
shelter placement, SOS intake, operator triage and rescue dispatch, with live
status shared between citizens, operators and rescue teams.

## 2. Problem statement

Every monsoon (June–September), riverine and flash floods in the Terai and
inner-Terai basins (Narayani, Koshi, Karnali, Rapti, Bagmati) displace
thousands of households. Warnings exist (DHM river-level and rainfall
bulletins, SMS early warnings), but **a warning alone does not coordinate
evacuation and rescue**:

- Citizens know "the river is rising" but not *which road is still safe* or
  *which shelter has space*.
- Requests for help arrive by phone calls and social media, unstructured and
  unprioritised.
- Emergency operators lack one live picture of incidents, teams and shelters.
- Rescue teams get assignments by phone and status is not shared back.

## 3. Solution

One web platform (mobile citizen app + desktop operations centre + rescue
team view) sharing one live database:

| Know the Risk | Find Safety | Get Help |
|---|---|---|
| Alerts, transparent rule-based flood-risk score, live hazard map | Nearest shelter with capacity, hazard-aware evacuation route that re-routes when a road is blocked | One-tap SOS without login, transparent priority recommendation, operator dispatch, live rescue status |

## 4. Technology stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Single codebase; `proxy.ts` (formerly middleware) for session refresh |
| UI | React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Lucide | Design tokens in `app/globals.css` |
| Forms / validation | React Hook Form + Zod | Same Zod schemas on client and server |
| Data | Supabase PostgreSQL | SQL migrations in `supabase/migrations` |
| Auth | Supabase Auth | Phone OTP (citizens), email/password (staff), anonymous sessions (guest SOS) |
| Realtime | Supabase Realtime `postgres_changes` + one public broadcast topic | RLS-filtered per subscriber; `public:visibility` announces rows that stop being public |
| Files | Supabase Storage | `sos-photos` (private), `hazard-photos` (public) |
| Maps | Leaflet + react-leaflet + OpenStreetMap tiles | Lazy-loaded client-only |
| Live hydro-met data | DHM (hydrology.gov.np) gauges and rain stations via the BIPAD portal API | `lib/hydromet/*`; synced into `hydromet_stations` (lazy `after()` every 10 min, or `/api/hydromet/sync` from a scheduler) |
| Reference data | BIPAD portal (facilities), OpenStreetMap via Overpass (wards, community buildings) | `npm run data:import`; see `docs/REAL_DATA.md` |
| Routing | Self-hosted Valhalla on the OpenStreetMap Nepal extract | `docker-compose.routing.yml`, `VALHALLA_URL`; offline demo network as fallback |
| Charts | Recharts | Operations analytics |
| Tests | Vitest | Pure business logic |
| Hosting | Vercel | |

No Redux, no second frontend framework, no separate backend repository.

## 5. User roles

Role is stored in `public.profiles.role` and **only** read from the database
(never from client input or user-editable JWT metadata).

| Role | Auth | Capabilities |
|---|---|---|
| `citizen` | Phone OTP (+977) or anonymous (guest SOS) | View alerts, risk map, shelters, safe route; send SOS; report & confirm hazards; track own SOS; set family safety status |
| `operator` | Email/password | Operations dashboard; view all SOS; acknowledge; assign teams; override priority; record a team's progress reported by radio/phone (same transitions as the rescue console, logged as the operator); resolve; manage shelters occupancy; review hazards; publish alerts |
| `rescue` | Email/password, linked to one `rescue_teams` row | View own team's assignments; accept; update status (en route → arrived → in progress → completed) |
| `admin` | Email/password | Everything an operator can do + manage users' roles, rescue teams, shelters, alerts, demo reset |

Guest SOS: pressing **EMERGENCY SOS** never requires an account. The client
silently creates an anonymous Supabase session (if enabled, 5 s time limit) so
the person can receive realtime updates; a secret tracking token + 6 s polling
is the fallback, and the UI only says "live" when realtime can actually
deliver. Anonymous sessions can **only** own their SOS — they cannot post or
confirm hazard reports (`is_permanent_user()` in RLS).

Phone OTP: Supabase phone auth. Supabase generates and verifies the code; the
"Send SMS" auth hook (`/api/auth/send-sms`, Standard Webhooks signature with
`SEND_SMS_HOOK_SECRET`) delivers it: real SMS through Twilio when `TWILIO_*` is
set; in development only, the code is printed to the dev-server terminal (never
shown in the app, never in production builds); otherwise sign-in fails with an
honest message. The login screen states which mode is active, and in demo mode
also points to the labelled fallbacks (test number `9800000001` / code
`123456`, or the "Citizen Demo" button). SMS delivery is never faked to the
user.

## 6. Architecture

```
Browser (citizen phone / operator desktop / rescue tablet)
  │  React Server Components + Client Components
  │  Supabase JS (browser)  ── Realtime websocket (RLS-filtered) ──┐
  ▼                                                               │
Next.js on Vercel                                                 │
  ├─ proxy.ts ─ refreshes auth cookie, optimistic route gating    │
  ├─ Server Components ─ read via Supabase server client (user's  │
  │                      JWT → RLS applies)                        │
  ├─ Server Actions ─ mutations via user's JWT → RLS / RPC checks │
  └─ Route Handlers /api/*                                         │
       ├─ POST /api/sos         guest-capable, Zod, rate-limited,  │
       │                        uses service key server-side only  │
       ├─ GET  /api/sos/track   token-based status fallback        │
       ├─ GET  /api/health      public ok flag; staff readiness    │
       ├─ POST /api/sos/cancel  guest "I am safe now" (token)      │
       ├─ POST /api/uploads     type/size-validated photo upload   │
       ├─ GET  /api/public/snapshot  offline cache payload         │
       ├─ POST /api/sms/inbound future SMS gateway (secret-gated)  │
       └─ POST /api/demo/*      presentation controls (staff only) │
  ▼                                                               │
Supabase: Postgres (+RLS, SECURITY DEFINER workflow functions) ───┘
          Auth, Storage, Realtime publication
```

Workflow state changes (assign, status updates, overrides, resolve) run in
**Postgres functions** (`public.assign_rescue_team`, `public.update_assignment_status`,
…) that check the caller's role and validate state transitions atomically and
write `incident_status_history`. The same transition table exists in
`lib/utilities/status.ts` for UI and tests.

### Folder structure

```
app/
  (marketing) landing page        app/page.tsx
  auth/                           login (phone OTP / staff / demo), signout
  citizen/                        mobile app: home, map, sos, route, report, profile
  dashboard/                      operations centre: overview, incidents, shelters,
                                  hazards, teams, alerts, users (admin), demo
  rescue/                         rescue team console
  api/                            route handlers
components/
  alerts/ dashboard/ map/ rescue/ shelter/ sos/ ui/ (shadcn) + shared/
lib/
  auth/           session + role helpers, authorization guards
  supabase/       browser/server/admin clients, env
  risk-engine/    flood risk score, SOS priority score
  routing/        hazard-aware evacuation routing over a demo road graph
  services/       SOS intake, demo reset, SMS parser (server-side services)
  validation/     Zod schemas
  utilities/      geo, status transitions, formatting, sms parser
  demo/           demo scenario constants
types/            database + domain types
supabase/
  migrations/     schema, RLS, functions, realtime, storage
  seed.sql        demo data (labelled simulated)
docs/             architecture, demo script, deployment notes
scripts/          create-demo-users.ts
public/           PWA icons, service worker
```

## 7. Database architecture

All tables: `uuid` primary keys (`gen_random_uuid()`), `created_at`/`updated_at`
timestamps (trigger-maintained), foreign keys, indexes on filter columns, RLS
enabled. Demo rows carry `is_demo = true` and/or `source_type = 'simulated'`.

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | 1:1 with `auth.users` | phone, full_name, role, district, municipality, ward, emergency_contact, safety_status, rescue_team_id |
| `alerts` | Flood alerts | title, description, severity, district, municipality, river_basin, source, source_type, is_active, expires_at |
| `risk_zones` | Areas scored by the risk engine | name, polygon (jsonb `[lat,lng][]`), centre, river_level_m, warning_level_m, danger_level_m, rainfall_mm_24h, distance_to_river_m, elevation_vulnerability, road_access_reduction |
| `shelters` | Evacuation shelters | address, lat/lng, capacity, current_occupancy, food/water status, medical_assistance, contact, is_active |
| `hazard_reports` | Community hazards | type, severity, lat/lng, description, photo_url, status, confirmation_count, duplicate_of |
| `hazard_confirmations` | One confirmation per user per report | report_id, user_id (unique pair) |
| `rescue_teams` | Dispatchable teams | call_sign (R-03), status, personnel_count, equipment[], lat/lng |
| `sos_requests` | SOS incidents | reference_code (SOS-NEP-1234), user_id?, phone, lat/lng, people/children/elderly counts, injured, situation, priority_score, priority_level, priority_factors, operator_priority_override, effective_priority (generated), status, assigned_team_id, tracking_token |
| `rescue_assignments` | SOS ↔ team dispatch | sos_id, rescue_team_id, assigned_by, status, assigned/accepted/en_route/arrived/completed timestamps |
| `incident_status_history` | Audit trail / citizen timeline | sos_id, from_status, to_status, changed_by, actor_role, note |

Enums: `app_role`, `alert_severity (info|watch|high|danger)`, `sos_situation`,
`priority_level (low|moderate|high|critical)`, `sos_status`, `assignment_status`,
`team_status`, `hazard_type`, `hazard_severity`, `hazard_status`,
`safety_status`, `data_source_type (official|community|simulated)`,
`supply_status (available|limited|unavailable)`.

### SOS status lifecycle

```
received → acknowledged → assigned → accepted → en_route → arrived → in_progress → resolved
    └──────────────┴──────────┴─────────┴──────────┴──────────┴───────────┴──→ cancelled / resolved (operator)
```

Citizen timeline labels: Request received · Control centre notified
(acknowledged) · Rescue team assigned (assigned/accepted = "Preparing") · Team
dispatched (en_route) · Team arrived (arrived/in_progress) · Completed (resolved).

Assignment lifecycle: `assigned → accepted → en_route → arrived → in_progress → completed`
(`arrived → completed` allowed; `cancelled` from any non-terminal state, which
returns the SOS to `acknowledged` for re-dispatch). Operators may resolve and
citizens may cancel from any open state. Authoritative table:
`supabase/migrations/20260930000003_workflows.sql` (mirrored in
`lib/utilities/status.ts`).

## 8. Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | public | Landing: mission, entry points (SOS, citizen app, operations login, demo) |
| `/auth/login` | public | Citizen phone OTP · Staff email/password · Demo accounts |
| `/citizen` | public | Home: risk status, latest alert, map preview, safe route, SOS, nearest shelter, recent hazards, sync status |
| `/citizen/map` | public | Full live map with layers + legend |
| `/citizen/route` | public | Safe evacuation route to nearest shelter with hazard re-routing |
| `/citizen/shelters` | public | Shelter list with capacity |
| `/citizen/alerts` | public | All active alerts |
| `/offline` | public | Offline fallback: emergency numbers, last known alerts/shelters |
| `/citizen/sos` | public (no login) | SOS form |
| `/citizen/sos/[ref]` | owner session or tracking token | Live SOS status |
| `/citizen/report` | signed-in | Report a hazard |
| `/citizen/profile` | signed-in | Profile + family safety status |
| `/dashboard` | operator, admin | KPIs, live map, incident queue, analytics |
| `/dashboard/incidents/[id]` | operator, admin | Incident detail, assign, override, resolve, history |
| `/dashboard/shelters` | operator, admin | Occupancy management |
| `/dashboard/hazards` | operator, admin | Review hazard reports |
| `/dashboard/teams` | operator, admin | Team roster/status |
| `/dashboard/alerts` | operator, admin | Publish/expire alerts |
| `/dashboard/data` | operator, admin | Data sources: live/simulation switch, DHM gauges and rain stations, sync now, reference data counts, re-import (admin) |
| `/dashboard/users` | admin | Role management |
| `/dashboard/demo` | operator, admin | Presentation mode: scenario script, block bridge, reset |
| `/rescue` | rescue, operator, admin | Rescue crew: own team's current mission, map, status buttons. Staff: "All teams" board (every team's status and current mission, live) and `?team=<id>` to open any team's console and record progress on its behalf (logged as recorded by the control centre). `?team` is ignored for rescue crews. |

## 9. Features (MVP scope)

1. **Alerts** — severity-coloured banners with text labels and explicit source
   ("JalSuraksha Hackathon Demo" for simulated). A new alert published while a
   citizen has the app open raises a severity-styled toast (danger: longer,
   vibrates) and, if the citizen opted in on the Alerts page, a device
   notification while the tab is in the background. Rescue consoles likewise
   offer device notifications for new missions.
2. **Live map** — user location, risk zones, SOS (staff only), shelters,
   hospitals, rescue teams (staff), hazards; legend; detail popups with actions.
3. **Flood risk engine** — transparent weighted rule-based score with
   "Why is…?" breakdown (§11). **Data mode** (`app_settings.data_mode`):
   `live` (default) applies fresh DHM gauge levels/thresholds and 24 h
   rainfall to each zone (zone ↔ gauge on its own river within 60 km, nearest
   live rain station within 20 km); readings older than 6 h are shown with
   their age but excluded ("No recent gauge reading"); gauges without an
   official danger level use the warning level; simulated alerts/hazard
   reports are hidden from citizens and ignored by risk; the scenario's road
   access value is not used. `simulation` = the demo scenario with a
   SIMULATION banner on every screen (Reset demo data selects it). Fresh gauges
   at/above official warning/danger levels raise automatic HIGH/DANGER alerts
   (one per station, 3 h expiry, renewed each sync, withdrawn when levels
   drop). SOS priority uses the same live zone risk. Staff manage it on
   `/dashboard/data`.
4. **Shelters** — nearest shelter by distance with remaining capacity and
   water/food/medical status; operators edit occupancy; full shelters are skipped
   by routing. Each shelter has a source and `verification` (verified /
   unverified / demo). Real schools and community centres (BIPAD, OSM) are
   imported as closed, unverified candidates; staff verify with a capacity and
   open them; admins can dismiss candidates or import an official CSV list.
   Hospitals (and health facilities, helipads, fire stations) come from BIPAD,
   de-duplicated; ward boundaries (116) from OpenStreetMap label SOS locations
   ("Bharatpur-03"). Admins add/edit/remove real rescue teams (demo teams are
   labelled DEMO).
5. **Safe evacuation routing** — live mode: hazard-aware walking routes on
   real OpenStreetMap roads via self-hosted Valhalla (`/api/route`, server
   reads shelters and hazards; each blocking hazard becomes a 60 m
   `exclude_polygons` area; the normal route is shown as blocked when hazards
   change it; non-blocking hazards near the route are cautions). Simulation
   mode, or Valhalla/network unavailable: deterministic Dijkstra over the demo
   road network (offline-capable), labelled approximate. In both, a hazard
   within 60 m of the person's own position only adds caution (every road out
   passes it, so blocking would falsely report "no route"). Blocking a bridge
   triggers "ROUTE UPDATED" and shows the blocked normal route.
6. **SOS** — guest-capable form (GPS, phone, people, children, elderly, injury,
   situation, description, photo); reference `SOS-NEP-####`; priority
   recommendation; realtime timeline; duplicate protection.
7. **Operations dashboard** — KPIs, live map, filterable/sortable incident
   queue, assign team, override priority, resolve, Recharts analytics. In the
   default priority sort, SOS no operator has opened yet (`received`) are
   pinned to the top with a NEW badge until opened, so a new request is never
   buried below the fold. Rescue teams only see an SOS once it is assigned to
   them. A notification bell in the staff header counts unopened SOS (also as
   "(n)" in the tab title) and lists each with priority, people, location and
   the citizen's message, linking to the incident; opening it acknowledges it.
   New SOS also raise a toast (with the message), a beep and — if the operator
   enables them (secure context only) — a desktop notification while the tab is
   in the background.
8. **Rescue console** — current mission, map, vulnerability info, contact,
   sequential status buttons, realtime. During an active mission the crew's
   device shares its GPS (`team_locations`, every ≥15 s after moving 25 m, plus
   a 1-minute heartbeat; Pause available; staff acting for a team never share
   their own position).
   **Victim view:** the SOS tracker shows "Where is my rescue team?" — a live
   map with their SOS location, the assigned team's live position, straight
   and road distance with an ETA (Valhalla, driving; cached per position), a
   Call-team button — and "Safe places near you" (3 nearest open shelters with
   space, with Safe route links; 2 nearest hospitals). The citizen home shows a
   "Your SOS" card with the team's distance. Privacy (RLS): a team's position
   is visible only to staff, the team, and the citizen whose open SOS that team
   is actively assigned to; guests get it through `/api/sos/track` (tracking
   token); positions older than 30 min are not shown as live. Staff maps place
   teams at their live position. Staff see all teams at `/rescue` and
   can open any team's console (teams without app accounts report by radio).
9. **Community hazard reporting** — type/severity/GPS/photo; confirmations;
   duplicates within 150 m of the same type are grouped (`duplicate_of`); a
   duplicate from another user counts as a confirmation, and nobody can
   confirm their own report (enforced in RLS).
10. **Family safety status** — SAFE / EVACUATED / NEED HELP on profile & home.
    Staff see every report live in the dashboard's "Family safety reports"
    panel (NEED HELP first, with phone, ward and any open SOS) and on the
    incident page; each change raises a toast, a bell entry and (opt-in) a
    desktop alert — NEED HELP as urgent. When a citizen presses "I am safe
    now", staff get "citizen reports they are SAFE" and the incident shows
    "Closed — reported safe"; the rescue team gets "MISSION CANCELLED — the
    citizen reports they are SAFE" (the assignment is labelled by a trigger).
11. **PWA/offline** — manifest, service worker caching the shell and a public
    snapshot (alerts, shelters, emergency contacts, safety instructions);
    OFFLINE MODE banner with last-sync time. The worker precaches the scripts
    of its precached pages, and the first visit warms the static and snapshot
    caches, so a first-visit offline reload still works. Uncached pages
    redirect to `/offline` (serving its HTML at another URL breaks hydration).
12. **Presentation mode** — scripted 14-step demo with scenario controls.
13. **SMS fallback (architecture only)** — `SOS <people> <children> <elderly>`
    parser + secret-gated inbound endpoint; no telecom gateway connected.
    A message without a location estimate is not recorded, and the reply says
    so plainly and gives 100/102 (never implies a call-back).

Optional (only after MVP is verified): AI hazard-photo classification, labelled
"AI-assisted classification — verify before operational use."

## 10. Design system

- **Palette**: neutral white / slate surfaces, dark navy (`#0B1B34`-ish) primary
  chrome. Status colours carry meaning only and always ship with a text label
  and icon:
  - SAFE — green · WATCH — yellow · HIGH — orange · DANGER/CRITICAL — red
  - INFO/LOW — slate/blue
- **Typography**: system/Geist sans; tabular numerals for metrics; uppercase
  tracking-wide labels for status.
- **Citizen (mobile-first)**: max-width ~480 px column, bottom nav
  (Home · Map · **SOS** · Report · Profile) with a raised red SOS button, 48 px+
  touch targets, one primary action per card.
- **Operations (desktop-first)**: dark navy header "JalSuraksha · Emergency
  Operations Centre", left nav, KPI row, map-dominant layout with side incident
  queue; information-dense cards.
- **States**: skeletons for loading, explicit empty states, inline error
  states, toasts for confirmations. No gradients beyond subtle accents.
- **Demo labelling**: `DEMO DATA` badge wherever simulated data is shown.

## 11. Flood risk engine (`lib/risk-engine/flood-risk.ts`)

Rule-based decision support — **not** a prediction model, not ML.

Each input is normalised to 0–1, multiplied by a configurable weight (weights
sum to 100), summed and clamped to 0–100.

| Factor | Normalisation | Default weight |
|---|---|---|
| River warning level | 0 below 80 % of warning level → 1 at danger level | 30 |
| Rainfall intensity (24 h) | 0 at ≤ 20 mm → 1 at ≥ 150 mm | 20 |
| Proximity to river | 1 at ≤ 250 m → 0 at ≥ 3 km | 15 |
| Elevation vulnerability | given 0–1 (low-lying = 1) | 10 |
| Community hazard reports | open/verified primary reports inside the zone polygon (duplicates excluded), 0 → 1 at ≥ 5 | 15 |
| Road access reduced | given 0–1 | 10 |

Categories: 0–25 **SAFE**, 26–50 **WATCH**, 51–75 **HIGH**, 76–100 **DANGER**.
Output includes each factor's contribution and a human sentence, rendered in
the "Why is this area high risk?" panel.

## 12. SOS priority engine (`lib/risk-engine/sos-priority.ts`)

Transparent decision-support score, 0–100, computed server-side on intake and
stored with its factor breakdown.

| Factor | Points |
|---|---|
| Situation: medical emergency | 30 |
| Situation: trapped | 30 |
| Situation: water rising rapidly | 25 |
| Situation: water entering home | 15 |
| Situation: other | 10 |
| Situation: safe temporarily | 0 |
| Injury reported | 20 |
| Children (per child, max 3) | 4 each |
| Elderly (per person, max 3) | 4 each |
| People count (1 per person above 1, max 8) | up to 8 |
| Location inside HIGH / DANGER risk zone | 5 / 10 |

Levels: 0–29 LOW, 30–49 MODERATE, 50–69 HIGH, 70–100 CRITICAL.
Demo scenario (5 people, 2 children, 1 elderly, injured, water rising rapidly)
= 25 + 20 + 8 + 4 + 4 = 61, + 10 (DANGER zone) = 71 → **CRITICAL**.

UI always states: **"Automated priority recommendation — operator review
required."** Operators can override (`operator_priority_override`) with a note;
the effective priority is `coalesce(override, computed)`. The score orders the
queue; it never decides who deserves rescue.

## 13. Security rules

- RLS on every table; default deny.
- Public (anon) read: active alerts, risk zones, active shelters, non-rejected
  hazard reports. Nothing else.
- `sos_requests`: owner (`user_id = auth.uid()`), staff, and the assigned rescue
  team may read. No direct client INSERT/UPDATE — intake via `/api/sos`
  (validated server-side), workflow via SECURITY DEFINER functions that check
  role from `profiles`.
- `profiles`: users read/update their own row; a trigger blocks changing
  `role`/`rescue_team_id` unless the caller is admin; admins read all.
- Service/secret key used **only** in server code (`lib/supabase/admin.ts`
  imports `server-only`). Browser receives only URL + publishable/anon key.
- Zod validation for every API body and server action.
- Uploads: JPEG/PNG/WebP only, ≤ 5 MB, content-type + magic-byte check,
  random server-generated path.
- Generic error messages to clients; details logged server-side.
- Rate limiting on SOS: one active SOS per phone per 10 minutes returns the
  existing reference instead of creating duplicates (the tracking token is
  only returned to the same session).
- Anonymous (guest) sessions cannot insert hazard reports or confirmations.
- Reporters cannot confirm their own hazard reports.
- Concurrency: every workflow function locks the SOS row before its
  assignment row (no deadlocks); `assign_rescue_team` takes the team the
  operator saw (`p_expected_team_id`) and raises `CONFLICT` if another
  operator changed the dispatch meanwhile.
- Security headers: nosniff, frame deny, referrer policy, permissions policy.
- `/api/health` returns only `{ ok, time }` publicly; detailed checks (never
  secret values) only to signed-in staff.

## 14. Limitations (state honestly in UI and README)

- Risk scores are rule-based decision support on live DHM readings (or the
  labelled simulation); not a flood forecast or validated hydrological model.
  Risk-zone polygons and their terrain/proximity values are approximate.
- DHM stations go offline; stale readings are excluded, so a zone can lack a
  river input. Live data depends on the BIPAD portal API being reachable.
- Routing does not guarantee physical safety — "Route guidance is decision
  support. Follow official emergency instructions." OSM road coverage and
  accuracy vary; Valhalla must be self-hosted (and protected) in production.
- No official public shelter list exists: imported candidates need staff
  verification; demo shelters/teams remain (labelled DEMO) until replaced.
  BIPAD facility data contains duplicates and naming errors (merged on import).
- SMS OTP requires an SMS provider configured in Supabase (Twilio etc.); demo
  test numbers are provided.
- No telecom SMS fallback gateway connected.
- Rate limiting is in-memory per server instance (not shared across Vercel
  instances); the SOS duplicate check is not atomic across two simultaneous
  requests from the same phone.
- `/api/demo` bridge toggle is open to anyone while demo mode is on.

## 15. Future development

DHM hydrology API integration · validated risk model with domain experts ·
SMS/USSD fallback via NTA-licensed gateway · Nepali language (i18n) · push
notifications · offline SOS queue with background sync · PostGIS spatial
queries · real road network routing (OSRM/Valhalla self-hosted) · integration
with NDRRMA BIPAD portal · volunteer management · shelter supply logistics.

## 16. Reliability behaviour

| Situation | Behaviour |
|---|---|
| GPS denied / unavailable | Clear message + "Set on map" picker; location marked *approximate* for operators |
| Slow network during SOS | Upload 15 s and SOS 20 s timeouts with explicit "could not confirm" message and emergency numbers |
| Public row withdrawn (alert withdrawn, shelter closed, hazard rejected) | RLS hides the new row, so `postgres_changes` never delivers the UPDATE to citizens; a DB trigger broadcasts `{table, id}` on the public `public:visibility` topic and citizen lists drop the row |
| Realtime disconnect, tab asleep, phone locked | Channels auto-rejoin; on every (re)join, refocus or `online` event the screen re-fetches a snapshot (debounced) so missed events appear |
| Snapshot query fails | Operations centre renders with a "data may be incomplete · Retry" banner instead of crashing |
| Any render error | Segment error boundaries (citizen/dashboard/rescue) and a global boundary keep a path to SOS and emergency numbers |
| Map tiles blocked / offline | "Street map unavailable" label; overlays stay accurate |
| Supabase env missing | Site-wide "Setup required" banner |
| Stale rescue buttons | Optimistic status after success + refresh; server re-validates every transition |

## 17. Testing

- Vitest unit tests (`tests/`, 132): risk engine, SOS priority, routing, state
  machines, role helpers, validation, upload magic bytes, SMS parser, metrics,
  OTP error mapping.
- pgTAP database tests (`supabase/tests/database/`, 50): RLS isolation,
  anonymous-session limits, role escalation guard, workflow authorization and
  transitions, team double-booking, dispatch conflicts, no self-confirmation,
  visibility broadcast triggers.
- Quality gate: `npm run check` (+ `npm run db:test` with local Supabase).

## 18. Implementation phases

1. Project, spec, design system, Supabase config, migrations, seed
2. Authentication, roles, route protection
3. Citizen home, live map, alerts, shelters
4. SOS flow, priority engine
5. Operations dashboard, realtime SOS
6. Rescue teams, assignment workflow, realtime status
7. Hazard reporting, safe routing
8. PWA/offline
9. Testing, polish, responsive, accessibility
10. Optional AI
