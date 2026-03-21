# QatarAddress Core Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the monorepo skeleton, PostgreSQL+PostGIS database, QNAS data crawler, Fastify REST API, and core JS/TS SDK — the foundation everything else depends on.

**Architecture:** Turborepo monorepo with pnpm workspaces. Five packages: `database` (migrations + seeds), `crawler` (QNAS harvester), `api` (Fastify server), `js-sdk` (TypeScript client), and shared `types`. PostgreSQL 16 + PostGIS for spatial data, Redis for API caching. All packages are TypeScript.

**Tech Stack:** TypeScript, Turborepo, pnpm, PostgreSQL 16, PostGIS, Fastify, Redis, Vitest, node-postgres (pg), ioredis

**Spec:** `docs/superpowers/specs/2026-03-21-qatar-address-design.md`

---

## File Structure

```
qatar-address/
├── package.json                          # Root: pnpm workspace + turborepo scripts
├── pnpm-workspace.yaml                   # Workspace package declarations
├── turbo.json                            # Turborepo pipeline config
├── tsconfig.base.json                    # Shared TypeScript config
├── .gitignore
├── .env.example                          # Environment variable template
├── LICENSE                               # AGPL v3
├── packages/
│   ├── types/                            # Shared TypeScript types
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                  # All shared interfaces/types
│   ├── database/                         # Schema, migrations, seeds
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── migrate.ts                # Migration runner
│   │       ├── seed.ts                   # Seed runner
│   │       ├── connection.ts             # PG pool factory
│   │       ├── migrations/
│   │       │   └── 001-initial-schema.sql
│   │       └── seeds/
│   │           └── 001-qatar-zones.sql
│   ├── crawler/                          # QNAS data harvester
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── crawl.ts                  # Main orchestrator
│   │       ├── qnas-client.ts            # QNAS API HTTP client
│   │       ├── rate-limiter.ts           # Token bucket rate limiter
│   │       ├── phases/
│   │       │   ├── zones.ts              # Phase 1-2: zones + polygons
│   │       │   ├── streets.ts            # Phase 3-4: streets + polygons
│   │       │   └── buildings.ts          # Phase 5-6: buildings + coordinates
│   │       ├── enrichment.ts             # HDX + OSM merge
│   │       └── export.ts                 # DB → JSON/GeoJSON files
│   ├── api/                              # Fastify REST API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── server.ts                 # Fastify app factory
│   │       ├── app.ts                    # Entry point
│   │       ├── plugins/
│   │       │   ├── database.ts           # PG pool plugin
│   │       │   ├── redis.ts              # Redis plugin
│   │       │   ├── rate-limit.ts         # Rate limit plugin
│   │       │   └── cors.ts              # CORS plugin
│   │       └── routes/
│   │           ├── zones.ts              # GET /api/v1/zones, /api/v1/zones/:zone
│   │           ├── streets.ts            # GET /api/v1/zones/:zone/streets
│   │           ├── buildings.ts          # GET /api/v1/zones/:zone/streets/:street/buildings
│   │           ├── locate.ts             # GET /api/v1/locate/:zone/:street/:building
│   │           ├── search.ts             # GET /api/v1/search
│   │           ├── reverse.ts            # GET /api/v1/reverse
│   │           ├── validate.ts           # GET /api/v1/validate
│   │           ├── contribute.ts         # POST /api/v1/contribute
│   │           ├── health.ts             # GET /api/v1/health, /api/v1/stats
│   │           └── admin.ts             # Admin CRUD endpoints
│   └── js-sdk/                           # @qatar-address/sdk
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                  # Public exports
│           ├── client.ts                 # QatarAddress client class
│           ├── types.ts                  # Re-exports from @qatar-address/types
│           └── errors.ts                # SDK error classes
├── tests/                                # Integration tests
│   ├── api/
│   │   ├── zones.test.ts
│   │   ├── locate.test.ts
│   │   ├── search.test.ts
│   │   ├── reverse.test.ts
│   │   ├── validate.test.ts
│   │   ├── contribute.test.ts
│   │   └── admin.test.ts
│   ├── crawler/
│   │   ├── rate-limiter.test.ts
│   │   ├── qnas-client.test.ts
│   │   └── phases.test.ts
│   └── js-sdk/
│       └── client.test.ts
├── data/                                 # Versioned address data (populated by crawler export)
│   └── .gitkeep
└── docker/
    ├── docker-compose.dev.yml            # Dev: postgres + redis only
    └── docker-compose.yml                # Prod: full stack
```

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `LICENSE`

- [ ] **Step 1: Initialize git repo**

```bash
cd c:/projects/BluePlate
git init
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "qatar-address",
  "version": "0.0.0",
  "private": true,
  "description": "Open-source Qatar National Address System",
  "license": "AGPL-3.0-or-later",
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "dev": "turbo dev",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 3: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 4: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 5: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.turbo/
*.env
!.env.example
.DS_Store
```

- [ ] **Step 7: Create .env.example**

```bash
# PostgreSQL
DATABASE_URL=postgresql://qatar:qatar@localhost:5432/qatar_address

# Redis
REDIS_URL=redis://localhost:6379

# QNAS API (for crawler)
QNAS_API_TOKEN=your_token_here
QNAS_API_DOMAIN=your_registered_domain

# Admin
ADMIN_API_KEY=generate_a_secure_key_here

# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
```

- [ ] **Step 8: Create LICENSE (AGPL v3)**

Write the standard AGPL v3 license text with copyright `2026 Louis Innovations`.

- [ ] **Step 9: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: initialize monorepo with Turborepo + pnpm workspaces"
```

---

## Task 2: Shared Types Package

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: Create packages/types/package.json**

```json
{
  "name": "@qatar-address/types",
  "version": "0.1.0",
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create packages/types/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/types/src/index.ts**

```typescript
// === Database Entities ===

export interface Zone {
  id: number;
  zone_number: number;
  zone_name: string | null;
  zone_name_ar: string | null;
  municipality: string | null;
  municipality_ar: string | null;
  source: DataSource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Street {
  id: number;
  zone_id: number;
  street_number: number;
  street_name: string | null;
  street_name_ar: string | null;
  source: DataSource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: number;
  street_id: number;
  building_number: number;
  latitude: number;
  longitude: number;
  source: DataSource;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contribution {
  id: number;
  zone_number: number;
  street_number: number;
  building_number: number;
  latitude: number | null;
  longitude: number | null;
  contributor_name: string;
  contributor_email: string;
  status: ContributionStatus;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// === Enums ===

export type DataSource = 'QNAS_API' | 'OSM' | 'COMMUNITY' | 'GENERATED' | 'HDX';
export type ContributionStatus = 'pending' | 'approved' | 'rejected';

// === API Response Types ===

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export type ApiErrorCode =
  | 'ADDRESS_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'DUPLICATE_CONTRIBUTION'
  | 'UNAUTHORIZED'
  | 'SERVER_ERROR';

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

// === Locate Response ===

export interface LocateResult {
  zone: { number: number; name: string | null; name_ar: string | null };
  street: { number: number; name: string | null; name_ar: string | null };
  building: { number: number };
  coordinates: { lat: number; lng: number };
  links: {
    google_maps: string;
    waze: string;
  };
  source: DataSource;
  verified: boolean;
  full_address: string;
  full_address_ar: string;
}

// === Validate Response ===

export interface ValidateResult {
  valid: boolean;
  zone_exists: boolean;
  street_exists: boolean;
  building_exists: boolean;
}

// === Search Result ===

export interface SearchResult {
  type: 'zone' | 'street';
  zone_number: number;
  zone_name: string | null;
  zone_name_ar: string | null;
  street_number?: number;
  street_name?: string | null;
  street_name_ar?: string | null;
}

// === Reverse Geocode Result ===

export interface ReverseResult {
  zone: { number: number; name: string | null; name_ar: string | null };
  street: { number: number; name: string | null; name_ar: string | null };
  building: { number: number };
  coordinates: { lat: number; lng: number };
  distance_meters: number;
  links: {
    google_maps: string;
    waze: string;
  };
}

// === Stats ===

export interface StatsResult {
  zones: { total: number; active: number };
  streets: { total: number };
  buildings: { total: number; verified: number };
  contributions: { pending: number; approved: number; rejected: number };
  last_crawl: string | null;
}

// === Health ===

export interface HealthResult {
  status: 'ok' | 'degraded' | 'down';
  database: boolean;
  redis: boolean;
  uptime_seconds: number;
}

// === Contribution Input ===

export interface ContributeInput {
  zone_number: number;
  street_number: number;
  building_number: number;
  latitude?: number;
  longitude?: number;
  contributor_name: string;
  contributor_email: string;
  notes?: string;
}

// === Zone Summary (for list endpoints) ===

export interface ZoneSummary {
  zone_number: number;
  zone_name: string | null;
  zone_name_ar: string | null;
  municipality: string | null;
  municipality_ar: string | null;
}

export interface StreetSummary {
  street_number: number;
  street_name: string | null;
  street_name_ar: string | null;
}

export interface BuildingSummary {
  building_number: number;
  coordinates: { lat: number; lng: number };
  source: DataSource;
  verified: boolean;
}
```

- [ ] **Step 4: Build types package**

```bash
cd packages/types && pnpm build
```

Expected: `dist/index.js` and `dist/index.d.ts` generated without errors.

- [ ] **Step 5: Commit**

```bash
git add packages/types
git commit -m "feat: add shared types package with all API/DB interfaces"
```

---

## Task 3: Database Package — Schema & Migrations

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/src/connection.ts`
- Create: `packages/database/src/migrate.ts`
- Create: `packages/database/src/migrations/001-initial-schema.sql`

- [ ] **Step 1: Create packages/database/package.json**

```json
{
  "name": "@qatar-address/database",
  "version": "0.1.0",
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "main": "./dist/connection.js",
  "types": "./dist/connection.d.ts",
  "exports": {
    ".": {
      "types": "./dist/connection.d.ts",
      "import": "./dist/connection.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "migrate": "node --loader ts-node/esm src/migrate.ts",
    "seed": "node --loader ts-node/esm src/seed.ts"
  },
  "dependencies": {
    "pg": "^8.13.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/pg": "^8.11.0",
    "ts-node": "^10.9.0"
  }
}
```

- [ ] **Step 2: Create packages/database/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/database/src/connection.ts**

```typescript
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

export function createPool(connectionString?: string): pg.Pool {
  return new Pool({
    connectionString: connectionString || process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export type { Pool } from 'pg';
```

- [ ] **Step 4: Create packages/database/src/migrate.ts**

```typescript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve migrations dir: works from both src/ (dev) and dist/ (compiled)
function resolveMigrationsDir(): string {
  const fromSrc = path.join(__dirname, 'migrations');
  if (fs.existsSync(fromSrc)) return fromSrc;
  // If running from dist/, go up to src/
  const fromDist = path.resolve(__dirname, '..', 'src', 'migrations');
  if (fs.existsSync(fromDist)) return fromDist;
  throw new Error(`Migrations directory not found. Checked: ${fromSrc}, ${fromDist}`);
}

async function migrate() {
  const pool = createPool();

  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get already-applied migrations
    const { rows: applied } = await pool.query(
      'SELECT name FROM migrations ORDER BY name'
    );
    const appliedNames = new Set(applied.map((r: { name: string }) => r.name));

    // Read migration files
    const migrationsDir = resolveMigrationsDir();
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`SKIP: ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`APPLYING: ${file}`);

      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await pool.query('COMMIT');
        console.log(`DONE: ${file}`);
      } catch (err) {
        await pool.query('ROLLBACK');
        console.error(`FAILED: ${file}`, err);
        process.exit(1);
      }
    }

    console.log('All migrations applied.');
  } finally {
    await pool.end();
  }
}

migrate();
```

- [ ] **Step 5: Create packages/database/src/migrations/001-initial-schema.sql**

```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Zones table
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

-- Streets table
CREATE TABLE streets (
  id SERIAL PRIMARY KEY,
  zone_id INT REFERENCES zones(id) ON DELETE RESTRICT,
  street_number INT NOT NULL,
  street_name VARCHAR(200),
  street_name_ar VARCHAR(200),
  geometry GEOMETRY(GEOMETRY, 4326),
  source VARCHAR(20) DEFAULT 'QNAS_API' CHECK (source IN ('QNAS_API', 'OSM', 'COMMUNITY', 'HDX')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(zone_id, street_number)
);

CREATE INDEX idx_streets_zone ON streets(zone_id);

-- Buildings table
CREATE TABLE buildings (
  id SERIAL PRIMARY KEY,
  street_id INT REFERENCES streets(id) ON DELETE RESTRICT,
  building_number INT NOT NULL,
  location GEOMETRY(POINT, 4326) NOT NULL,
  source VARCHAR(20) DEFAULT 'QNAS_API' CHECK (source IN ('QNAS_API', 'OSM', 'COMMUNITY', 'GENERATED')),
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(street_id, building_number)
);

CREATE INDEX idx_buildings_street ON buildings(street_id);
CREATE INDEX idx_buildings_location ON buildings USING GIST(location);

-- Contributions table
CREATE TABLE contributions (
  id SERIAL PRIMARY KEY,
  zone_number INT NOT NULL,
  street_number INT NOT NULL,
  building_number INT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  contributor_name VARCHAR(100) NOT NULL,
  contributor_email VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contributions_status ON contributions(status);
CREATE INDEX idx_contributions_dedup ON contributions(zone_number, street_number, building_number, created_at);

-- Crawl log table
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

-- Trigram indexes for search
CREATE INDEX idx_zones_name_trgm ON zones USING GIN(zone_name gin_trgm_ops);
CREATE INDEX idx_zones_name_ar_trgm ON zones USING GIN(zone_name_ar gin_trgm_ops);
CREATE INDEX idx_streets_name_trgm ON streets USING GIN(street_name gin_trgm_ops);
CREATE INDEX idx_streets_name_ar_trgm ON streets USING GIN(street_name_ar gin_trgm_ops);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER zones_updated_at BEFORE UPDATE ON zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER streets_updated_at BEFORE UPDATE ON streets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER buildings_updated_at BEFORE UPDATE ON buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 6: Build database package**

```bash
cd packages/database && pnpm build
```

Expected: compiles without errors.

- [ ] **Step 7: Commit**

```bash
git add packages/database
git commit -m "feat: add database package with PostgreSQL+PostGIS schema and migration runner"
```

---

## Task 4: Database Package — Zone Seed Data

**Files:**
- Create: `packages/database/src/seed.ts`
- Create: `packages/database/src/seeds/001-qatar-zones.sql`

- [ ] **Step 1: Create packages/database/src/seeds/001-qatar-zones.sql**

All 98 Qatar zones with English + Arabic names and municipality mappings:

```sql
INSERT INTO zones (zone_number, zone_name, zone_name_ar, municipality, municipality_ar) VALUES
(1,  'Doha Port',              'ميناء الدوحة',        'Ad-Dawhah', 'الدوحة'),
(2,  'Al Jasra',               'الجسرة',              'Ad-Dawhah', 'الدوحة'),
(3,  'Al Bidda',               'البدع',               'Ad-Dawhah', 'الدوحة'),
(4,  'Al Hitmi',               'الحتمي',              'Ad-Dawhah', 'الدوحة'),
(5,  'Najma',                  'نجمة',                'Ad-Dawhah', 'الدوحة'),
(6,  'Old Al Ghanim',          'الغانم القديم',        'Ad-Dawhah', 'الدوحة'),
(7,  'Musheireb',              'مشيرب',               'Ad-Dawhah', 'الدوحة'),
(8,  'Al Asmakh',              'الأصمخ',              'Ad-Dawhah', 'الدوحة'),
(9,  'Al Salata',              'السلطة',              'Ad-Dawhah', 'الدوحة'),
(10, 'Al Mirqab',              'المرقاب',             'Ad-Dawhah', 'الدوحة'),
(11, 'Musheireb Al Jadeed',    'مشيرب الجديد',         'Ad-Dawhah', 'الدوحة'),
(12, 'Doha Al Jadeed',         'الدوحة الجديدة',       'Ad-Dawhah', 'الدوحة'),
(13, 'Bin Mahmoud North',      'بن محمود الشمالية',    'Ad-Dawhah', 'الدوحة'),
(14, 'Bin Mahmoud South',      'بن محمود الجنوبية',    'Ad-Dawhah', 'الدوحة'),
(15, 'Rawdat Al Khail',        'روضة الخيل',          'Ad-Dawhah', 'الدوحة'),
(16, 'Al Mansoura',            'المنصورة',            'Ad-Dawhah', 'الدوحة'),
(17, 'Fereej Bin Omran',       'فريج بن عمران',       'Ad-Dawhah', 'الدوحة'),
(18, 'Al Muntazah',            'المنتزه',             'Ad-Dawhah', 'الدوحة'),
(19, 'Old Airport',            'المطار القديم',        'Ad-Dawhah', 'الدوحة'),
(20, 'Al Maamoura',            'المعمورة',            'Ad-Dawhah', 'الدوحة'),
(21, 'Al Hilal',               'الهلال',              'Ad-Dawhah', 'الدوحة'),
(22, 'Al Sadd',                'السد',                'Ad-Dawhah', 'الدوحة'),
(23, 'Al Mirqab Al Jadeed',    'المرقاب الجديد',       'Ad-Dawhah', 'الدوحة'),
(24, 'Al Nasr',                'النصر',               'Ad-Dawhah', 'الدوحة'),
(25, 'Dafna',                  'الدفنة',              'Ad-Dawhah', 'الدوحة'),
(26, 'Al Qassar',              'القصار',              'Ad-Dawhah', 'الدوحة'),
(27, 'Leabaib',                'لعبيب',               'Ad-Dawhah', 'الدوحة'),
(28, 'The Pearl',              'اللؤلؤة',             'Ad-Dawhah', 'الدوحة'),
(29, 'Ras Abu Aboud',          'رأس أبو عبود',        'Ad-Dawhah', 'الدوحة'),
(30, 'Al Khulaifat',           'الخليفات',            'Ad-Dawhah', 'الدوحة'),
(31, 'Madinat Khalifa North',  'مدينة خليفة الشمالية', 'Ad-Dawhah', 'الدوحة'),
(32, 'Al Thumama',             'الثمامة',             'Ad-Dawhah', 'الدوحة'),
(33, 'Madinat Khalifa South',  'مدينة خليفة الجنوبية', 'Ad-Dawhah', 'الدوحة'),
(34, 'Al Gharrafa',            'الغرافة',             'Ad-Dawhah', 'الدوحة'),
(35, 'Al Duhail North',        'الدحيل الشمالي',       'Ad-Dawhah', 'الدوحة'),
(36, 'Al Duhail South',        'الدحيل الجنوبي',       'Ad-Dawhah', 'الدوحة'),
(37, 'Al Markhiya',            'المرخية',             'Ad-Dawhah', 'الدوحة'),
(38, 'Al Tarfa',               'الطرفة',              'Ad-Dawhah', 'الدوحة'),
(39, 'Al Luqta',               'اللقطة',              'Ad-Dawhah', 'الدوحة'),
(40, 'Al Waab',                'الوعب',               'Ad-Dawhah', 'الدوحة'),
(41, 'Al Aziziya',             'العزيزية',            'Ad-Dawhah', 'الدوحة'),
(42, 'Fereej Al Ali',          'فريج العلي',          'Ad-Dawhah', 'الدوحة'),
(43, 'Umm Ghuwailina',         'أم غويلينة',          'Ad-Dawhah', 'الدوحة'),
(44, 'Al Messila',             'المسيلة',             'Ad-Dawhah', 'الدوحة'),
(45, 'West Bay',               'الخليج الغربي',       'Ad-Dawhah', 'الدوحة'),
(46, 'West Bay Lagoon',        'لاجون الخليج الغربي',  'Ad-Dawhah', 'الدوحة'),
(47, 'Fereej Abdul Aziz',      'فريج عبدالعزيز',      'Ad-Dawhah', 'الدوحة'),
(48, 'Al Rumaila',             'الرميلة',             'Ad-Dawhah', 'الدوحة'),
(49, 'Wadi Al Sail',           'وادي السيل',          'Ad-Dawhah', 'الدوحة'),
(50, 'Onaiza',                 'عنيزة',               'Ad-Dawhah', 'الدوحة'),
(51, 'New Al Rayyan',          'الريان الجديد',        'Al Rayyan', 'الريان'),
(52, 'Al Rayyan Al Qadeem',    'الريان القديم',        'Al Rayyan', 'الريان'),
(53, 'Muaither North',         'معيذر الشمالي',        'Al Rayyan', 'الريان'),
(54, 'Muaither South',         'معيذر الجنوبي',        'Al Rayyan', 'الريان'),
(55, 'Ain Khaled',             'عين خالد',            'Al Rayyan', 'الريان'),
(56, 'Al Shagub',              'الشقب',               'Al Rayyan', 'الريان'),
(57, 'Nuaija',                 'نعيجة',               'Ad-Dawhah', 'الدوحة'),
(58, 'Al Muraikh',             'المريخ',              'Ad-Dawhah', 'الدوحة'),
(59, 'Hazm Al Markhiya',       'حزم المرخية',         'Ad-Dawhah', 'الدوحة'),
(60, 'Fereej Al Nasr',         'فريج النصر',          'Ad-Dawhah', 'الدوحة'),
(61, 'Fereej Al Amir',         'فريج الأمير',         'Ad-Dawhah', 'الدوحة'),
(62, 'Umm Lekhba',             'أم لخبة',             'Ad-Dawhah', 'الدوحة'),
(63, 'Al Kheesa',              'الخيسة',              'Ad-Dawhah', 'الدوحة'),
(64, 'Umm Salal Mohammed',     'أم صلال محمد',         'Umm Salal', 'أم صلال'),
(65, 'Umm Salal Ali',          'أم صلال علي',          'Ad-Dawhah', 'الدوحة'),
(66, 'Al Ebb',                 'العب',                'Ad-Dawhah', 'الدوحة'),
(67, 'Semaisma',               'سميسمة',              'Ad-Dawhah', 'الدوحة'),
(68, 'Lusail',                 'لوسيل',               'Ad-Dawhah', 'الدوحة'),
(69, 'Al Daayen',              'الضعاين',             'Al Daayen', 'الضعاين'),
(70, 'Umm Qarn',               'أم قرن',              'Al Daayen', 'الضعاين'),
(71, 'Umm Salal',              'أم صلال',             'Umm Salal', 'أم صلال'),
(72, 'Al Shahaniya',           'الشحانية',            'Al-Shahaniya', 'الشحانية'),
(73, 'Dukhan',                 'دخان',                'Al-Shahaniya', 'الشحانية'),
(74, 'Al Khor',                'الخور',               'Al Khor', 'الخور'),
(75, 'Al Thakhira',            'الذخيرة',             'Al Khor', 'الخور'),
(76, 'Ras Laffan',             'رأس لفان',            'Al Khor', 'الخور'),
(77, 'Madinat Al Shamal',      'مدينة الشمال',         'Al Shamal', 'الشمال'),
(78, 'Al Ruwais',              'الرويس',              'Al Shamal', 'الشمال'),
(79, 'Al Ghuwairiya',          'الغويرية',            'Al Shamal', 'الشمال'),
(80, 'Rawdat Rashid',          'روضة راشد',           'Al-Shahaniya', 'الشحانية'),
(81, 'Al Sailiya',             'السيلية',             'Al Rayyan', 'الريان'),
(82, 'Al Jumailiya',           'الجميلية',            'Al-Shahaniya', 'الشحانية'),
(83, 'Abu Hamour',             'أبو هامور',           'Al Rayyan', 'الريان'),
(84, 'Al Nasraniya',           'النصرانية',           'Al-Shahaniya', 'الشحانية'),
(85, 'Al Themaid',             'الثميد',              'Al-Shahaniya', 'الشحانية'),
(86, 'Rawdat Al Hamama',       'روضة الحمامة',        'Al-Shahaniya', 'الشحانية'),
(87, 'Jeryan Nejaima',         'جريان نجيمة',         'Ad-Dawhah', 'الدوحة'),
(88, 'Mehairja',               'محيرجة',              'Ad-Dawhah', 'الدوحة'),
(89, 'Al Egla',                'العقلة',              'Ad-Dawhah', 'الدوحة'),
(90, 'Al Wakrah',              'الوكرة',              'Al Wakrah', 'الوكرة'),
(91, 'Al Wukair',              'الوكير',              'Al Wakrah', 'الوكرة'),
(92, 'Mesaieed',               'مسيعيد',              'Al Wakrah', 'الوكرة'),
(93, 'Al Kiranah',             'الكرعانة',            'Al Wakrah', 'الوكرة'),
(94, 'Abu Nakhla',             'أبو نخلة',            'Al Wakrah', 'الوكرة'),
(95, 'Muaither',               'معيذر',               'Al Wakrah', 'الوكرة'),
(96, 'Barwa City',             'مدينة بروة',          'Al Rayyan', 'الريان'),
(97, 'Education City',         'المدينة التعليمية',    'Al Rayyan', 'الريان'),
(98, 'Lusail City',            'مدينة لوسيل',         'Ad-Dawhah', 'الدوحة')
ON CONFLICT (zone_number) DO NOTHING;
```

- [ ] **Step 2: Create packages/database/src/seed.ts**

```typescript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve seeds dir: works from both src/ (dev) and dist/ (compiled)
function resolveSeedsDir(): string {
  const fromSrc = path.join(__dirname, 'seeds');
  if (fs.existsSync(fromSrc)) return fromSrc;
  const fromDist = path.resolve(__dirname, '..', 'src', 'seeds');
  if (fs.existsSync(fromDist)) return fromDist;
  throw new Error(`Seeds directory not found. Checked: ${fromSrc}, ${fromDist}`);
}

async function seed() {
  const pool = createPool();

  try {
    const seedsDir = resolveSeedsDir();
    const files = fs.readdirSync(seedsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(seedsDir, file), 'utf-8');
      console.log(`SEEDING: ${file}`);

      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await pool.query('COMMIT');
        console.log(`DONE: ${file}`);
      } catch (err) {
        await pool.query('ROLLBACK');
        console.error(`FAILED: ${file}`, err);
        process.exit(1);
      }
    }

    const { rows } = await pool.query('SELECT COUNT(*) as count FROM zones');
    console.log(`Seeded ${rows[0].count} zones.`);
  } finally {
    await pool.end();
  }
}

seed();
```

- [ ] **Step 3: Commit**

```bash
git add packages/database/src/seed.ts packages/database/src/seeds/
git commit -m "feat: add zone seed data for all 98 Qatar zones with Arabic names"
```

---

## Task 5: Dev Docker Compose (PostgreSQL + Redis)

**Files:**
- Create: `docker/docker-compose.dev.yml`

- [ ] **Step 1: Create docker/docker-compose.dev.yml**

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    container_name: qatar-address-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: qatar
      POSTGRES_PASSWORD: qatar
      POSTGRES_DB: qatar_address
    volumes:
      - qatar_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U qatar -d qatar_address"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: qatar-address-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  qatar_pgdata:
```

- [ ] **Step 2: Create .env from .env.example**

```bash
cp .env.example .env
# Edit .env to match docker-compose values:
# DATABASE_URL=postgresql://qatar:qatar@localhost:5432/qatar_address
# REDIS_URL=redis://localhost:6379
```

- [ ] **Step 3: Start dev services**

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Expected: Both containers running and healthy.

- [ ] **Step 4: Run migrations**

```bash
cd packages/database && pnpm migrate
```

Expected: `001-initial-schema.sql` applied successfully.

- [ ] **Step 5: Run seeds**

```bash
cd packages/database && pnpm seed
```

Expected: `Seeded 98 zones.`

- [ ] **Step 6: Verify data**

```bash
docker exec qatar-address-db psql -U qatar -d qatar_address -c "SELECT zone_number, zone_name, zone_name_ar FROM zones LIMIT 5;"
```

Expected: First 5 zones displayed with Arabic names.

- [ ] **Step 7: Commit**

```bash
git add docker/ .env.example
git commit -m "feat: add dev Docker Compose with PostGIS and Redis"
```

---

## Task 6: Crawler — Rate Limiter

**Files:**
- Create: `packages/crawler/package.json`
- Create: `packages/crawler/tsconfig.json`
- Create: `packages/crawler/src/rate-limiter.ts`
- Create: `tests/crawler/rate-limiter.test.ts`

- [ ] **Step 1: Create packages/crawler/package.json**

```json
{
  "name": "@qatar-address/crawler",
  "version": "0.1.0",
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "crawl": "node --loader ts-node/esm src/crawl.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@qatar-address/database": "workspace:*",
    "@qatar-address/types": "workspace:*",
    "pg": "^8.13.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/pg": "^8.11.0",
    "ts-node": "^10.9.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create packages/crawler/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing test for rate limiter**

Create `tests/crawler/rate-limiter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../../packages/crawler/src/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the per-minute limit', async () => {
    const limiter = new RateLimiter({ perMinute: 55, perDay: 950 });
    const canProceed = await limiter.acquire();
    expect(canProceed).toBe(true);
  });

  it('tracks daily request count', async () => {
    const limiter = new RateLimiter({ perMinute: 55, perDay: 5 });
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }
    expect(limiter.dailyCount).toBe(5);
  });

  it('blocks when daily limit is reached', async () => {
    const limiter = new RateLimiter({ perMinute: 55, perDay: 3 });
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    const result = await limiter.acquire();
    expect(result).toBe(false);
  });

  it('resets daily count after midnight', async () => {
    const limiter = new RateLimiter({ perMinute: 55, perDay: 3 });
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.dailyCount).toBe(3);

    // Advance 24 hours
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    limiter.checkDayReset();
    expect(limiter.dailyCount).toBe(0);
  });

  it('enforces minimum interval between requests', async () => {
    // 55 per minute = ~1090ms between requests
    const limiter = new RateLimiter({ perMinute: 55, perDay: 950 });
    const start = Date.now();
    await limiter.acquire();
    const waitPromise = limiter.acquire();

    // Should need to wait ~1090ms
    vi.advanceTimersByTime(1100);
    const result = await waitPromise;
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd packages/crawler && npx vitest run ../../tests/crawler/rate-limiter.test.ts
```

Expected: FAIL — `RateLimiter` not found.

- [ ] **Step 5: Implement rate limiter**

Create `packages/crawler/src/rate-limiter.ts`:

```typescript
export interface RateLimiterConfig {
  perMinute: number;
  perDay: number;
}

export class RateLimiter {
  private readonly minIntervalMs: number;
  private readonly maxPerDay: number;
  private lastRequestTime = 0;
  private _dailyCount = 0;
  private dayStart: number;

  constructor(config: RateLimiterConfig) {
    this.minIntervalMs = Math.ceil((60 * 1000) / config.perMinute);
    this.maxPerDay = config.perDay;
    this.dayStart = this.startOfDay();
  }

  get dailyCount(): number {
    return this._dailyCount;
  }

  checkDayReset(): void {
    const currentDay = this.startOfDay();
    if (currentDay > this.dayStart) {
      this._dailyCount = 0;
      this.dayStart = currentDay;
    }
  }

  async acquire(): Promise<boolean> {
    this.checkDayReset();

    if (this._dailyCount >= this.maxPerDay) {
      return false;
    }

    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - elapsed);
    }

    this.lastRequestTime = Date.now();
    this._dailyCount++;
    return true;
  }

  private startOfDay(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd packages/crawler && npx vitest run ../../tests/crawler/rate-limiter.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/crawler tests/crawler
git commit -m "feat: add rate limiter for QNAS API crawler (55/min, 950/day)"
```

---

## Task 7: Crawler — QNAS API Client

**Files:**
- Create: `packages/crawler/src/qnas-client.ts`
- Create: `tests/crawler/qnas-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/crawler/qnas-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QnasApiClient } from '../../packages/crawler/src/qnas-client.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('QnasApiClient', () => {
  let client: QnasApiClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new QnasApiClient({
      token: 'test-token',
      domain: 'test.example.com',
    });
  });

  it('sends correct headers with requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ zone: 1, name: 'Doha Port' }]),
    });

    await client.getZones();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/get_zones/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Token': 'test-token',
          'X-Domain': 'test.example.com',
        }),
      })
    );
  });

  it('fetches zones', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { zone: 1, zone_en: 'Doha Port', zone_ar: 'ميناء الدوحة' },
      ]),
    });

    const zones = await client.getZones();
    expect(zones).toHaveLength(1);
    expect(zones[0].zone).toBe(1);
  });

  it('fetches streets for a zone', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { street: 100, name_en: 'Main Street', name_ar: 'الشارع الرئيسي' },
      ]),
    });

    const streets = await client.getStreets(25);
    expect(streets).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/get_streets/25'),
      expect.any(Object)
    );
  });

  it('fetches building location', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        lat: 25.323456,
        lng: 51.527891,
      }),
    });

    const location = await client.getLocation(25, 230, 44);
    expect(location.lat).toBe(25.323456);
    expect(location.lng).toBe(51.527891);
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    await expect(client.getZones()).rejects.toThrow('429');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/crawler && npx vitest run ../../tests/crawler/qnas-client.test.ts
```

Expected: FAIL — `QnasApiClient` not found.

- [ ] **Step 3: Implement QNAS API client**

Create `packages/crawler/src/qnas-client.ts`:

```typescript
export interface QnasApiConfig {
  token: string;
  domain: string;
  baseUrl?: string;
}

export interface QnasZone {
  zone: number;
  zone_en?: string;
  zone_ar?: string;
  [key: string]: unknown;
}

export interface QnasStreet {
  street: number;
  name_en?: string;
  name_ar?: string;
  [key: string]: unknown;
}

export interface QnasBuilding {
  building: number;
  [key: string]: unknown;
}

export interface QnasLocation {
  lat: number;
  lng: number;
  [key: string]: unknown;
}

export interface QnasPolygon {
  coordinates: number[][];
  [key: string]: unknown;
}

export class QnasApiClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: QnasApiConfig) {
    this.baseUrl = config.baseUrl || 'https://qnas.qa';
    this.headers = {
      'X-Token': config.token,
      'X-Domain': config.domain,
      'Accept': 'application/json',
    };
  }

  async getZones(): Promise<QnasZone[]> {
    return this.request<QnasZone[]>('/get_zones/');
  }

  async getZonePolygon(zone: number): Promise<QnasPolygon> {
    return this.request<QnasPolygon>(`/get_zone_polygon/${zone}`);
  }

  async getStreets(zone: number): Promise<QnasStreet[]> {
    return this.request<QnasStreet[]>(`/get_streets/${zone}`);
  }

  async getStreetPolygon(zone: number, street: number): Promise<QnasPolygon> {
    return this.request<QnasPolygon>(`/get_street_polygon/${zone}/${street}`);
  }

  async getBuildings(zone: number, street: number): Promise<QnasBuilding[]> {
    return this.request<QnasBuilding[]>(`/get_buildings/${zone}/${street}`);
  }

  async getLocation(zone: number, street: number, building: number): Promise<QnasLocation> {
    return this.request<QnasLocation>(`/get_location/${zone}/${street}/${building}`);
  }

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(
        `QNAS API error: ${response.status} ${response.statusText} for ${endpoint}`
      );
    }

    return response.json() as Promise<T>;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/crawler && npx vitest run ../../tests/crawler/qnas-client.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/crawler/src/qnas-client.ts tests/crawler/qnas-client.test.ts
git commit -m "feat: add QNAS API client with typed endpoints"
```

---

## Task 8: Crawler — Crawl Phases

**Files:**
- Create: `packages/crawler/src/phases/zones.ts`
- Create: `packages/crawler/src/phases/streets.ts`
- Create: `packages/crawler/src/phases/buildings.ts`

- [ ] **Step 1: Create packages/crawler/src/phases/zones.ts**

```typescript
import type pg from 'pg';
import { QnasApiClient } from '../qnas-client.js';
import { RateLimiter } from '../rate-limiter.js';

export async function crawlZones(
  pool: pg.Pool,
  client: QnasApiClient,
  limiter: RateLimiter
): Promise<number> {
  let count = 0;

  // Phase 1: Fetch zone list
  const alreadyCrawled = await pool.query(
    "SELECT DISTINCT zone_number FROM crawl_log WHERE endpoint = 'zones' AND status = 'success'"
  );
  const crawledSet = new Set(alreadyCrawled.rows.map((r: { zone_number: number }) => r.zone_number));

  if (crawledSet.size === 0) {
    const canProceed = await limiter.acquire();
    if (!canProceed) return count;

    try {
      const zones = await client.getZones();
      for (const z of zones) {
        await pool.query(
          `INSERT INTO zones (zone_number, zone_name, zone_name_ar, source)
           VALUES ($1, $2, $3, 'QNAS_API')
           ON CONFLICT (zone_number) DO UPDATE SET
             zone_name = COALESCE(EXCLUDED.zone_name, zones.zone_name),
             zone_name_ar = COALESCE(EXCLUDED.zone_name_ar, zones.zone_name_ar)`,
          [z.zone, z.zone_en || null, z.zone_ar || null]
        );
      }

      await pool.query(
        "INSERT INTO crawl_log (endpoint, status) VALUES ('zones', 'success')"
      );
      count += zones.length;
      console.log(`Fetched ${zones.length} zones`);
    } catch (err) {
      await pool.query(
        "INSERT INTO crawl_log (endpoint, status, response_data) VALUES ('zones', 'failed', $1)",
        [JSON.stringify({ error: String(err) })]
      );
      throw err;
    }
  }

  // Phase 2: Fetch zone polygons
  const { rows: allZones } = await pool.query('SELECT zone_number FROM zones ORDER BY zone_number');

  const polygonsCrawled = await pool.query(
    "SELECT DISTINCT zone_number FROM crawl_log WHERE endpoint = 'zone_polygon' AND status = 'success'"
  );
  const polygonSet = new Set(polygonsCrawled.rows.map((r: { zone_number: number }) => r.zone_number));

  for (const { zone_number } of allZones) {
    if (polygonSet.has(zone_number)) continue;

    const canProceed = await limiter.acquire();
    if (!canProceed) {
      console.log(`Daily limit reached at zone polygon ${zone_number}. Will resume tomorrow.`);
      return count;
    }

    try {
      const polygon = await client.getZonePolygon(zone_number);

      if (polygon && polygon.coordinates) {
        const wkt = polygonToWkt(polygon.coordinates);
        await pool.query(
          `UPDATE zones SET
            boundary = ST_GeomFromText($1, 4326),
            centroid = ST_Centroid(ST_GeomFromText($1, 4326))
           WHERE zone_number = $2`,
          [wkt, zone_number]
        );
      }

      await pool.query(
        "INSERT INTO crawl_log (endpoint, zone_number, status) VALUES ('zone_polygon', $1, 'success')",
        [zone_number]
      );
      count++;
      console.log(`Zone ${zone_number} polygon saved`);
    } catch (err) {
      await pool.query(
        "INSERT INTO crawl_log (endpoint, zone_number, status, response_data) VALUES ('zone_polygon', $1, 'failed', $2)",
        [zone_number, JSON.stringify({ error: String(err) })]
      );
      console.error(`Zone ${zone_number} polygon failed: ${err}`);
    }
  }

  return count;
}

function polygonToWkt(coords: number[][]): string {
  const points = coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  // Close the polygon if not already closed
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return `POLYGON((${points}, ${first[0]} ${first[1]}))`;
  }
  return `POLYGON((${points}))`;
}
```

- [ ] **Step 2: Create packages/crawler/src/phases/streets.ts**

```typescript
import type pg from 'pg';
import { QnasApiClient } from '../qnas-client.js';
import { RateLimiter } from '../rate-limiter.js';

export async function crawlStreets(
  pool: pg.Pool,
  client: QnasApiClient,
  limiter: RateLimiter
): Promise<number> {
  let count = 0;
  const { rows: zones } = await pool.query('SELECT id, zone_number FROM zones ORDER BY zone_number');

  // Phase 3: Fetch street lists
  const streetsCrawled = await pool.query(
    "SELECT DISTINCT zone_number FROM crawl_log WHERE endpoint = 'streets' AND status = 'success'"
  );
  const streetsSet = new Set(streetsCrawled.rows.map((r: { zone_number: number }) => r.zone_number));

  for (const { id: zoneId, zone_number } of zones) {
    if (streetsSet.has(zone_number)) continue;

    const canProceed = await limiter.acquire();
    if (!canProceed) {
      console.log(`Daily limit reached at streets for zone ${zone_number}. Will resume tomorrow.`);
      return count;
    }

    try {
      const streets = await client.getStreets(zone_number);

      for (const s of streets) {
        await pool.query(
          `INSERT INTO streets (zone_id, street_number, street_name, street_name_ar, source)
           VALUES ($1, $2, $3, $4, 'QNAS_API')
           ON CONFLICT (zone_id, street_number) DO UPDATE SET
             street_name = COALESCE(EXCLUDED.street_name, streets.street_name),
             street_name_ar = COALESCE(EXCLUDED.street_name_ar, streets.street_name_ar)`,
          [zoneId, s.street, s.name_en || null, s.name_ar || null]
        );
      }

      await pool.query(
        "INSERT INTO crawl_log (endpoint, zone_number, status) VALUES ('streets', $1, 'success')",
        [zone_number]
      );
      count += streets.length;
      console.log(`Zone ${zone_number}: ${streets.length} streets`);
    } catch (err) {
      await pool.query(
        "INSERT INTO crawl_log (endpoint, zone_number, status, response_data) VALUES ('streets', $1, 'failed', $2)",
        [zone_number, JSON.stringify({ error: String(err) })]
      );
      console.error(`Zone ${zone_number} streets failed: ${err}`);
    }
  }

  // Phase 4: Fetch street polygons
  const { rows: allStreets } = await pool.query(
    `SELECT s.id, s.street_number, z.zone_number
     FROM streets s JOIN zones z ON s.zone_id = z.id
     ORDER BY z.zone_number, s.street_number`
  );

  const polysCrawled = await pool.query(
    "SELECT zone_number, street_number FROM crawl_log WHERE endpoint = 'street_polygon' AND status = 'success'"
  );
  const polySet = new Set(
    polysCrawled.rows.map((r: { zone_number: number; street_number: number }) => `${r.zone_number}-${r.street_number}`)
  );

  for (const { id: streetId, street_number, zone_number } of allStreets) {
    if (polySet.has(`${zone_number}-${street_number}`)) continue;

    const canProceed = await limiter.acquire();
    if (!canProceed) {
      console.log(`Daily limit reached at street polygon z${zone_number}/s${street_number}. Will resume tomorrow.`);
      return count;
    }

    try {
      const polygon = await client.getStreetPolygon(zone_number, street_number);

      if (polygon && polygon.coordinates) {
        // Store as generic geometry — could be linestring or polygon
        const geoJson = JSON.stringify({
          type: 'LineString',
          coordinates: polygon.coordinates,
        });
        await pool.query(
          'UPDATE streets SET geometry = ST_GeomFromGeoJSON($1) WHERE id = $2',
          [geoJson, streetId]
        );
      }

      await pool.query(
        "INSERT INTO crawl_log (endpoint, zone_number, street_number, status) VALUES ('street_polygon', $1, $2, 'success')",
        [zone_number, street_number]
      );
      count++;
    } catch (err) {
      await pool.query(
        "INSERT INTO crawl_log (endpoint, zone_number, street_number, status, response_data) VALUES ('street_polygon', $1, $2, 'failed', $3)",
        [zone_number, street_number, JSON.stringify({ error: String(err) })]
      );
    }
  }

  return count;
}
```

- [ ] **Step 3: Create packages/crawler/src/phases/buildings.ts**

```typescript
import type pg from 'pg';
import { QnasApiClient } from '../qnas-client.js';
import { RateLimiter } from '../rate-limiter.js';

export async function crawlBuildings(
  pool: pg.Pool,
  client: QnasApiClient,
  limiter: RateLimiter
): Promise<number> {
  let count = 0;

  const { rows: streets } = await pool.query(
    `SELECT s.id as street_id, s.street_number, z.zone_number
     FROM streets s JOIN zones z ON s.zone_id = z.id
     ORDER BY z.zone_number, s.street_number`
  );

  // Phase 5: Fetch building lists
  const buildingsCrawled = await pool.query(
    "SELECT zone_number, street_number FROM crawl_log WHERE endpoint = 'buildings' AND status = 'success'"
  );
  const buildingsSet = new Set(
    buildingsCrawled.rows.map((r: { zone_number: number; street_number: number }) => `${r.zone_number}-${r.street_number}`)
  );

  for (const { street_id, street_number, zone_number } of streets) {
    if (buildingsSet.has(`${zone_number}-${street_number}`)) continue;

    const canProceed = await limiter.acquire();
    if (!canProceed) {
      console.log(`Daily limit reached. Processed ${count} items. Will resume tomorrow.`);
      return count;
    }

    try {
      const buildings = await client.getBuildings(zone_number, street_number);

      for (const b of buildings) {
        // Insert building placeholder — coordinates come in Phase 6
        await pool.query(
          `INSERT INTO buildings (street_id, building_number, location, source)
           VALUES ($1, $2, ST_SetSRID(ST_MakePoint(0, 0), 4326), 'QNAS_API')
           ON CONFLICT (street_id, building_number) DO NOTHING`,
          [street_id, b.building]
        );
      }

      await pool.query(
        "INSERT INTO crawl_log (endpoint, zone_number, street_number, status) VALUES ('buildings', $1, $2, 'success')",
        [zone_number, street_number]
      );
      count += buildings.length;
      console.log(`Zone ${zone_number}, Street ${street_number}: ${buildings.length} buildings`);
    } catch (err) {
      await pool.query(
        "INSERT INTO crawl_log (endpoint, zone_number, street_number, status, response_data) VALUES ('buildings', $1, $2, 'failed', $3)",
        [zone_number, street_number, JSON.stringify({ error: String(err) })]
      );
      console.error(`z${zone_number}/s${street_number} buildings failed: ${err}`);
    }
  }

  // Phase 6: Fetch building coordinates
  const { rows: unlocated } = await pool.query(
    `SELECT b.id, b.building_number, s.street_number, z.zone_number
     FROM buildings b
     JOIN streets s ON b.street_id = s.id
     JOIN zones z ON s.zone_id = z.id
     WHERE ST_X(b.location) = 0 AND ST_Y(b.location) = 0
     ORDER BY z.zone_number, s.street_number, b.building_number`
  );

  const locationsCrawled = await pool.query(
    "SELECT zone_number, street_number, building_number FROM crawl_log WHERE endpoint = 'location' AND status = 'success'"
  );
  const locSet = new Set(
    locationsCrawled.rows.map(
      (r: { zone_number: number; street_number: number; building_number: number }) =>
        `${r.zone_number}-${r.street_number}-${r.building_number}`
    )
  );

  for (const { id, building_number, street_number, zone_number } of unlocated) {
    if (locSet.has(`${zone_number}-${street_number}-${building_number}`)) continue;

    const canProceed = await limiter.acquire();
    if (!canProceed) {
      console.log(`Daily limit reached. Processed ${count} items total. Will resume tomorrow.`);
      return count;
    }

    try {
      const loc = await client.getLocation(zone_number, street_number, building_number);

      await pool.query(
        `UPDATE buildings SET
          location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
          verified = true,
          verified_at = NOW()
         WHERE id = $3`,
        [loc.lng, loc.lat, id]
      );

      await pool.query(
        "INSERT INTO crawl_log (endpoint, zone_number, street_number, building_number, status) VALUES ('location', $1, $2, $3, 'success')",
        [zone_number, street_number, building_number]
      );
      count++;

      if (count % 100 === 0) {
        console.log(`Located ${count} buildings so far (daily: ${limiter.dailyCount})`);
      }
    } catch (err) {
      await pool.query(
        "INSERT INTO crawl_log (endpoint, zone_number, street_number, building_number, status, response_data) VALUES ('location', $1, $2, $3, 'failed', $4)",
        [zone_number, street_number, building_number, JSON.stringify({ error: String(err) })]
      );
    }
  }

  return count;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/crawler/src/phases/
git commit -m "feat: add crawler phases for zones, streets, and buildings"
```

---

## Task 9: Crawler — Main Orchestrator

**Files:**
- Create: `packages/crawler/src/crawl.ts`
- Create: `packages/crawler/src/export.ts`

- [ ] **Step 1: Create packages/crawler/src/crawl.ts**

```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { createPool } from '@qatar-address/database';
import { QnasApiClient } from './qnas-client.js';
import { RateLimiter } from './rate-limiter.js';
import { crawlZones } from './phases/zones.js';
import { crawlStreets } from './phases/streets.js';
import { crawlBuildings } from './phases/buildings.js';

async function main() {
  const token = process.env.QNAS_API_TOKEN;
  const domain = process.env.QNAS_API_DOMAIN;

  if (!token || !domain) {
    console.error('QNAS_API_TOKEN and QNAS_API_DOMAIN must be set in .env');
    process.exit(1);
  }

  const pool = createPool();
  const client = new QnasApiClient({ token, domain });
  const limiter = new RateLimiter({ perMinute: 55, perDay: 950 });

  console.log('=== QatarAddress Crawler ===');
  console.log(`Started at ${new Date().toISOString()}`);

  try {
    // Phase 1-2: Zones + polygons
    console.log('\n--- Phase 1-2: Zones ---');
    const zoneCount = await crawlZones(pool, client, limiter);
    console.log(`Zones phase: ${zoneCount} items processed`);

    if (limiter.dailyCount >= 950) {
      console.log('Daily limit reached after zones. Run again tomorrow.');
      return;
    }

    // Phase 3-4: Streets + polygons
    console.log('\n--- Phase 3-4: Streets ---');
    const streetCount = await crawlStreets(pool, client, limiter);
    console.log(`Streets phase: ${streetCount} items processed`);

    if (limiter.dailyCount >= 950) {
      console.log('Daily limit reached after streets. Run again tomorrow.');
      return;
    }

    // Phase 5-6: Buildings + coordinates
    console.log('\n--- Phase 5-6: Buildings ---');
    const buildingCount = await crawlBuildings(pool, client, limiter);
    console.log(`Buildings phase: ${buildingCount} items processed`);

    // Summary
    const { rows: stats } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM zones) as zones,
        (SELECT COUNT(*) FROM streets) as streets,
        (SELECT COUNT(*) FROM buildings) as buildings,
        (SELECT COUNT(*) FROM buildings WHERE ST_X(location) != 0) as located
    `);

    console.log('\n=== Crawl Summary ===');
    console.log(`Zones: ${stats[0].zones}`);
    console.log(`Streets: ${stats[0].streets}`);
    console.log(`Buildings: ${stats[0].buildings} (${stats[0].located} with coordinates)`);
    console.log(`Daily requests used: ${limiter.dailyCount}/950`);
    console.log(`Finished at ${new Date().toISOString()}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Crawler fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Create packages/crawler/src/export.ts**

```typescript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { createPool } from '@qatar-address/database';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../../data');

async function exportData() {
  const pool = createPool();

  try {
    // Ensure directories exist
    fs.mkdirSync(path.join(DATA_DIR, 'streets'), { recursive: true });
    fs.mkdirSync(path.join(DATA_DIR, 'buildings'), { recursive: true });

    // Export zones
    const { rows: zones } = await pool.query(
      `SELECT zone_number, zone_name, zone_name_ar, municipality, municipality_ar,
              ST_Y(centroid) as centroid_lat, ST_X(centroid) as centroid_lng
       FROM zones WHERE is_active = true ORDER BY zone_number`
    );
    fs.writeFileSync(
      path.join(DATA_DIR, 'zones.json'),
      JSON.stringify(zones, null, 2)
    );
    console.log(`Exported ${zones.length} zones`);

    // Export zone polygons as GeoJSON
    const { rows: polygons } = await pool.query(
      `SELECT zone_number, zone_name, zone_name_ar,
              ST_AsGeoJSON(boundary)::json as geometry
       FROM zones WHERE boundary IS NOT NULL AND is_active = true ORDER BY zone_number`
    );
    const geoJson = {
      type: 'FeatureCollection',
      features: polygons.map(z => ({
        type: 'Feature',
        properties: {
          zone_number: z.zone_number,
          zone_name: z.zone_name,
          zone_name_ar: z.zone_name_ar,
        },
        geometry: z.geometry,
      })),
    };
    fs.writeFileSync(
      path.join(DATA_DIR, 'zones-polygons.geojson'),
      JSON.stringify(geoJson, null, 2)
    );

    // Export streets per zone
    for (const zone of zones) {
      const { rows: streets } = await pool.query(
        `SELECT s.street_number, s.street_name, s.street_name_ar
         FROM streets s JOIN zones z ON s.zone_id = z.id
         WHERE z.zone_number = $1 AND s.is_active = true
         ORDER BY s.street_number`,
        [zone.zone_number]
      );
      if (streets.length > 0) {
        fs.writeFileSync(
          path.join(DATA_DIR, 'streets', `zone-${String(zone.zone_number).padStart(2, '0')}.json`),
          JSON.stringify(streets, null, 2)
        );
      }
    }

    // Export buildings per zone/street
    for (const zone of zones) {
      const zoneDir = path.join(DATA_DIR, 'buildings', `zone-${String(zone.zone_number).padStart(2, '0')}`);

      const { rows: streets } = await pool.query(
        `SELECT s.id, s.street_number FROM streets s
         JOIN zones z ON s.zone_id = z.id
         WHERE z.zone_number = $1 AND s.is_active = true`,
        [zone.zone_number]
      );

      for (const street of streets) {
        const { rows: buildings } = await pool.query(
          `SELECT building_number, ST_Y(location) as lat, ST_X(location) as lng, source, verified
           FROM buildings WHERE street_id = $1 AND ST_X(location) != 0
           ORDER BY building_number`,
          [street.id]
        );

        if (buildings.length > 0) {
          fs.mkdirSync(zoneDir, { recursive: true });
          fs.writeFileSync(
            path.join(zoneDir, `street-${String(street.street_number).padStart(3, '0')}.json`),
            JSON.stringify(buildings, null, 2)
          );
        }
      }
    }

    // Write manifest
    const { rows: stats } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM zones WHERE is_active = true) as zones,
        (SELECT COUNT(*) FROM streets WHERE is_active = true) as streets,
        (SELECT COUNT(*) FROM buildings WHERE ST_X(location) != 0) as buildings
    `);
    const manifest = {
      version: '0.1.0',
      exported_at: new Date().toISOString(),
      counts: {
        zones: parseInt(stats[0].zones),
        streets: parseInt(stats[0].streets),
        buildings: parseInt(stats[0].buildings),
      },
      sources: ['QNAS_API'],
    };
    fs.writeFileSync(
      path.join(DATA_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log('Export complete. See data/ directory.');
  } finally {
    await pool.end();
  }
}

exportData().catch(err => {
  console.error('Export error:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/crawler/src/crawl.ts packages/crawler/src/export.ts
git commit -m "feat: add crawler orchestrator and JSON/GeoJSON data exporter"
```

---

## Task 10: API Server — Core Setup + Plugins

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/src/server.ts`
- Create: `packages/api/src/app.ts`
- Create: `packages/api/src/plugins/database.ts`
- Create: `packages/api/src/plugins/redis.ts`
- Create: `packages/api/src/plugins/rate-limit.ts`
- Create: `packages/api/src/plugins/cors.ts`

- [ ] **Step 1: Create packages/api/package.json**

```json
{
  "name": "@qatar-address/api",
  "version": "0.1.0",
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "dev": "tsx watch src/app.ts",
    "start": "node dist/app.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@qatar-address/database": "workspace:*",
    "@qatar-address/types": "workspace:*",
    "fastify": "^5.2.0",
    "@fastify/cors": "^11.0.0",
    "@fastify/rate-limit": "^10.2.0",
    "ioredis": "^5.4.0",
    "pg": "^8.13.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/pg": "^8.11.0",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create packages/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/api/src/plugins/database.ts**

```typescript
import fp from 'fastify-plugin';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    pg: pg.Pool;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
  });

  // Verify connection
  await pool.query('SELECT 1');

  fastify.decorate('pg', pool);
  fastify.addHook('onClose', async () => {
    await pool.end();
  });
}, { name: 'database' });
```

Add `fastify-plugin` to dependencies:

```bash
cd packages/api && pnpm add fastify-plugin
```

- [ ] **Step 4: Create packages/api/src/plugins/redis.ts**

```typescript
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  let redis: Redis | null = null;

  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await redis.connect();
    fastify.log.info('Redis connected');
  } catch (err) {
    fastify.log.warn('Redis unavailable — running without cache');
    redis = null;
  }

  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => {
    if (redis) await redis.quit();
  });
}, { name: 'redis' });
```

- [ ] **Step 5: Create packages/api/src/plugins/rate-limit.ts**

```typescript
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down.',
      },
    }),
  });
}, { name: 'rate-limit' });
```

- [ ] **Step 6: Create packages/api/src/plugins/cors.ts**

```typescript
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
}, { name: 'cors' });
```

- [ ] **Step 7: Create packages/api/src/server.ts**

```typescript
import Fastify from 'fastify';
import database from './plugins/database.js';
import redis from './plugins/redis.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import corsPlugin from './plugins/cors.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Register plugins
  await fastify.register(corsPlugin);
  await fastify.register(database);
  await fastify.register(redis);
  await fastify.register(rateLimitPlugin);

  // Global error handler
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    reply.status(error.statusCode || 500).send({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message,
      },
    });
  });

  // 404 handler
  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'ADDRESS_NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  return fastify;
}
```

- [ ] **Step 8: Create packages/api/src/app.ts**

```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { buildServer } from './server.js';

async function main() {
  const server = await buildServer();

  const port = parseInt(process.env.PORT || '3000');
  const host = process.env.HOST || '0.0.0.0';

  await server.listen({ port, host });
  console.log(`QatarAddress API listening on ${host}:${port}`);
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

- [ ] **Step 9: Commit**

```bash
git add packages/api
git commit -m "feat: add Fastify API server with database, redis, rate-limit, and CORS plugins"
```

---

## Task 11: API Routes — Zones, Streets, Buildings, Locate

**Files:**
- Create: `packages/api/src/routes/zones.ts`
- Create: `packages/api/src/routes/streets.ts`
- Create: `packages/api/src/routes/buildings.ts`
- Create: `packages/api/src/routes/locate.ts`
- Create: `packages/api/src/routes/health.ts`

- [ ] **Step 1: Create packages/api/src/routes/health.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export default async function healthRoutes(fastify: FastifyInstance) {
  const startTime = Date.now();

  fastify.get('/api/v1/health', async (_request, reply) => {
    let dbOk = false;
    let redisOk = false;

    try {
      await fastify.pg.query('SELECT 1');
      dbOk = true;
    } catch { /* db down */ }

    try {
      if (fastify.redis) {
        await fastify.redis.ping();
        redisOk = true;
      }
    } catch { /* redis down */ }

    const status = dbOk ? (redisOk ? 'ok' : 'degraded') : 'down';
    const code = status === 'down' ? 503 : 200;

    reply.status(code).send({
      success: true,
      data: {
        status,
        database: dbOk,
        redis: redisOk,
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      },
    });
  });

  fastify.get('/api/v1/stats', async () => {
    const { rows } = await fastify.pg.query(`
      SELECT
        (SELECT COUNT(*) FROM zones) as zones_total,
        (SELECT COUNT(*) FROM zones WHERE is_active = true) as zones_active,
        (SELECT COUNT(*) FROM streets WHERE is_active = true) as streets_total,
        (SELECT COUNT(*) FROM buildings) as buildings_total,
        (SELECT COUNT(*) FROM buildings WHERE verified = true) as buildings_verified,
        (SELECT COUNT(*) FROM contributions WHERE status = 'pending') as contrib_pending,
        (SELECT COUNT(*) FROM contributions WHERE status = 'approved') as contrib_approved,
        (SELECT COUNT(*) FROM contributions WHERE status = 'rejected') as contrib_rejected,
        (SELECT MAX(created_at) FROM crawl_log WHERE status = 'success') as last_crawl
    `);

    const s = rows[0];
    return {
      success: true,
      data: {
        zones: { total: parseInt(s.zones_total), active: parseInt(s.zones_active) },
        streets: { total: parseInt(s.streets_total) },
        buildings: { total: parseInt(s.buildings_total), verified: parseInt(s.buildings_verified) },
        contributions: {
          pending: parseInt(s.contrib_pending),
          approved: parseInt(s.contrib_approved),
          rejected: parseInt(s.contrib_rejected),
        },
        last_crawl: s.last_crawl,
      },
    };
  });
}
```

- [ ] **Step 2: Create packages/api/src/routes/zones.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export default async function zoneRoutes(fastify: FastifyInstance) {
  // GET /api/v1/zones
  fastify.get('/api/v1/zones', async (request) => {
    const { page = '1', limit = '50' } = request.query as { page?: string; limit?: string };
    const p = Math.max(1, parseInt(page));
    const l = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (p - 1) * l;

    // Try cache
    const cacheKey = `zones:${p}:${l}`;
    if (fastify.redis) {
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const { rows } = await fastify.pg.query(
      `SELECT zone_number, zone_name, zone_name_ar, municipality, municipality_ar
       FROM zones WHERE is_active = true
       ORDER BY zone_number
       LIMIT $1 OFFSET $2`,
      [l, offset]
    );

    const { rows: countRows } = await fastify.pg.query(
      'SELECT COUNT(*) as total FROM zones WHERE is_active = true'
    );
    const total = parseInt(countRows[0].total);

    const response = {
      success: true,
      data: rows,
      pagination: { page: p, limit: l, total, has_more: offset + l < total },
    };

    if (fastify.redis) {
      await fastify.redis.setex(cacheKey, 3600, JSON.stringify(response));
    }

    return response;
  });

  // GET /api/v1/zones/:zone
  fastify.get('/api/v1/zones/:zone', async (request, reply) => {
    const { zone } = request.params as { zone: string };
    const zoneNum = parseInt(zone);

    if (isNaN(zoneNum) || zoneNum < 1 || zoneNum > 98) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Zone must be between 1 and 98' },
      });
    }

    const { rows } = await fastify.pg.query(
      `SELECT zone_number, zone_name, zone_name_ar, municipality, municipality_ar,
              ST_AsGeoJSON(boundary)::json as boundary
       FROM zones WHERE zone_number = $1 AND is_active = true`,
      [zoneNum]
    );

    if (rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ADDRESS_NOT_FOUND', message: `Zone ${zoneNum} not found` },
      });
    }

    return { success: true, data: rows[0] };
  });
}
```

- [ ] **Step 3: Create packages/api/src/routes/streets.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export default async function streetRoutes(fastify: FastifyInstance) {
  // GET /api/v1/zones/:zone/streets
  fastify.get('/api/v1/zones/:zone/streets', async (request, reply) => {
    const { zone } = request.params as { zone: string };
    const { page = '1', limit = '50' } = request.query as { page?: string; limit?: string };
    const zoneNum = parseInt(zone);
    const p = Math.max(1, parseInt(page));
    const l = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (p - 1) * l;

    if (isNaN(zoneNum) || zoneNum < 1 || zoneNum > 98) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Zone must be between 1 and 98' },
      });
    }

    const { rows } = await fastify.pg.query(
      `SELECT s.street_number, s.street_name, s.street_name_ar
       FROM streets s JOIN zones z ON s.zone_id = z.id
       WHERE z.zone_number = $1 AND s.is_active = true
       ORDER BY s.street_number
       LIMIT $2 OFFSET $3`,
      [zoneNum, l, offset]
    );

    const { rows: countRows } = await fastify.pg.query(
      `SELECT COUNT(*) as total FROM streets s JOIN zones z ON s.zone_id = z.id
       WHERE z.zone_number = $1 AND s.is_active = true`,
      [zoneNum]
    );
    const total = parseInt(countRows[0].total);

    return {
      success: true,
      data: rows,
      pagination: { page: p, limit: l, total, has_more: offset + l < total },
    };
  });

  // GET /api/v1/zones/:zone/streets/:street
  fastify.get('/api/v1/zones/:zone/streets/:street', async (request, reply) => {
    const { zone, street } = request.params as { zone: string; street: string };
    const zoneNum = parseInt(zone);
    const streetNum = parseInt(street);

    const { rows } = await fastify.pg.query(
      `SELECT s.street_number, s.street_name, s.street_name_ar,
              ST_AsGeoJSON(s.geometry)::json as geometry
       FROM streets s JOIN zones z ON s.zone_id = z.id
       WHERE z.zone_number = $1 AND s.street_number = $2 AND s.is_active = true`,
      [zoneNum, streetNum]
    );

    if (rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ADDRESS_NOT_FOUND', message: `Street ${streetNum} in Zone ${zoneNum} not found` },
      });
    }

    return { success: true, data: rows[0] };
  });
}
```

- [ ] **Step 4: Create packages/api/src/routes/buildings.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export default async function buildingRoutes(fastify: FastifyInstance) {
  // GET /api/v1/zones/:zone/streets/:street/buildings
  fastify.get('/api/v1/zones/:zone/streets/:street/buildings', async (request, reply) => {
    const { zone, street } = request.params as { zone: string; street: string };
    const { page = '1', limit = '50' } = request.query as { page?: string; limit?: string };
    const zoneNum = parseInt(zone);
    const streetNum = parseInt(street);
    const p = Math.max(1, parseInt(page));
    const l = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (p - 1) * l;

    const { rows } = await fastify.pg.query(
      `SELECT b.building_number,
              ST_Y(b.location) as lat, ST_X(b.location) as lng,
              b.source, b.verified
       FROM buildings b
       JOIN streets s ON b.street_id = s.id
       JOIN zones z ON s.zone_id = z.id
       WHERE z.zone_number = $1 AND s.street_number = $2
         AND ST_X(b.location) != 0
       ORDER BY b.building_number
       LIMIT $3 OFFSET $4`,
      [zoneNum, streetNum, l, offset]
    );

    const { rows: countRows } = await fastify.pg.query(
      `SELECT COUNT(*) as total FROM buildings b
       JOIN streets s ON b.street_id = s.id
       JOIN zones z ON s.zone_id = z.id
       WHERE z.zone_number = $1 AND s.street_number = $2
         AND ST_X(b.location) != 0`,
      [zoneNum, streetNum]
    );
    const total = parseInt(countRows[0].total);

    return {
      success: true,
      data: rows.map(b => ({
        building_number: b.building_number,
        coordinates: { lat: parseFloat(b.lat), lng: parseFloat(b.lng) },
        source: b.source,
        verified: b.verified,
      })),
      pagination: { page: p, limit: l, total, has_more: offset + l < total },
    };
  });
}
```

- [ ] **Step 5: Create packages/api/src/routes/locate.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export default async function locateRoutes(fastify: FastifyInstance) {
  // GET /api/v1/locate/:zone/:street/:building
  fastify.get('/api/v1/locate/:zone/:street/:building', async (request, reply) => {
    const { zone, street, building } = request.params as {
      zone: string; street: string; building: string;
    };
    const zoneNum = parseInt(zone);
    const streetNum = parseInt(street);
    const buildingNum = parseInt(building);

    // Try cache
    const cacheKey = `locate:${zoneNum}:${streetNum}:${buildingNum}`;
    if (fastify.redis) {
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const { rows } = await fastify.pg.query(
      `SELECT
         z.zone_number, z.zone_name, z.zone_name_ar,
         s.street_number, s.street_name, s.street_name_ar,
         b.building_number,
         ST_Y(b.location) as lat, ST_X(b.location) as lng,
         b.source, b.verified
       FROM buildings b
       JOIN streets s ON b.street_id = s.id
       JOIN zones z ON s.zone_id = z.id
       WHERE z.zone_number = $1 AND s.street_number = $2 AND b.building_number = $3`,
      [zoneNum, streetNum, buildingNum]
    );

    if (rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'ADDRESS_NOT_FOUND',
          message: `Building ${buildingNum} not found on Street ${streetNum} in Zone ${zoneNum}`,
        },
      });
    }

    const r = rows[0];
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lng);

    const response = {
      success: true,
      data: {
        zone: { number: r.zone_number, name: r.zone_name, name_ar: r.zone_name_ar },
        street: { number: r.street_number, name: r.street_name, name_ar: r.street_name_ar },
        building: { number: r.building_number },
        coordinates: { lat, lng },
        links: {
          google_maps: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
        },
        source: r.source,
        verified: r.verified,
        full_address: `Building ${buildingNum}, Street ${streetNum}, Zone ${zoneNum}, Qatar`,
        full_address_ar: `مبنى ${buildingNum}، شارع ${streetNum}، منطقة ${zoneNum}، قطر`,
      },
    };

    if (fastify.redis) {
      await fastify.redis.setex(cacheKey, 86400, JSON.stringify(response));
    }

    return response;
  });
}
```

- [ ] **Step 6: Register all routes in server.ts**

Update `packages/api/src/server.ts` to import and register routes:

```typescript
import Fastify from 'fastify';
import database from './plugins/database.js';
import redis from './plugins/redis.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import corsPlugin from './plugins/cors.js';
import healthRoutes from './routes/health.js';
import zoneRoutes from './routes/zones.js';
import streetRoutes from './routes/streets.js';
import buildingRoutes from './routes/buildings.js';
import locateRoutes from './routes/locate.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Plugins
  await fastify.register(corsPlugin);
  await fastify.register(database);
  await fastify.register(redis);
  await fastify.register(rateLimitPlugin);

  // Routes
  await fastify.register(healthRoutes);
  await fastify.register(zoneRoutes);
  await fastify.register(streetRoutes);
  await fastify.register(buildingRoutes);
  await fastify.register(locateRoutes);

  // Error handlers
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    reply.status(error.statusCode || 500).send({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message,
      },
    });
  });

  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      error: { code: 'ADDRESS_NOT_FOUND', message: 'Route not found' },
    });
  });

  return fastify;
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routes/ packages/api/src/server.ts
git commit -m "feat: add API routes for zones, streets, buildings, locate, health, and stats"
```

---

## Task 12: API Routes — Search, Reverse, Validate, Contribute, Admin

**Files:**
- Create: `packages/api/src/routes/search.ts`
- Create: `packages/api/src/routes/reverse.ts`
- Create: `packages/api/src/routes/validate.ts`
- Create: `packages/api/src/routes/contribute.ts`
- Create: `packages/api/src/routes/admin.ts`

- [ ] **Step 1: Create packages/api/src/routes/search.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export default async function searchRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/search', async (request, reply) => {
    const { q, lang, type = 'all', page = '1', limit = '20' } = request.query as {
      q?: string; lang?: string; type?: string; page?: string; limit?: string;
    };

    if (!q || q.length < 2) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Search query must be at least 2 characters' },
      });
    }

    const p = Math.max(1, parseInt(page));
    const l = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (p - 1) * l;
    const results: unknown[] = [];

    // Search zones
    if (type === 'all' || type === 'zone') {
      let zoneQuery: string;
      const params: unknown[] = [];

      if (lang === 'ar') {
        zoneQuery = `SELECT zone_number, zone_name, zone_name_ar, municipality, municipality_ar,
                      similarity(zone_name_ar, $1) as score, 'zone' as type
                     FROM zones WHERE zone_name_ar % $1 AND is_active = true
                     ORDER BY score DESC`;
        params.push(q);
      } else if (lang === 'en') {
        zoneQuery = `SELECT zone_number, zone_name, zone_name_ar, municipality, municipality_ar,
                      similarity(zone_name, $1) as score, 'zone' as type
                     FROM zones WHERE zone_name % $1 AND is_active = true
                     ORDER BY score DESC`;
        params.push(q);
      } else {
        zoneQuery = `SELECT zone_number, zone_name, zone_name_ar, municipality, municipality_ar,
                      GREATEST(similarity(zone_name, $1), similarity(zone_name_ar, $1)) as score, 'zone' as type
                     FROM zones WHERE (zone_name % $1 OR zone_name_ar % $1) AND is_active = true
                     ORDER BY score DESC`;
        params.push(q);
      }

      const { rows } = await fastify.pg.query(zoneQuery, params);
      results.push(...rows);
    }

    // Search streets
    if (type === 'all' || type === 'street') {
      let streetQuery: string;

      if (lang === 'ar') {
        streetQuery = `SELECT s.street_number, s.street_name, s.street_name_ar,
                        z.zone_number, z.zone_name, z.zone_name_ar,
                        similarity(s.street_name_ar, $1) as score, 'street' as type
                       FROM streets s JOIN zones z ON s.zone_id = z.id
                       WHERE s.street_name_ar % $1 AND s.is_active = true
                       ORDER BY score DESC`;
      } else if (lang === 'en') {
        streetQuery = `SELECT s.street_number, s.street_name, s.street_name_ar,
                        z.zone_number, z.zone_name, z.zone_name_ar,
                        similarity(s.street_name, $1) as score, 'street' as type
                       FROM streets s JOIN zones z ON s.zone_id = z.id
                       WHERE s.street_name % $1 AND s.is_active = true
                       ORDER BY score DESC`;
      } else {
        streetQuery = `SELECT s.street_number, s.street_name, s.street_name_ar,
                        z.zone_number, z.zone_name, z.zone_name_ar,
                        GREATEST(similarity(s.street_name, $1), similarity(s.street_name_ar, $1)) as score, 'street' as type
                       FROM streets s JOIN zones z ON s.zone_id = z.id
                       WHERE (s.street_name % $1 OR s.street_name_ar % $1) AND s.is_active = true
                       ORDER BY score DESC`;
      }

      const { rows } = await fastify.pg.query(streetQuery, [q]);
      results.push(...rows);
    }

    // Sort by score, apply SQL-safe pagination
    // Note: for large datasets, refactor to UNION ALL with LIMIT/OFFSET in SQL
    results.sort((a: any, b: any) => b.score - a.score);
    const total = results.length;
    const paginated = results.slice(offset, offset + l);

    return {
      success: true,
      data: paginated.map(({ score, ...rest }: any) => rest),
      pagination: { page: p, limit: l, total, has_more: offset + l < total },
    };
  });
}
```

- [ ] **Step 2: Create packages/api/src/routes/reverse.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export default async function reverseRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/reverse', async (request, reply) => {
    const { lat, lng, radius = '200' } = request.query as {
      lat?: string; lng?: string; radius?: string;
    };

    if (!lat || !lng) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'lat and lng are required' },
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusM = Math.min(2000, Math.max(1, parseInt(radius)));

    // Qatar bounding box check
    if (latitude < 24.4 || latitude > 26.2 || longitude < 50.7 || longitude > 51.7) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Coordinates are outside Qatar' },
      });
    }

    const { rows } = await fastify.pg.query(
      `SELECT
         z.zone_number, z.zone_name, z.zone_name_ar,
         s.street_number, s.street_name, s.street_name_ar,
         b.building_number,
         ST_Y(b.location) as lat, ST_X(b.location) as lng,
         ST_Distance(
           b.location::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
         ) as distance_meters
       FROM buildings b
       JOIN streets s ON b.street_id = s.id
       JOIN zones z ON s.zone_id = z.id
       WHERE ST_DWithin(
         b.location::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         $3
       ) AND ST_X(b.location) != 0
       ORDER BY distance_meters
       LIMIT 1`,
      [longitude, latitude, radiusM]
    );

    if (rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ADDRESS_NOT_FOUND', message: `No building found within ${radiusM}m` },
      });
    }

    const r = rows[0];
    const bLat = parseFloat(r.lat);
    const bLng = parseFloat(r.lng);

    return {
      success: true,
      data: {
        zone: { number: r.zone_number, name: r.zone_name, name_ar: r.zone_name_ar },
        street: { number: r.street_number, name: r.street_name, name_ar: r.street_name_ar },
        building: { number: r.building_number },
        coordinates: { lat: bLat, lng: bLng },
        distance_meters: Math.round(parseFloat(r.distance_meters)),
        links: {
          google_maps: `https://www.google.com/maps/search/?api=1&query=${bLat},${bLng}`,
          waze: `https://waze.com/ul?ll=${bLat},${bLng}&navigate=yes`,
        },
      },
    };
  });
}
```

- [ ] **Step 3: Create packages/api/src/routes/validate.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export default async function validateRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/validate', async (request, reply) => {
    const { zone, street, building } = request.query as {
      zone?: string; street?: string; building?: string;
    };

    // Zone is required (street and building are optional, validated as deep as provided)
    if (!zone) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'zone query parameter is required' },
      });
    }

    const zoneNum = parseInt(zone);
    let zoneExists = false;
    let streetExists = false;
    let buildingExists = false;

    // Check zone
    const { rows: zoneRows } = await fastify.pg.query(
      'SELECT id FROM zones WHERE zone_number = $1 AND is_active = true',
      [zoneNum]
    );
    zoneExists = zoneRows.length > 0;

    // Check street
    if (street && zoneExists) {
      const streetNum = parseInt(street);
      const { rows: streetRows } = await fastify.pg.query(
        `SELECT s.id FROM streets s JOIN zones z ON s.zone_id = z.id
         WHERE z.zone_number = $1 AND s.street_number = $2 AND s.is_active = true`,
        [zoneNum, streetNum]
      );
      streetExists = streetRows.length > 0;
    }

    // Check building
    if (building && streetExists) {
      const streetNum = parseInt(street!);
      const buildingNum = parseInt(building);
      const { rows: buildingRows } = await fastify.pg.query(
        `SELECT b.id FROM buildings b
         JOIN streets s ON b.street_id = s.id
         JOIN zones z ON s.zone_id = z.id
         WHERE z.zone_number = $1 AND s.street_number = $2 AND b.building_number = $3`,
        [zoneNum, streetNum, buildingNum]
      );
      buildingExists = buildingRows.length > 0;
    }

    const valid = zoneExists && (!street || streetExists) && (!building || buildingExists);

    return {
      success: true,
      data: { valid, zone_exists: zoneExists, street_exists: streetExists, building_exists: buildingExists },
    };
  });
}
```

- [ ] **Step 4: Create packages/api/src/routes/contribute.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export default async function contributeRoutes(fastify: FastifyInstance) {
  // Override rate limit for this route
  fastify.post('/api/v1/contribute', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = request.body as {
      zone_number?: number; street_number?: number; building_number?: number;
      latitude?: number; longitude?: number;
      contributor_name?: string; contributor_email?: string; notes?: string;
    };

    // Validation
    const errors: string[] = [];
    if (!body.zone_number || body.zone_number < 1 || body.zone_number > 98) errors.push('zone_number must be 1-98');
    if (!body.street_number || body.street_number < 1 || body.street_number > 99999) errors.push('street_number must be 1-99999');
    if (!body.building_number || body.building_number < 1 || body.building_number > 99999) errors.push('building_number must be 1-99999');
    if (!body.contributor_name || body.contributor_name.length < 2 || body.contributor_name.length > 100) errors.push('contributor_name must be 2-100 chars');
    if (!body.contributor_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contributor_email)) errors.push('valid contributor_email required');
    if (body.latitude !== undefined && (body.latitude < -90 || body.latitude > 90)) errors.push('latitude must be -90 to 90');
    if (body.longitude !== undefined && (body.longitude < -180 || body.longitude > 180)) errors.push('longitude must be -180 to 180');

    if (errors.length > 0) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: errors.join('; ') },
      });
    }

    // Duplicate check (same address within 24hrs)
    const { rows: dupes } = await fastify.pg.query(
      `SELECT id FROM contributions
       WHERE zone_number = $1 AND street_number = $2 AND building_number = $3
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [body.zone_number, body.street_number, body.building_number]
    );

    if (dupes.length > 0) {
      return reply.status(409).send({
        success: false,
        error: { code: 'DUPLICATE_CONTRIBUTION', message: 'This address was already submitted in the last 24 hours' },
      });
    }

    const { rows } = await fastify.pg.query(
      `INSERT INTO contributions
        (zone_number, street_number, building_number, latitude, longitude, contributor_name, contributor_email, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [body.zone_number, body.street_number, body.building_number,
       body.latitude || null, body.longitude || null,
       body.contributor_name, body.contributor_email, body.notes || null]
    );

    return reply.status(201).send({
      success: true,
      data: { id: rows[0].id, status: 'pending' },
    });
  });

  // GET /api/v1/contributions/:id/status
  fastify.get('/api/v1/contributions/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows } = await fastify.pg.query(
      'SELECT id, status, created_at, reviewed_at FROM contributions WHERE id = $1',
      [parseInt(id)]
    );

    if (rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ADDRESS_NOT_FOUND', message: 'Contribution not found' },
      });
    }

    return { success: true, data: rows[0] };
  });
}
```

- [ ] **Step 5: Create packages/api/src/routes/admin.ts**

```typescript
import type { FastifyInstance } from 'fastify';

export default async function adminRoutes(fastify: FastifyInstance) {
  // Auth hook for admin routes
  fastify.addHook('onRequest', async (request, reply) => {
    const auth = request.headers.authorization;
    const key = process.env.ADMIN_API_KEY;

    if (!key) {
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Admin API key not configured' },
      });
    }

    if (!auth || auth !== `Bearer ${key}`) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' },
      });
    }
  });

  // GET /admin/contributions (prefix '/admin' is applied at registration)
  fastify.get('/contributions', async (request) => {
    const { status = 'pending', page = '1', limit = '50' } = request.query as {
      status?: string; page?: string; limit?: string;
    };
    const p = Math.max(1, parseInt(page));
    const l = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (p - 1) * l;

    const { rows } = await fastify.pg.query(
      `SELECT * FROM contributions WHERE status = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [status, l, offset]
    );

    const { rows: countRows } = await fastify.pg.query(
      'SELECT COUNT(*) as total FROM contributions WHERE status = $1',
      [status]
    );
    const total = parseInt(countRows[0].total);

    return {
      success: true,
      data: rows,
      pagination: { page: p, limit: l, total, has_more: offset + l < total },
    };
  });

  // PUT /admin/contributions/:id
  fastify.put('/contributions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, reviewed_by } = request.body as {
      status?: 'approved' | 'rejected'; reviewed_by?: string;
    };

    if (!status || !['approved', 'rejected'].includes(status)) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'status must be "approved" or "rejected"' },
      });
    }

    // If approved, insert into main tables
    if (status === 'approved') {
      const { rows: contribs } = await fastify.pg.query(
        'SELECT * FROM contributions WHERE id = $1',
        [parseInt(id)]
      );

      if (contribs.length > 0 && contribs[0].latitude && contribs[0].longitude) {
        const c = contribs[0];

        // Ensure zone exists
        const { rows: zoneRows } = await fastify.pg.query(
          'SELECT id FROM zones WHERE zone_number = $1', [c.zone_number]
        );

        if (zoneRows.length > 0) {
          // Ensure street exists
          const { rows: streetRows } = await fastify.pg.query(
            `INSERT INTO streets (zone_id, street_number, source)
             VALUES ($1, $2, 'COMMUNITY')
             ON CONFLICT (zone_id, street_number) DO NOTHING
             RETURNING id`,
            [zoneRows[0].id, c.street_number]
          );

          const streetId = streetRows.length > 0
            ? streetRows[0].id
            : (await fastify.pg.query(
                'SELECT id FROM streets WHERE zone_id = $1 AND street_number = $2',
                [zoneRows[0].id, c.street_number]
              )).rows[0].id;

          // Upsert building
          await fastify.pg.query(
            `INSERT INTO buildings (street_id, building_number, location, source, verified, verified_at)
             VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), 'COMMUNITY', true, NOW())
             ON CONFLICT (street_id, building_number) DO UPDATE SET
               location = ST_SetSRID(ST_MakePoint($3, $4), 4326),
               source = 'COMMUNITY', verified = true, verified_at = NOW()`,
            [streetId, c.building_number, c.longitude, c.latitude]
          );
        }
      }
    }

    await fastify.pg.query(
      `UPDATE contributions SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
      [status, reviewed_by || 'admin', parseInt(id)]
    );

    return { success: true, data: { id: parseInt(id), status } };
  });

  // GET /admin/crawl/status
  fastify.get('/crawl/status', async () => {
    const { rows } = await fastify.pg.query(`
      SELECT endpoint, status, COUNT(*) as count,
             MAX(created_at) as last_at
      FROM crawl_log
      GROUP BY endpoint, status
      ORDER BY endpoint, status
    `);

    return { success: true, data: rows };
  });

  // POST /admin/crawl/start — trigger a manual crawl
  fastify.post('/crawl/start', async (_request, reply) => {
    // Spawn crawler as a detached child process
    const { spawn } = await import('child_process');
    const child = spawn('node', ['--loader', 'ts-node/esm', 'packages/crawler/src/crawl.ts'], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd(),
    });
    child.unref();

    return reply.status(202).send({
      success: true,
      data: { message: 'Crawl started', pid: child.pid },
    });
  });

  // GET /admin/stats
  fastify.get('/stats', async () => {
    const { rows } = await fastify.pg.query(`
      SELECT
        (SELECT COUNT(*) FROM zones) as total_zones,
        (SELECT COUNT(*) FROM streets) as total_streets,
        (SELECT COUNT(*) FROM buildings) as total_buildings,
        (SELECT COUNT(*) FROM buildings WHERE verified = true) as verified_buildings,
        (SELECT COUNT(*) FROM contributions WHERE status = 'pending') as pending_contributions,
        (SELECT pg_size_pretty(pg_database_size(current_database()))) as db_size
    `);

    return { success: true, data: rows[0] };
  });
}
```

- [ ] **Step 6: Register new routes in server.ts**

Add imports and registrations for search, reverse, validate, contribute, and admin routes:

```typescript
import searchRoutes from './routes/search.js';
import reverseRoutes from './routes/reverse.js';
import validateRoutes from './routes/validate.js';
import contributeRoutes from './routes/contribute.js';
import adminRoutes from './routes/admin.js';

// Add to buildServer() after existing route registrations:
await fastify.register(searchRoutes);
await fastify.register(reverseRoutes);
await fastify.register(validateRoutes);
await fastify.register(contributeRoutes);
await fastify.register(adminRoutes, { prefix: '/admin' });
```

Note: Admin routes use prefix `/admin` so the auth hook only applies to admin paths.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routes/ packages/api/src/server.ts
git commit -m "feat: add search, reverse geocode, validate, contribute, and admin API routes"
```

---

## Task 13: JS SDK — Core Client

**Files:**
- Create: `packages/js-sdk/package.json`
- Create: `packages/js-sdk/tsconfig.json`
- Create: `packages/js-sdk/src/errors.ts`
- Create: `packages/js-sdk/src/client.ts`
- Create: `packages/js-sdk/src/index.ts`
- Create: `tests/js-sdk/client.test.ts`

- [ ] **Step 1: Create packages/js-sdk/package.json**

```json
{
  "name": "@qatar-address/sdk",
  "version": "0.1.0",
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "test": "vitest run"
  },
  "dependencies": {
    "@qatar-address/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create packages/js-sdk/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/js-sdk/src/errors.ts**

```typescript
import type { ApiErrorCode } from '@qatar-address/types';

export class QatarAddressError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;

  constructor(code: ApiErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'QatarAddressError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class AddressNotFoundError extends QatarAddressError {
  constructor(message = 'Address not found') {
    super('ADDRESS_NOT_FOUND', message, 404);
  }
}

export class ValidationError extends QatarAddressError {
  constructor(message = 'Validation error') {
    super('VALIDATION_ERROR', message, 422);
  }
}

export class RateLimitedError extends QatarAddressError {
  constructor(message = 'Rate limited') {
    super('RATE_LIMITED', message, 429);
  }
}
```

- [ ] **Step 4: Write the failing test**

Create `tests/js-sdk/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QatarAddress } from '../../packages/js-sdk/src/client.js';
import { QatarAddressError } from '../../packages/js-sdk/src/errors.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('QatarAddress SDK', () => {
  let qa: QatarAddress;

  beforeEach(() => {
    mockFetch.mockReset();
    qa = new QatarAddress({ baseUrl: 'https://api.test.com' });
  });

  it('uses default baseUrl when none provided', () => {
    const client = new QatarAddress();
    expect(client.baseUrl).toBe('https://api.qataraddress.com');
  });

  it('fetches zones', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [{ zone_number: 1, zone_name: 'Doha Port' }],
        pagination: { page: 1, limit: 50, total: 1, has_more: false },
      }),
    });

    const result = await qa.getZones();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].zone_number).toBe(1);
  });

  it('locates a building', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          zone: { number: 25, name: 'Dafna', name_ar: 'الدفنة' },
          coordinates: { lat: 25.32, lng: 51.52 },
        },
      }),
    });

    const result = await qa.locate(25, 230, 44);
    expect(result.zone.number).toBe(25);
    expect(result.coordinates.lat).toBe(25.32);
  });

  it('validates an address', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { valid: true, zone_exists: true, street_exists: true, building_exists: true },
      }),
    });

    const result = await qa.validate(25, 230, 44);
    expect(result.valid).toBe(true);
  });

  it('throws QatarAddressError on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({
        success: false,
        error: { code: 'ADDRESS_NOT_FOUND', message: 'Not found' },
      }),
    });

    await expect(qa.locate(99, 999, 999)).rejects.toThrow(QatarAddressError);
  });

  it('searches addresses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [{ type: 'zone', zone_number: 25, zone_name: 'Dafna' }],
        pagination: { page: 1, limit: 20, total: 1, has_more: false },
      }),
    });

    const result = await qa.search('Dafna');
    expect(result.data).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npx vitest run tests/js-sdk/client.test.ts
```

Expected: FAIL — `QatarAddress` client not found.

- [ ] **Step 6: Implement client**

Create `packages/js-sdk/src/client.ts`:

```typescript
import type {
  LocateResult, ValidateResult, SearchResult, ReverseResult,
  StatsResult, HealthResult, ZoneSummary, StreetSummary, BuildingSummary,
  PaginatedResponse, ApiResponse, ContributeInput, ContributionStatus,
} from '@qatar-address/types';
import { QatarAddressError } from './errors.js';

export interface QatarAddressConfig {
  baseUrl?: string;
}

export class QatarAddress {
  public readonly baseUrl: string;

  constructor(config: QatarAddressConfig = {}) {
    this.baseUrl = (config.baseUrl || 'https://api.qataraddress.com').replace(/\/$/, '');
  }

  async getZones(page = 1, limit = 50): Promise<PaginatedResponse<ZoneSummary>> {
    return this.get(`/api/v1/zones?page=${page}&limit=${limit}`);
  }

  async getZone(zone: number): Promise<ApiResponse<ZoneSummary & { boundary?: unknown }>> {
    return this.get(`/api/v1/zones/${zone}`);
  }

  async getStreets(zone: number, page = 1, limit = 50): Promise<PaginatedResponse<StreetSummary>> {
    return this.get(`/api/v1/zones/${zone}/streets?page=${page}&limit=${limit}`);
  }

  async getBuildings(zone: number, street: number, page = 1, limit = 50): Promise<PaginatedResponse<BuildingSummary>> {
    return this.get(`/api/v1/zones/${zone}/streets/${street}/buildings?page=${page}&limit=${limit}`);
  }

  async locate(zone: number, street: number, building: number): Promise<LocateResult> {
    const res = await this.get<ApiResponse<LocateResult>>(`/api/v1/locate/${zone}/${street}/${building}`);
    return res.data;
  }

  async validate(zone: number, street?: number, building?: number): Promise<ValidateResult> {
    const params = new URLSearchParams({ zone: String(zone) });
    if (street !== undefined) params.set('street', String(street));
    if (building !== undefined) params.set('building', String(building));
    const res = await this.get<ApiResponse<ValidateResult>>(`/api/v1/validate?${params}`);
    return res.data;
  }

  async search(query: string, options?: { lang?: string; type?: string; page?: number; limit?: number }): Promise<PaginatedResponse<SearchResult>> {
    const params = new URLSearchParams({ q: query });
    if (options?.lang) params.set('lang', options.lang);
    if (options?.type) params.set('type', options.type);
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    return this.get(`/api/v1/search?${params}`);
  }

  async reverse(lat: number, lng: number, radius?: number): Promise<ReverseResult> {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (radius) params.set('radius', String(radius));
    const res = await this.get<ApiResponse<ReverseResult>>(`/api/v1/reverse?${params}`);
    return res.data;
  }

  async contribute(input: ContributeInput): Promise<{ id: number; status: ContributionStatus }> {
    const res = await this.post<ApiResponse<{ id: number; status: ContributionStatus }>>(
      '/api/v1/contribute', input
    );
    return res.data;
  }

  async getContributionStatus(id: number): Promise<{ id: number; status: ContributionStatus }> {
    const res = await this.get<ApiResponse<{ id: number; status: ContributionStatus }>>(
      `/api/v1/contributions/${id}/status`
    );
    return res.data;
  }

  async stats(): Promise<StatsResult> {
    const res = await this.get<ApiResponse<StatsResult>>('/api/v1/stats');
    return res.data;
  }

  async health(): Promise<HealthResult> {
    const res = await this.get<ApiResponse<HealthResult>>('/api/v1/health');
    return res.data;
  }

  private async get<T = unknown>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    return this.handleResponse<T>(response);
  }

  private async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();

    if (!response.ok) {
      const error = data?.error || {};
      throw new QatarAddressError(
        error.code || 'SERVER_ERROR',
        error.message || `HTTP ${response.status}`,
        response.status
      );
    }

    return data as T;
  }
}
```

- [ ] **Step 7: Create packages/js-sdk/src/index.ts**

```typescript
export { QatarAddress } from './client.js';
export type { QatarAddressConfig } from './client.js';
export { QatarAddressError, AddressNotFoundError, ValidationError, RateLimitedError } from './errors.js';
export type {
  LocateResult, ValidateResult, SearchResult, ReverseResult,
  StatsResult, HealthResult, ZoneSummary, StreetSummary, BuildingSummary,
  ContributeInput, ApiResponse, PaginatedResponse, ApiErrorCode, DataSource,
} from '@qatar-address/types';
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npx vitest run tests/js-sdk/client.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 9: Build the SDK**

```bash
cd packages/js-sdk && pnpm build
```

Expected: `dist/` generated with `.js` and `.d.ts` files.

- [ ] **Step 10: Commit**

```bash
git add packages/js-sdk tests/js-sdk
git commit -m "feat: add @qatar-address/sdk — core JS/TS client with full API coverage"
```

---

## Task 14: Integration Test — Full API Flow

**Files:**
- Create: `tests/api/zones.test.ts`
- Create: `tests/api/locate.test.ts`

- [ ] **Step 1: Create tests/api/zones.test.ts**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/api/src/server.js';
import type { FastifyInstance } from 'fastify';

describe('Zones API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://qatar:qatar@localhost:5432/qatar_address';
    process.env.REDIS_URL = 'redis://localhost:6379';
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/zones returns paginated zones', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/zones' });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBeGreaterThan(0);
  });

  it('GET /api/v1/zones/25 returns Dafna', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/zones/25' });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.data.zone_name).toBe('Dafna');
    expect(body.data.zone_name_ar).toBe('الدفنة');
  });

  it('GET /api/v1/zones/999 returns 404', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/zones/999' });
    expect(response.statusCode).toBe(422);
  });

  it('GET /api/v1/health returns ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.data.database).toBe(true);
  });

  it('GET /api/v1/validate?zone=25 returns valid', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/validate?zone=25',
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.data.valid).toBe(true);
    expect(body.data.zone_exists).toBe(true);
  });
});
```

- [ ] **Step 2: Run integration tests**

Requires Docker dev services running:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
npx vitest run tests/api/zones.test.ts
```

Expected: All tests PASS (zones are seeded from Task 4).

- [ ] **Step 3: Commit**

```bash
git add tests/api/
git commit -m "test: add integration tests for zones API and health endpoints"
```

---

## Task 15: Production Docker Compose

**Files:**
- Create: `docker/Dockerfile.api`
- Create: `docker/nginx.conf`
- Create: `docker/docker-compose.yml`
- Create: `data/.gitkeep`

- [ ] **Step 1: Create docker/Dockerfile.api**

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY packages/database/package.json packages/database/
COPY packages/api/package.json packages/api/
COPY packages/crawler/package.json packages/crawler/

RUN pnpm install --frozen-lockfile

COPY packages/types/ packages/types/
COPY packages/database/ packages/database/
COPY packages/api/ packages/api/
COPY packages/crawler/ packages/crawler/

RUN pnpm build

FROM node:20-slim
WORKDIR /app
RUN corepack enable pnpm

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/types/package.json packages/types/
COPY --from=builder /app/packages/types/dist packages/types/dist/
COPY --from=builder /app/packages/database/package.json packages/database/
COPY --from=builder /app/packages/database/dist packages/database/dist/
COPY --from=builder /app/packages/api/package.json packages/api/
COPY --from=builder /app/packages/api/dist packages/api/dist/
COPY --from=builder /app/packages/crawler/package.json packages/crawler/
COPY --from=builder /app/packages/crawler/dist packages/crawler/dist/

# Copy migration and seed files (needed at runtime)
COPY --from=builder /app/packages/database/src/migrations packages/database/src/migrations/
COPY --from=builder /app/packages/database/src/seeds packages/database/src/seeds/

RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000
CMD ["node", "packages/api/dist/app.js"]
```

- [ ] **Step 2: Create docker/nginx.conf**

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

server {
    listen 80;
    server_name api.qataraddress.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip
    gzip on;
    gzip_types application/json;
    gzip_min_length 256;

    location / {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Rate limiting at nginx level (backup)
        limit_req zone=api burst=20 nodelay;
    }
}
```

- [ ] **Step 3: Create docker/docker-compose.yml**

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    container_name: qatar-address-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-qatar}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-qatar_address}
    volumes:
      - qatar_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U qatar -d qatar_address"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: qatar-address-redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    container_name: qatar-address-api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${DB_USER:-qatar}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-qatar_address}
      REDIS_URL: redis://redis:6379
      ADMIN_API_KEY: ${ADMIN_API_KEY}
      NODE_ENV: production
      PORT: 3000
    ports:
      - "3000:3000"

  nginx:
    image: nginx:alpine
    container_name: qatar-address-nginx
    restart: unless-stopped
    depends_on:
      - api
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro

volumes:
  qatar_pgdata:
```

- [ ] **Step 4: Create data/.gitkeep**

```bash
touch data/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add docker/ data/.gitkeep
git commit -m "feat: add production Docker Compose with nginx, PostGIS, Redis, and API"
```

---

## Execution Order Summary

| Task | Package | Dependencies | Estimated Steps |
|------|---------|-------------|-----------------|
| 1 | Monorepo scaffold | None | 10 |
| 2 | Shared types | Task 1 | 5 |
| 3 | Database schema | Task 1 | 7 |
| 4 | Zone seed data | Task 3 | 3 |
| 5 | Dev Docker | Tasks 3, 4 | 7 |
| 6 | Crawler rate limiter | Task 1 | 7 |
| 7 | QNAS API client | Task 6 | 5 |
| 8 | Crawl phases | Tasks 3, 7 | 4 |
| 9 | Crawl orchestrator | Task 8 | 3 |
| 10 | API core + plugins | Tasks 2, 3 | 9 |
| 11 | API routes (core) | Task 10 | 7 |
| 12 | API routes (remaining) | Task 11 | 7 |
| 13 | JS SDK | Task 2 | 10 |
| 14 | Integration tests | Tasks 5, 11 | 3 |
| 15 | Production Docker | Task 10 | 5 |

**Parallelizable:** Tasks 6-9 (crawler) can run in parallel with Tasks 10-12 (API) after Task 5 completes.

---

## Implementation Notes

### Root vitest config

Create `vitest.config.ts` at root (part of Task 1):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts'],
  },
});
```

Add `vitest` to root `devDependencies` alongside `turbo` and `typescript`.

### pnpm-lock.yaml

The lockfile generated by `pnpm install` in Task 1 **must be committed to git**. The Dockerfile uses `--frozen-lockfile` which requires it. Ensure `git add .` in Task 1 Step 10 includes it (it should — `.gitignore` does not exclude it).

### Building type note

The `Building` interface in `@qatar-address/types` represents the **API response shape**, not a raw database row. The DB stores coordinates as `GEOMETRY(POINT, 4326)` via `location` column; the API extracts `latitude`/`longitude` via `ST_Y(location)` / `ST_X(location)`.

### Crawl log cleanup

Add to the crawler orchestrator (`crawl.ts`) as a maintenance step at the start of each run:

```typescript
// Clean up crawl logs older than 90 days
await pool.query("DELETE FROM crawl_log WHERE created_at < NOW() - INTERVAL '90 days'");
```

### Manifest checksum

Add to `export.ts` before writing `manifest.json`:

```typescript
import crypto from 'crypto';

const hash = crypto.createHash('sha256');
hash.update(fs.readFileSync(path.join(DATA_DIR, 'zones.json')));
// Add other exported files...
const checksum = `sha256:${hash.digest('hex')}`;
```

Include `checksum` field in the manifest object.

---

## Deferred to Plan 2 (React + SDKs)

These are explicitly **not in scope** for this plan:

- `packages/crawler/src/enrichment.ts` — HDX + OSM data merge
- `data/boundaries/` directory with HDX/OSM GeoJSON
- Re-crawl cron schedule setup (weekly/monthly/quarterly)
- `@qatar-address/react` — Blue plate component
- `@qatar-address/nextjs` — Next.js plugin
- `qatar-address/sdk` (PHP) — PHP SDK
- `qatar-address/laravel` — Laravel plugin
- `qatar_address` (Dart) — Dart SDK
- `qatar_address_flutter` — Flutter widget
- Gitea CI/CD workflows
- Production deployment to VPS
