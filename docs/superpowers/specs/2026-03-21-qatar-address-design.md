# QatarAddress — Open-Source Qatar National Address System

**Date:** 2026-03-21
**License:** AGPL v3
**Status:** Design Approved

---

## Problem

Qatar's official address system (QNAS at qnas.qa) provides the only API for Zone/Street/Building address lookups, but suffers from:

- Broken/undocumented API
- Painful domain registration process for API keys
- No developer support
- 1,000 requests/day limit
- Single point of failure for all Qatar address-dependent applications

## Solution

**QatarAddress** — a fully open-source, self-hostable Qatar address database and API that replaces qnas.qa entirely. We host the canonical database as a free service, publish SDKs for every major platform, and maintain the data through automated crawling + community contributions.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Project name | QatarAddress | Clear, descriptive |
| License | AGPL v3 | Forces service providers to share modifications back |
| Architecture | Monorepo (Turborepo + pnpm) | Single PR for cross-cutting changes, easier for primary maintainer |
| SDK pattern | Shared core per language + framework plugins | Proven pattern (mirrors SADAD architecture) |
| Data source | QNAS API crawl (primary) + HDX/OSM enrichment + community | Best accuracy from official source, enriched with open data |
| Crawl strategy | Slow/steady, 1 account, ~950 req/day | Respectful, no need to rush |
| Hosting | Contabo VPS 161.97.150.84 | Existing infrastructure |
| Database | PostgreSQL 16 + PostGIS | Spatial queries, industry standard |
| API framework | Fastify | Fast, TypeScript-native, built-in validation |
| Caching | Redis | Standard, simple |
| React styling | Tailwind CSS | Matches existing blue plate component |
| Update strategy | Automated re-crawl (weekly/monthly/quarterly) + community contributions | Reliable baseline + community velocity |

---

## 1. Database Schema

PostgreSQL 16 with PostGIS extension.

### zones

```sql
CREATE TABLE zones (
  id SERIAL PRIMARY KEY,
  zone_number INT UNIQUE NOT NULL,
  zone_name VARCHAR(100),
  zone_name_ar VARCHAR(100),
  municipality VARCHAR(100),
  municipality_ar VARCHAR(100),
  boundary GEOMETRY(POLYGON, 4326),
  centroid GEOMETRY(POINT, 4326),
  source VARCHAR(20) DEFAULT 'QNAS_API' CHECK (source IN ('QNAS_API', 'OSM', 'COMMUNITY', 'HDX')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_zones_number ON zones(zone_number);
CREATE INDEX idx_zones_boundary ON zones USING GIST(boundary);
```

### streets

```sql
CREATE TABLE streets (
  id SERIAL PRIMARY KEY,
  zone_id INT REFERENCES zones(id) ON DELETE RESTRICT,
  street_number INT NOT NULL,
  street_name VARCHAR(200),
  street_name_ar VARCHAR(200),
  geometry GEOMETRY(GEOMETRY, 4326),      -- LINESTRING (centerline) or POLYGON (boundary), depends on QNAS response
  source VARCHAR(20) DEFAULT 'QNAS_API' CHECK (source IN ('QNAS_API', 'OSM', 'COMMUNITY', 'HDX')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(zone_id, street_number)
);

CREATE INDEX idx_streets_zone ON streets(zone_id);
```

### buildings

```sql
CREATE TABLE buildings (
  id SERIAL PRIMARY KEY,
  street_id INT REFERENCES streets(id) ON DELETE RESTRICT,
  building_number INT NOT NULL,
  location GEOMETRY(POINT, 4326) NOT NULL,  -- canonical coordinate store; use ST_Y(location)/ST_X(location) for lat/lng
  source VARCHAR(20) DEFAULT 'QNAS_API' CHECK (source IN ('QNAS_API', 'OSM', 'COMMUNITY', 'GENERATED')),
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(street_id, building_number)
);

CREATE INDEX idx_buildings_street ON buildings(street_id);
CREATE INDEX idx_buildings_location ON buildings USING GIST(location);
```

Latitude/longitude derived via `ST_Y(location)` and `ST_X(location)` in queries — single source of truth, no sync issues.

Source values: `QNAS_API`, `OSM`, `COMMUNITY`, `GENERATED`

### contributions

```sql
CREATE TABLE contributions (
  id SERIAL PRIMARY KEY,
  zone_number INT NOT NULL,
  street_number INT NOT NULL,
  building_number INT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  contributor_name VARCHAR(100),
  contributor_email VARCHAR(200),
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contributions_status ON contributions(status);
```

Status values: `pending`, `approved`, `rejected`

### crawl_log

```sql
CREATE TABLE crawl_log (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(50) NOT NULL,
  zone_number INT,
  street_number INT,
  building_number INT,
  status VARCHAR(20) NOT NULL,
  response_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crawl_log_endpoint ON crawl_log(endpoint, zone_number, street_number);
CREATE INDEX idx_crawl_log_created ON crawl_log(created_at);
```

Retention: 90 days. Automated cleanup via daily cron: `DELETE FROM crawl_log WHERE created_at < NOW() - INTERVAL '90 days'`. Only failures retain `response_data` JSONB; successful crawls store `NULL` to save space.

---

## 2. API Design

### Framework

Fastify with TypeScript. Rate limiting via `@fastify/rate-limit` + Redis.

### Public Endpoints (no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/zones` | All zones (cached 1hr) |
| GET | `/api/v1/zones/:zone` | Single zone + boundary polygon |
| GET | `/api/v1/zones/:zone/streets` | Streets in a zone |
| GET | `/api/v1/zones/:zone/streets/:street` | Single street |
| GET | `/api/v1/zones/:zone/streets/:street/buildings` | Buildings on a street |
| GET | `/api/v1/locate/:zone/:street/:building` | Coordinates + map links |
| GET | `/api/v1/search?q=` | Full-text search (EN + AR) |
| GET | `/api/v1/reverse?lat=&lng=` | Reverse geocode to zone/street/building |
| GET | `/api/v1/validate` | Validate address exists |
| GET | `/api/v1/stats` | Database coverage statistics |
| GET | `/api/v1/health` | Health check |

### Community Endpoints (rate-limited, no auth)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/contribute` | Submit address correction/addition |
| GET | `/api/v1/contributions/:id/status` | Check contribution status |

### Admin Endpoints (API key required)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/contributions?status=pending` | Review queue |
| PUT | `/admin/contributions/:id` | Approve/reject contribution |
| POST | `/admin/crawl/start` | Trigger manual crawl |
| GET | `/admin/crawl/status` | Crawl progress |
| GET | `/admin/stats` | Detailed database metrics |

### Rate Limits

- Public: 100 req/min per IP
- Contribute: 10 req/min per IP
- No daily limit (key differentiator vs qnas.qa)

### Response Format

```json
{
  "success": true,
  "data": {
    "zone": { "number": 25, "name": "Dafna", "name_ar": "الدفنة" },
    "street": { "number": 230, "name": "Al Funduq Street", "name_ar": "شارع الفندق" },
    "building": { "number": 44 },
    "coordinates": { "lat": 25.323456, "lng": 51.527891 },
    "links": {
      "google_maps": "https://www.google.com/maps/search/?api=1&query=25.323456,51.527891",
      "waze": "https://waze.com/ul?ll=25.323456,51.527891&navigate=yes"
    },
    "source": "QNAS_API",
    "verified": true,
    "full_address": "Building 44, Street 230, Zone 25, Qatar",
    "full_address_ar": "مبنى 44، شارع 230، منطقة 25، قطر"
  }
}
```

### Validate Endpoint

```
GET /api/v1/validate?zone=25&street=230&building=44
```

Zone is required; street and building are optional — validates as deep as provided. Response:

```json
{
  "success": true,
  "data": {
    "valid": true,
    "zone_exists": true,
    "street_exists": true,
    "building_exists": true
  }
}
```

### Contribute Endpoint

```
POST /api/v1/contribute
Content-Type: application/json

{
  "zone_number": 25,          // required, 1-98
  "street_number": 230,       // required, 1-99999
  "building_number": 99,      // required, 1-99999
  "latitude": 25.323456,      // optional, -90 to 90
  "longitude": 51.527891,     // optional, -180 to 180
  "contributor_name": "Ali",   // required, 2-100 chars
  "contributor_email": "...",  // required, valid email
  "notes": "New building"     // optional
}
```

Spam protection: rate limit (10 req/min per IP) + email format validation + duplicate detection (same zone/street/building within 24hrs rejected).

### Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ADDRESS_NOT_FOUND",
    "message": "Building 99 not found on Street 230 in Zone 25"
  }
}
```

Error codes:

| Code | HTTP Status | Description |
|---|---|---|
| `ADDRESS_NOT_FOUND` | 404 | Zone, street, or building does not exist |
| `VALIDATION_ERROR` | 422 | Invalid input parameters |
| `RATE_LIMITED` | 429 | Too many requests |
| `DUPLICATE_CONTRIBUTION` | 409 | Same address contributed within 24hrs |
| `UNAUTHORIZED` | 401 | Missing or invalid admin API key |
| `SERVER_ERROR` | 500 | Internal error |

### Admin Authentication

Admin endpoints require `Authorization: Bearer <ADMIN_API_KEY>` header. Key is stored as environment variable on the server. Generated via CLI command: `pnpm run admin:generate-key`.

### Rate Limit Headers

All responses include:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1711036800
```

### Pagination

List endpoints accept `?page=1&limit=50` (default limit=50, max limit=200). Response:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 342,
    "has_more": true
  }
}
```

### Search Endpoint

```
GET /api/v1/search?q=Dafna&lang=en&type=zone
```

- `q` — search term (required, min 2 chars)
- `lang` — `en` or `ar` (optional, searches both if omitted)
- `type` — `zone`, `street`, or `all` (optional, defaults to `all`)

Uses PostgreSQL trigram matching (`pg_trgm`) for fuzzy bilingual search. Returns mixed results ranked by relevance.

### Reverse Geocode Endpoint

```
GET /api/v1/reverse?lat=25.323456&lng=51.527891&radius=500
```

- `radius` — search radius in meters (optional, default 200, max 2000)
- Returns nearest building within radius, or 404 if no building found
- Returns 422 if coordinates are outside Qatar bounding box (24.4-26.2 lat, 50.7-51.7 lng)

### CORS Policy

Fully open (`Access-Control-Allow-Origin: *`) — public API for all consumers.

### Caching (Redis)

- Zone/street lists: 1-hour TTL
- Building lookups: 24-hour TTL
- Invalidated on data update
- Redis failure fallback: bypass cache, hit PostgreSQL directly (degraded but functional)

---

## 3. Crawler / Data Harvester

### QNAS API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /get_zones/` | All 98 zones |
| `GET /get_zone_polygon/{zone}` | Zone boundary polygon |
| `GET /get_streets/{zone}` | Streets per zone |
| `GET /get_street_polygon/{zone}/{street}` | Street boundary |
| `GET /get_buildings/{zone}/{street}` | Buildings per street |
| `GET /get_location/{zone}/{street}/{building}` | Lat/lng per building |

### Crawl Phases

1. **Zones** — 1 request → all 98 zones
2. **Zone Polygons** — 98 requests (~1 day)
3. **Streets** — ~98 requests (~1 day)
4. **Street Polygons** — ~thousands of requests (~days)
5. **Buildings** — ~thousands of requests (~days)
6. **Coordinates** — ~tens of thousands of requests (~weeks)

### Rate Limiting

- 55 req/min (buffer under QNAS's 60/min)
- 950 req/day (buffer under 1,000/day)
- Auto-pause at daily limit, resume next day
- Exponential backoff on 429/500 errors

### Resumability

- Every request logged in `crawl_log` table
- On restart, skips already-fetched data
- Progress display: `Zones: 98/98 | Streets: 1,204/~1,500 | Buildings: 12,340/~50,000`

### Data Enrichment (post-crawl)

1. Download HDX zone boundary GeoJSON → merge with QNAS polygons (prefer QNAS, HDX fallback)
2. Download OSM building footprints → match to QNAS buildings by proximity (<50m)
3. Generate Google Maps + Waze links for every building

### Re-crawl Schedule

- Weekly: check for new zones
- Monthly: re-crawl streets per zone
- Quarterly: full building re-crawl

### Static Export

All data exported as JSON/GeoJSON to `data/` directory for offline use and git versioning.

```
data/
├── zones.json
├── zones-polygons.geojson
├── streets/
│   ├── zone-01.json
│   └── ...
├── buildings/
│   ├── zone-01/
│   │   ├── street-001.json
│   │   └── ...
│   └── ...
└── boundaries/
    ├── hdx-adm2.geojson
    └── osm-buildings.geojson
```

---

## 4. SDK Architecture

Shared core per language. Framework plugins depend on the core SDK.

### Dependency Tree

```
@qatar-address/sdk (JS/TS core)
├── @qatar-address/react (Tailwind blue plate component)
└── @qatar-address/nextjs (API route + server helpers)

qatar-address/sdk (PHP core, Composer)
└── qatar-address/laravel (service provider + validation + Blade)

qatar_address (Dart core, pub.dev)
└── qatar_address_flutter (blue plate widget)
```

### JS/TS SDK (`@qatar-address/sdk`)

```typescript
import { QatarAddress } from '@qatar-address/sdk';

const qa = new QatarAddress({
  baseUrl: 'https://api.qataraddress.com', // default hosted
});

const location = await qa.locate(25, 230, 44);
const zones = await qa.getZones();
const streets = await qa.getStreets(25);
const buildings = await qa.getBuildings(25, 230);
const results = await qa.search('Dafna');
const address = await qa.reverse(25.323456, 51.527891);
const isValid = await qa.validate(25, 230, 44);
await qa.contribute({ zone: 25, street: 230, building: 99, lat: 25.32, lng: 51.52 });
```

- Uses `fetch` only (no dependencies)
- Works in Node.js, browser, edge runtimes
- Accepts custom `baseUrl` for self-hosting
- Can bundle `zones.json` for offline zone validation

### React Component (`@qatar-address/react`)

```tsx
import { QNASLocationPicker } from '@qatar-address/react';

<QNASLocationPicker
  baseUrl="https://api.qataraddress.com"
  onChange={(location) => console.log(location)}
  locale="en"
  showApartment={true}
  showMap={false}
/>
```

- Tailwind styled, blue plate (#0054A6)
- RTL support for Arabic
- Debounced validation (500ms)
- Zero config default

### Next.js Plugin (`@qatar-address/nextjs`)

- API route helper: `export { GET, POST } from '@qatar-address/nextjs/api'`
- Server component: `import { locateAddress } from '@qatar-address/nextjs'`

### PHP SDK (`qatar-address/sdk`)

```php
use QatarAddress\Client;
$qa = new Client(['baseUrl' => 'https://api.qataraddress.com']);
$location = $qa->locate(25, 230, 44);
```

- Guzzle HTTP client
- PSR-4 autoloading

### Laravel Plugin (`qatar-address/laravel`)

- Service provider + facade
- Validation rules: `qatar_zone`, `qatar_street`
- Blade component: `<x-qatar-address-picker />`
- Config: `config/qatar-address.php`

### Dart SDK (`qatar_address`)

```dart
final qa = QatarAddress(baseUrl: 'https://api.qataraddress.com');
final location = await qa.locate(25, 230, 44);
```

### Flutter Widget (`qatar_address_flutter`)

```dart
QNASLocationPicker(
  onChanged: (location) => print(location),
  locale: 'ar',
  showApartment: true,
)
```

### SDK Design Principles

- All SDKs hit the REST API (no direct DB access)
- Offline fallback: SDKs can bundle `zones.json` for zone validation without network
- Self-hostable: every SDK accepts custom `baseUrl`
- Type-safe: TypeScript types, PHP docblocks, Dart strong typing
- Minimal dependencies

---

## 5. Deployment & Infrastructure

### Target: Contabo VPS 161.97.150.84

### Docker Compose Stack

```
api        → Fastify Node.js app (port 3000)
postgres   → PostgreSQL 16 + PostGIS (port 5432)
redis      → Caching layer (port 6379)
nginx      → Reverse proxy + SSL (ports 80/443)
crawler    → Cron-scheduled harvester (same image as api)
```

### Domain

```
qataraddress.com (or alternative)
├── api.qataraddress.com       → API server
├── docs.qataraddress.com      → API documentation
└── qataraddress.com           → Landing page + demo
```

### SSL

Let's Encrypt via Certbot with auto-renewal.

### Backup Strategy

- Daily: `pg_dump` → compressed backup → Contabo Object Storage (off-server)
- Weekly: full JSON export to `data/` → git commit + push to Gitea
- Backups verified monthly via test restore

### Monitoring

- UptimeRobot on `/api/v1/health` endpoint (free tier, 5-min checks)
- Crawler status alerts: if no successful crawl in 48hrs, notify via webhook
- Disk space alert: if VPS disk > 80%, notify
- Log rotation: logrotate for API logs, 7-day retention

### CI/CD (Gitea Actions — git.louis-innovations.com)

- **On push to main:** lint + test all packages → build Docker → SSH deploy to VPS
- **On PR:** lint + test affected packages only
- **On release tag:** publish to npm, Packagist, pub.dev

### Monorepo Tooling

- Turborepo: task orchestration + caching
- pnpm workspaces: JS package management
- Changesets: versioning + changelogs
- Vitest: JS/TS testing
- PHPUnit: PHP testing
- Dart test: Dart testing

---

## 6. Project Structure

```
qatar-address/
├── packages/
│   ├── database/
│   │   ├── migrations/
│   │   ├── seeds/
│   │   └── package.json
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── zones.ts
│   │   │   │   ├── streets.ts
│   │   │   │   ├── buildings.ts
│   │   │   │   ├── locate.ts
│   │   │   │   ├── search.ts
│   │   │   │   ├── reverse.ts
│   │   │   │   ├── contribute.ts
│   │   │   │   └── admin.ts
│   │   │   ├── plugins/
│   │   │   │   ├── redis.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   └── cors.ts
│   │   │   └── server.ts
│   │   └── package.json
│   ├── crawler/
│   │   ├── src/
│   │   │   ├── crawl.ts
│   │   │   ├── rate-limiter.ts
│   │   │   ├── enrichment.ts
│   │   │   └── export.ts
│   │   └── package.json
│   ├── js-sdk/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── react/
│   │   ├── src/
│   │   │   ├── QNASLocationPicker.tsx
│   │   │   ├── useQatarAddress.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── nextjs/
│   │   ├── src/
│   │   │   ├── api.ts
│   │   │   ├── server.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── php-sdk/
│   │   ├── src/
│   │   │   └── Client.php
│   │   ├── tests/
│   │   └── composer.json
│   ├── laravel/
│   │   ├── src/
│   │   │   ├── QatarAddressServiceProvider.php
│   │   │   ├── Facades/
│   │   │   ├── Rules/
│   │   │   └── Views/
│   │   └── composer.json
│   ├── dart-sdk/
│   │   ├── lib/
│   │   │   └── qatar_address.dart
│   │   └── pubspec.yaml
│   └── flutter/
│       ├── lib/
│       │   └── qnas_location_picker.dart
│       └── pubspec.yaml
├── data/
│   ├── zones.json
│   ├── zones-polygons.geojson
│   ├── streets/
│   ├── buildings/
│   └── boundaries/
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.crawler
│   └── nginx.conf
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── .gitea/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy.yml
│       └── publish.yml
├── LICENSE
├── README.md
├── CONTRIBUTING.md
└── docs/
    ├── api-reference.md
    ├── self-hosting.md
    └── data-sources.md
```

---

## 7. v1 Ship Priorities

| Package | Priority | Description |
|---|---|---|
| `database` | P0 | Schema + migrations + seeds |
| `crawler` | P0 | Full QNAS harvester with resume |
| `api` | P0 | All public + admin endpoints |
| `data/` | P0 | Static JSON export of full DB |
| `js-sdk` | P0 | Core TypeScript client |
| `react` | P0 | Blue plate component (Tailwind) |
| Docker stack | P0 | Self-hosting ready |
| CI/CD | P0 | Gitea Actions (git.louis-innovations.com) |
| `nextjs` | P1 | API route + server helpers |
| `php-sdk` | P1 | Core PHP client |
| `laravel` | P1 | Service provider + validation + Blade |
| `dart-sdk` | P1 | Core Dart client |
| `flutter` | P1 | Blue plate widget |

---

## 8. Data Considerations

### Data Provenance

Qatar address data (zone numbers, street numbers, building numbers) is factual/geographic information. Facts and geographic coordinates are not copyrightable. The QNAS API is a lookup service built on top of government-issued address data (the blue plate system is mandated by Qatar's Ministry of Municipality).

### Static Export Versioning

Each data export includes a `manifest.json`:

```json
{
  "version": "1.0.0",
  "exported_at": "2026-04-15T12:00:00Z",
  "counts": {
    "zones": 98,
    "streets": 1504,
    "buildings": 48230
  },
  "sources": ["QNAS_API", "HDX", "OSM"],
  "checksum": "sha256:..."
}
```

### Apartment/Unit Field

The `showApartment` prop in React/Flutter components is a client-side display field only. Apartment/unit numbers are not part of the QNAS system and are not stored in the database. They are passed through to the `onChange` callback for the consuming application to handle.
