CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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

CREATE INDEX idx_zones_name_trgm ON zones USING GIN(zone_name gin_trgm_ops);
CREATE INDEX idx_zones_name_ar_trgm ON zones USING GIN(zone_name_ar gin_trgm_ops);
CREATE INDEX idx_streets_name_trgm ON streets USING GIN(street_name gin_trgm_ops);
CREATE INDEX idx_streets_name_ar_trgm ON streets USING GIN(street_name_ar gin_trgm_ops);

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
