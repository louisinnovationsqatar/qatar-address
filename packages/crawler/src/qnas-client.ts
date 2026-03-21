/**
 * Client for the Qatar National Address System (QNAS) API at qnas.qa.
 *
 * Authenticates via `X-Token` and `X-Domain` headers.
 * All public methods return typed response objects and throw on HTTP errors.
 */

// ---- Response interfaces (match actual QNAS API response format) ----

export interface QnasZone {
  zone_number: number;
  zone_name_en: string;
  zone_name_ar: string;
}

export interface QnasStreet {
  street_number: number;
  street_name_en: string;
  street_name_ar: string;
}

export interface QnasBuilding {
  zone_number: number;
  street_number: number;
  building_number: string; // QNAS returns as string
  x: string; // latitude as string
  y: string; // longitude as string
}

export interface QnasPolygonPoint {
  lat: number;
  lng: number;
}

export interface QnasPolygonResponse {
  status: string;
  polygon_count?: number;
  polygon: QnasPolygonPoint[];
}

// ---- Client ----

export interface QnasClientOptions {
  token: string;
  domain: string;
  baseUrl?: string;
}

export class QnasClient {
  private readonly token: string;
  private readonly domain: string;
  private readonly baseUrl: string;

  constructor(opts: QnasClientOptions) {
    this.token = opts.token;
    this.domain = opts.domain;
    this.baseUrl = (opts.baseUrl ?? 'https://qnas.qa').replace(/\/$/, '');
  }

  // ---- public API ----

  /** Phase 1 — list every zone. */
  async getZones(): Promise<QnasZone[]> {
    return this.get<QnasZone[]>('/get_zones');
  }

  /** Phase 2 — polygon boundary for a single zone. */
  async getZonePolygon(zone: number): Promise<QnasPolygonResponse> {
    return this.get<QnasPolygonResponse>(`/get_zone_polygon/${zone}`);
  }

  /** Phase 3 — streets inside a zone. */
  async getStreets(zone: number): Promise<QnasStreet[]> {
    return this.get<QnasStreet[]>(`/get_streets/${zone}`);
  }

  /** Phase 4 — polygon / polyline for a street. */
  async getStreetPolygon(
    zone: number,
    street: number,
  ): Promise<QnasPolygonResponse> {
    return this.get<QnasPolygonResponse>(
      `/get_street_polygon/${zone}/${street}`,
    );
  }

  /** Phase 5 — buildings on a street (includes coordinates). */
  async getBuildings(zone: number, street: number): Promise<QnasBuilding[]> {
    return this.get<QnasBuilding[]>(`/get_buildings/${zone}/${street}`);
  }

  // ---- private helpers ----

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Token': this.token,
        'X-Domain': this.domain,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `QNAS API error: ${res.status} ${res.statusText} — ${url}\n${body}`,
      );
    }

    return (await res.json()) as T;
  }

  /**
   * Convert QNAS polygon [{lat, lng}, ...] to GeoJSON Polygon.
   * GeoJSON uses [longitude, latitude] order.
   */
  static polygonToGeoJSON(
    polygon: QnasPolygonPoint[],
  ): { type: string; coordinates: number[][][] } {
    const coords = polygon.map((p) => [p.lng, p.lat]);
    // Close the ring if not already closed
    if (
      coords.length > 0 &&
      (coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1])
    ) {
      coords.push([coords[0][0], coords[0][1]]);
    }
    return { type: 'Polygon', coordinates: [coords] };
  }
}
