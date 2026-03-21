/**
 * Client for the Qatar National Address System (QNAS) API.
 *
 * Authenticates via `X-Token` and `X-Domain` headers.
 * All public methods return typed response objects and throw on HTTP errors.
 */

// ---- Response interfaces ----

export interface QnasZone {
  zone: number;
  name_en: string;
  name_ar: string;
}

export interface QnasStreet {
  zone: number;
  street: number;
  name_en: string;
  name_ar: string;
}

export interface QnasBuilding {
  zone: number;
  street: number;
  building: number;
}

export interface QnasLocation {
  zone: number;
  street: number;
  building: number;
  lat: number;
  lng: number;
}

export interface QnasPolygon {
  type: string;
  coordinates: number[][][] | number[][][][];
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
    this.baseUrl = (opts.baseUrl ?? 'https://api.qna.gov.qa').replace(
      /\/$/,
      '',
    );
  }

  // ---- public API ----

  /** Phase 1 — list every zone. */
  async getZones(): Promise<QnasZone[]> {
    return this.get<QnasZone[]>('/zones');
  }

  /** Phase 2 — polygon boundary for a single zone. */
  async getZonePolygon(zone: number): Promise<QnasPolygon> {
    return this.get<QnasPolygon>(`/zones/${zone}/polygon`);
  }

  /** Phase 3 — streets inside a zone. */
  async getStreets(zone: number): Promise<QnasStreet[]> {
    return this.get<QnasStreet[]>(`/zones/${zone}/streets`);
  }

  /** Phase 4 — polygon / polyline for a street. */
  async getStreetPolygon(zone: number, street: number): Promise<QnasPolygon> {
    return this.get<QnasPolygon>(`/zones/${zone}/streets/${street}/polygon`);
  }

  /** Phase 5 — buildings on a street. */
  async getBuildings(zone: number, street: number): Promise<QnasBuilding[]> {
    return this.get<QnasBuilding[]>(
      `/zones/${zone}/streets/${street}/buildings`,
    );
  }

  /** Phase 6 — exact lat/lng for a building. */
  async getLocation(
    zone: number,
    street: number,
    building: number,
  ): Promise<QnasLocation> {
    return this.get<QnasLocation>(
      `/zones/${zone}/streets/${street}/buildings/${building}`,
    );
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
}
