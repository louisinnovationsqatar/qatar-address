// === Enums ===

export type DataSource = 'QNAS_API' | 'OSM' | 'COMMUNITY' | 'GENERATED' | 'HDX';
export type ContributionStatus = 'pending' | 'approved' | 'rejected';

export type ApiErrorCode =
  | 'ADDRESS_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'DUPLICATE_CONTRIBUTION'
  | 'UNAUTHORIZED'
  | 'SERVER_ERROR';

// === Database Entities (API-projected, not raw DB rows) ===

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

// === Summaries (for list endpoints) ===

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
