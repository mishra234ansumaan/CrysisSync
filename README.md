# CrisisSync — AI Emergency Response Platform

CrisisSync is an installable Next.js PWA for victims, nearby volunteers and a rescue
command center. It has no login gate. Production persistence uses Supabase PostgreSQL
and private Supabase Storage; alerts use standards-based Web Push; maps and safe routes
use OpenStreetMap and OSRM.

## Routes

| Persona | Route | Capabilities |
|---|---|---|
| Victim | `/victim` | Voice SOS, GPS, evidence photo, offline SMS code, battery beacon, safe route, QR medical pass |
| Volunteer | `/volunteer` | Resource registration, Web Push/in-app alerts, mission acceptance and rescue line |
| Command Center | `/admin` | Live map/feed, danger clustering, verification filters, dispatch and drone analysis |
| Demo controls | `/demo` | Seed/reset and deterministic scenario triggers |

## AWS replacements

| Previously planned AWS service | Active alternative | What it does now |
|---|---|---|
| Amazon DynamoDB | **Supabase PostgreSQL + Drizzle ORM** | Stores SOS reports, volunteers, medical profiles, matches, push subscriptions and quota windows |
| Amazon S3 | **Private Supabase Storage** | Stores compressed evidence photos; server proxy prevents exposing the service-role key |
| Amazon SNS SMS | **Web Push + persistent in-app alerts** | Alerts volunteer devices without a per-message SMS bill; polling remains the fallback |
| AWS Location Service | **Leaflet + OpenStreetMap + OSRM** | Keyless map tiles and real road routing with multi-pass danger-zone avoidance |
| AWS Lambda/API Gateway | **Vercel Functions** | Hosts Next.js route handlers automatically |
| AWS IAM credentials | **Supabase service-role key, server-side only** | Permits private object upload/download; never exposed to browser code |
| AWS CloudWatch | **Vercel logs + `/api/health`** | Runtime logs and provider health diagnostics |

Additional services:

- **Gemini 2.5 Flash** — text triage, image verification and drone analysis.
- **Open-Meteo** — real, keyless weather and seven-day precipitation.
- **OpenWeatherMap** — optional second weather source.
- **Browser APIs** — GPS, Web Speech, Battery Status, Notifications, Push and PWA.

No active application code calls AWS. No AWS access key, secret, bucket or account is needed.

---

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com/).
2. Open **Project Settings → Database → Connect**.
3. Copy:
   - **Transaction pooler** URL (port `6543`) → `DATABASE_URL` for Vercel/runtime.
   - **Direct/session** URL (port `5432`) → `DIRECT_URL` for schema setup.
4. Open **Project Settings → API** and copy:
   - Project URL → `SUPABASE_URL`.
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`.

The service-role key is a server secret. Never prefix it with `NEXT_PUBLIC_`, put it in
client code, or commit it to GitHub.

## 2. Configure VS Code

```bash
npm install
cp .env.example .env
```

Fill `.env`:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT:PASSWORD@POOLER:6543/postgres
DIRECT_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
DATABASE_POOL_SIZE=3

SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=crisissync-evidence

GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_KEY
GEMINI_MODEL=gemini-2.5-flash
OPENWEATHER_API_KEY=
RATE_LIMIT_SALT=USE_A_LONG_RANDOM_VALUE_HERE
```

Generate free Web Push credentials:

```bash
npx tsx scripts/generate-vapid.ts
```

Copy its three output values into `.env`:

```dotenv
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your-email@example.com
```

The public key is intentionally public. The private key stays server-side.

## 3. Create tables and private storage

Apply the full PostgreSQL schema to Supabase:

```bash
npx drizzle-kit push
```

Create or update the private, MIME-restricted, 5 MB evidence bucket:

```bash
npx tsx scripts/setup-supabase.ts
```

Seed 20 SOS reports and 8 safe demo volunteers into Supabase:

```bash
npx tsx scripts/seed.ts --force
```

Start locally:

```bash
npm run dev
```

Visit `http://localhost:3000/api/health`. A correctly configured production-like setup
reports `supabase-postgresql`, `supabase-storage`, Web Push status and keyless map status.

## 4. Deploy to Vercel

1. Push to GitHub. `.env` and `.env.local` are already ignored.
2. Import the repository into Vercel.
3. Add these in **Project → Settings → Environment Variables**:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
RATE_LIMIT_SALT
GEMINI_API_KEY
GEMINI_MODEL
OPENWEATHER_API_KEY (optional)
```

`DIRECT_URL` is only needed locally for `drizzle-kit push`; Vercel runtime does not need it.
Redeploy after adding/changing `NEXT_PUBLIC_VAPID_PUBLIC_KEY` because public variables are
embedded at build time.

## 5. How volunteer alerts work

1. A volunteer registers resources and permits browser notifications.
2. The browser Push API subscription is persisted in PostgreSQL.
3. A matching SOS creates a persistent `matches` row first.
4. The server sends a free Web Push notification to subscribed devices.
5. If push permission is absent or delivery fails, the Volunteer PWA still receives the
   persistent alert through its 3-second in-app polling fallback.

On iOS, Web Push requires installing the PWA to the Home Screen. Desktop Chrome/Edge and
supported Android browsers can subscribe directly. HTTPS is required in production;
localhost is allowed during development.

## 6. Quota and abuse protection

This app intentionally has no login, so public endpoints use database-backed fixed-window
rate limits keyed by a hashed visitor IP:

- SOS creation: 8 requests per 10 minutes.
- Image analysis: 10 per hour.
- Drone analysis: 8 per hour.
- Demo simulation: 12 per hour.
- Volunteer registration: 6 per hour.
- Push subscription updates: 20 per hour.

Large evidence photos are resized to a maximum dimension of 1600 px and JPEG-compressed
before upload. Supabase Storage rejects files over 5 MB and non-image MIME types. Storage
is private and served through `/api/uploads/[key]`.

Free-tier quotas still exist. Check your Supabase and Vercel dashboards, keep billing
alerts enabled if you attach payment details, and disable `/demo` before handling real
citizen information.

## Architecture

```mermaid
flowchart LR
  V[Victim PWA] --> API[Vercel / Next.js Functions]
  H[Volunteer PWA] --> API
  C[Command Center] --> API
  API --> PG[(Supabase PostgreSQL)]
  API --> ST[(Private Supabase Storage)]
  API --> PUSH[Standards Web Push]
  API --> GEM[Gemini 2.5 Flash]
  API --> WX[Open-Meteo + OpenWeather]
  V & H & C --> OSM[Leaflet + OpenStreetMap]
  API --> OSRM[OSRM road routing]
  ST --> PROXY[Private evidence proxy]
  PROXY --> C
```

## Persistent tables

- `sos_reports` — GPS, transcript, triage, trust score, verification details, evidence URL.
- `volunteers` — location, resources and availability.
- `medical_profiles` — cloud mirror of the offline QR medical pass.
- `matches` — volunteer-to-SOS missions and status.
- `push_subscriptions` — browser push endpoint and encrypted browser keys.
- `api_rate_limits` — hashed public-route quota windows.

## Local-only mode

For development without Supabase, set local PostgreSQL in `.env`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
DATABASE_SSL=false
```

Then run `npx drizzle-kit push`. Evidence uses `public/uploads` locally. Web Push remains
off until VAPID keys are configured. All maps, routing, voice, GPS, QR and in-app alerts
continue to work.
