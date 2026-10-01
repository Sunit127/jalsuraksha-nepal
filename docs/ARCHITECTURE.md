# Architecture

`PROJECT_SPEC.md` is the source of truth. This document explains *how* the
code implements it.

## Request and data flow

```
┌─────────────── Browser ───────────────┐
│ Server Components (first paint)        │
│ Client Components                      │
│  ├─ useRealtimeRows(table, rows)  ◄────┼── Supabase Realtime (postgres_changes,
│  ├─ Server Actions (mutations)         │    filtered by RLS for this user's JWT)
│  └─ fetch /api/* (guest SOS, uploads)  │
└───────────────┬────────────────────────┘
                ▼
┌─────────── Next.js (Vercel) ──────────┐
│ proxy.ts: refresh cookie session,      │
│   redirect signed-out users away from  │
│   /dashboard, /rescue, /citizen/report │
│ layouts: role check from profiles      │
│ actions: Zod → rpc(workflow fn)        │
│ /api/sos: Zod → rate limit → duplicate │
│   check → risk + priority engines →    │
│   insert with service key              │
└───────────────┬────────────────────────┘
                ▼
┌────────────── Supabase ───────────────┐
│ Postgres: RLS on all tables            │
│   SECURITY DEFINER workflow functions  │
│   triggers: profiles, audit log,       │
│   confirmation counts, role guard      │
│ Auth: phone OTP · email · anonymous    │
│ Storage: sos-photos (private),         │
│          hazard-photos (public)        │
└────────────────────────────────────────┘
```

## Why these choices

| Decision | Reason |
|---|---|
| Workflow in Postgres functions | Authorization, transition rules, team status and the audit log change atomically. A bug in the UI can't create an invalid state, and every client (web, a future SMS gateway, scripts) shares the same rules. |
| Guest SOS through a route handler + service key | People in danger may have no session. The handler validates everything and never trusts client-supplied role, status or priority. |
| Anonymous auth for guests | RLS-filtered realtime works for the SOS owner with no extra channel design. The tracking token + polling cover the case where anonymous sign-in is disabled. |
| `prepareRealtime()` before subscribing | The cookie session loads asynchronously. Without setting the Realtime token first, channels join as anonymous and RLS hides protected rows. |
| One demo dataset module | `supabase/seed.sql` and the in-app reset come from `lib/demo/dataset.ts`, so demo data can't drift, and the SOS priorities in the seed are computed by the real engine. |
| Pure TS engines | `lib/risk-engine/*` and `lib/routing/*` are framework-free, easy to test and easy to explain to judges. |
| Demo road network | OSM routing services can't know about community hazards. A small, explicit graph makes re-routing deterministic and offline-capable for the prototype. |

## Data model (summary)

```
auth.users 1─1 profiles ──┐ role, safety_status, rescue_team_id ─► rescue_teams
                          │
sos_requests ─┬─< rescue_assignments >── rescue_teams
              └─< incident_status_history
hazard_reports ─< hazard_confirmations        (duplicate_of → hazard_reports)
alerts · risk_zones · shelters                (public read)
```

Full column list: `supabase/migrations/20260930000001_core_schema.sql`.

## Realtime subscriptions

| Screen | Tables | Visible rows |
|---|---|---|
| Citizen app | alerts, shelters, hazard_reports | public |
| SOS tracker | sos_requests (id), rescue_assignments (sos_id), incident_status_history (sos_id) | own SOS only; polling fallback |
| Operations centre | sos_requests, rescue_teams, rescue_assignments, shelters, hazard_reports, alerts | staff: all |
| Rescue console | rescue_assignments (team), rescue_teams (team), sos_requests | own team's incidents |

## Engines

- **Flood risk** (`lib/risk-engine/flood-risk.ts`): six normalised factors × configurable weights, summed to 0–100 and banded SAFE/WATCH/HIGH/DANGER. Community reports are counted per zone polygon (`zones.ts`).
- **SOS priority** (`lib/risk-engine/sos-priority.ts`): additive points with caps, banded LOW/MODERATE/HIGH/CRITICAL. The operator override is stored separately, and `effective_priority` is a generated column.
- **Routing** (`lib/routing/safe-route.ts`): Dijkstra that removes blocked edges and adds costs for cautions and risk zones. It also computes the hazard-free route to explain a re-route.

## Offline / PWA

`public/sw.js`: citizen pages are network-first with cache fallback, then
`/offline`. Hashed static assets are cache-first. `/api/public/snapshot` is
network-first, and OSM tiles are cache-first (capped at 400). Supabase traffic and staff
pages are never cached. The citizen app also keeps its last snapshot in
`localStorage` and shows **OFFLINE MODE · Last synchronized …**.

## Future SMS fallback

`lib/services/sms.ts` parses `SOS <people> [children] [elderly] [INJ] [TRAP|MED|RISE|WATER|SAFE] [text]`.
`POST /api/sms/inbound` (disabled unless `SMS_GATEWAY_SECRET` is set; the
secret is compared in constant time) validates the message and creates the
SOS through the same intake service as the app (`source = 'sms'`). What's
missing is a licensed gateway that forwards messages and a network-based
location estimate.
