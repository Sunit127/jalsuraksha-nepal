# Real data sources

JalSuraksha uses real, public data for the pilot area **Chitwan district and
Gaidakot** (`lib/geo/pilot-area.ts`). This page explains where every number
comes from, how it stays fresh, and how to operate it.

| Data | Source | How it gets in | Refresh |
|---|---|---|---|
| River levels, warning/danger levels, trend | **DHM** (hydrology.gov.np) via the **BIPAD portal** API | `lib/hydromet/sync.ts` → `hydromet_stations` | every 10 min (lazy) or by scheduler |
| Rainfall (1/3/6/12/24 h) | DHM rain stations via BIPAD | same sync | same |
| Hospitals, health facilities, helipads, fire stations | **BIPAD portal** resources | `npm run data:import` or Data sources → Re-import | on demand |
| Ward boundaries (116 wards) | **OpenStreetMap** (admin_level 9), © OSM contributors, ODbL | same import | on demand |
| Candidate shelters (schools, community centres) | BIPAD (education) + OpenStreetMap | same import, **closed and unverified** | on demand |
| Official shelters | Municipality / DAO list | Shelters → Import official list (CSV) | when the list changes |
| Rescue teams | Your organisation | Rescue teams → Add team (admin) | as needed |
| Walking routes | **OpenStreetMap** roads, self-hosted **Valhalla** | `docker-compose.routing.yml` | rebuild with a newer extract |

Everything above appears on **Dashboard → Data sources**, with counts, last
sync time, every gauge's latest reading, and which risk zone uses it.

## Live vs simulation

`app_settings.data_mode` is `live` (default) or `simulation`.

- **Live:** fresh DHM readings replace each risk zone's river level,
  thresholds and 24 h rainfall. Citizens never see simulated alerts or demo
  hazard reports, and they don't affect risk. Gauges at or above official
  levels raise alerts automatically.
- **Simulation:** the demo scenario (DANGER 84, flooded bridge) for
  presentations and drills. Every citizen and staff screen shows an orange
  **SIMULATION MODE** banner. Automatic gauge alerts pause. *Reset demo data*
  switches to simulation; switch back on Data sources or in Presentation mode.

## Honesty rules (`lib/hydromet/live.ts`)

- A river reading older than **6 hours** (rain: 6 hours) is **stale**: shown
  with its age ("last report 3 days ago") but never used as the current level.
  DHM keeps the last value of offline stations — some still say "ABOVE DANGER
  LEVEL" from months ago.
- A zone with no fresh gauge gets **no river contribution** to its risk score,
  and the explanation says "No recent gauge reading — river level not
  included". It is never treated as a calm river.
- Gauges without an official danger level: full weight applies at the
  **warning** level (conservative), and the UI says "no official danger level".
- Zones use the gauge **on their own river** (up to 60 km, so an upstream
  gauge such as East Rapti at Rajaiya counts) and the **nearest live** rain
  station (up to 20 km). Mapping is recomputed every sync.

## Automatic alerts

While live, each sync checks every fresh gauge:

- at/above **danger** → DANGER alert; at/above **warning** → HIGH alert, titled
  e.g. "Narayani at Devghat: river above WARNING level", with the reading,
  thresholds, time and trend; source "DHM river gauge (hydrology.gov.np via
  BIPAD)";
- below warning again → the alert is withdrawn (citizens' screens drop it live);
- each alert **expires after 3 hours** unless the next sync renews it, so a
  stopped sync can never leave a stale warning up.

Staff can still publish their own alerts as before.

## Keeping DHM data fresh

Pages trigger a background sync (`after()`) when the last one is older than
10 minutes. That is enough for development and low traffic. In production,
also schedule it so data stays fresh at night:

- **Vercel Cron** (Pro plan for 10-minute schedules) — add to `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/hydromet/sync", "schedule": "*/10 * * * *" }] }
  ```
  and set `CRON_SECRET` in Vercel (Vercel sends it as a Bearer token).
- **Supabase pg_cron + pg_net** (works on any plan):
  ```sql
  select cron.schedule('dhm-sync', '*/10 * * * *', $$
    select net.http_post(
      url := 'https://<your-domain>/api/hydromet/sync',
      headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
    );
  $$);
  ```
Staff can also press **Sync now** on Data sources.

## Reference data import

```bash
npm run data:import   # wards → facilities → candidate shelters (≈ 20 s)
```

- Duplicates in BIPAD (e.g. one hospital listed under four spellings) are
  merged: same kind, within 75 m, sharing a distinctive name word.
- Re-running is safe: facilities and wards refresh; shelters staff have
  verified or edited are **never** overwritten; untouched duplicate candidates
  are removed.
- `npm run db:reset` wipes the database — run the import again afterwards.

### Shelters workflow

Imported schools and community centres are **candidates**, not shelters.
Dashboard → Shelters → *Candidates to verify*: confirm with the ward office
that the building is safe and available, enter its capacity, then **Verify &
open** (or verify and keep closed). Admins can mark a candidate **Not
suitable**, or import the official list as CSV:

```csv
name,latitude,longitude,capacity,ward,municipality,district,address,phone
Bharatpur Secondary School,27.6853,84.4311,250,10,Bharatpur Metropolitan City,Chitwan,"Ward 10, Bharatpur",056520000
```

Demo shelters stay visible (labelled DEMO) until staff close them — close them
once real shelters are verified.

### Teams

Rescue team rosters are not public. Admins add real teams on Dashboard →
Rescue teams → **Add team** (base location can be copied from a real fire
station imported from BIPAD). New teams start offline. Demo teams R-01…R-07
are labelled DEMO; keep them for drills or remove them (teams with mission
history can't be deleted — mark them offline).

## Real-road routing (Valhalla)

```bash
npm run routing:download   # Nepal extract from Geofabrik (~400 MB)
npm run routing:up         # first start builds routing tiles (~5–20 min)
npm run routing:logs       # watch progress; ready when /status answers
```

Then set `VALHALLA_URL=http://localhost:8002` in `.env.local` (production:
the URL of your Valhalla server — it must not be public without auth/rate
limits; the app calls it server-side only).

- Live mode routes on real roads with `costing: pedestrian` to the nearest
  open shelters with space; every blocking hazard becomes an
  `exclude_polygons` area (60 m) so the route goes around it. The normal route
  is also computed and shown as "blocked" when hazards changed it.
- If Valhalla is unreachable (or the phone is offline) the app falls back to
  the simplified offline network and says the route is approximate.
- Simulation mode keeps the scripted demo network so presentations behave as
  rehearsed.
- Update the road data by re-downloading the extract and restarting with
  `force_rebuild=True` once.

## Attribution

Map data © OpenStreetMap contributors (ODbL). Hydro-meteorological data:
Department of Hydrology and Meteorology, Government of Nepal, via the BIPAD
portal (NDRRMA). Facilities: BIPAD portal. Check the terms of each source
before commercial use.
