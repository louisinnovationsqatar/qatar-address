import type {
  ApiErrorCode,
  ApiErrorResponse,
  ApiResponse,
  BuildingSummary,
  ContributeInput,
  Contribution,
  HealthResult,
  LocateResult,
  PaginatedResponse,
  ReverseResult,
  SearchResult,
  StatsResult,
  StreetSummary,
  ValidateResult,
  ZoneSummary,
} from '@qatar-address/types';

import {
  AddressNotFoundError,
  QatarAddressError,
  RateLimitedError,
  ValidationError,
} from './errors.js';

export interface QatarAddressConfig {
  /** Base URL of the Qatar Address API. Defaults to https://api.qataraddress.com */
  baseUrl?: string;
}

export interface SearchOptions {
  /** Maximum number of results to return. */
  limit?: number;
}

const DEFAULT_BASE_URL = 'https://api.qataraddress.com';

export class QatarAddress {
  private readonly baseUrl: string;

  constructor(config: QatarAddressConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  // --- Public API methods ---

  /** List all zones with optional pagination. */
  async getZones(page?: number, limit?: number): Promise<PaginatedResponse<ZoneSummary>> {
    const params = this.paginationParams(page, limit);
    return this.get<PaginatedResponse<ZoneSummary>>(`/zones${params}`);
  }

  /** Get a single zone by its zone number. */
  async getZone(zone: number): Promise<ApiResponse<ZoneSummary>> {
    return this.get<ApiResponse<ZoneSummary>>(`/zones/${zone}`);
  }

  /** List streets within a zone. */
  async getStreets(zone: number, page?: number, limit?: number): Promise<PaginatedResponse<StreetSummary>> {
    const params = this.paginationParams(page, limit);
    return this.get<PaginatedResponse<StreetSummary>>(`/zones/${zone}/streets${params}`);
  }

  /** List buildings on a street within a zone. */
  async getBuildings(zone: number, street: number, page?: number, limit?: number): Promise<PaginatedResponse<BuildingSummary>> {
    const params = this.paginationParams(page, limit);
    return this.get<PaginatedResponse<BuildingSummary>>(`/zones/${zone}/streets/${street}/buildings${params}`);
  }

  /** Locate a specific building by zone, street, and building number. */
  async locate(zone: number, street: number, building: number): Promise<ApiResponse<LocateResult>> {
    return this.get<ApiResponse<LocateResult>>(`/locate/${zone}/${street}/${building}`);
  }

  /** Validate whether an address (or partial address) exists. */
  async validate(zone: number, street?: number, building?: number): Promise<ApiResponse<ValidateResult>> {
    let path = `/validate/${zone}`;
    if (street !== undefined) path += `/${street}`;
    if (building !== undefined) path += `/${building}`;
    return this.get<ApiResponse<ValidateResult>>(path);
  }

  /** Search for zones and streets by name or number. */
  async search(query: string, options?: SearchOptions): Promise<ApiResponse<SearchResult[]>> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    return this.get<ApiResponse<SearchResult[]>>(`/search?${params.toString()}`);
  }

  /** Reverse geocode: find the nearest address for a lat/lng coordinate. */
  async reverse(lat: number, lng: number, radius?: number): Promise<ApiResponse<ReverseResult[]>> {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (radius !== undefined) params.set('radius', String(radius));
    return this.get<ApiResponse<ReverseResult[]>>(`/reverse?${params.toString()}`);
  }

  /** Submit a community contribution for a new or corrected address. */
  async contribute(input: ContributeInput): Promise<ApiResponse<Contribution>> {
    return this.post<ApiResponse<Contribution>>('/contribute', input);
  }

  /** Check the status of a previously submitted contribution. */
  async getContributionStatus(id: number): Promise<ApiResponse<Contribution>> {
    return this.get<ApiResponse<Contribution>>(`/contribute/${id}`);
  }

  /** Get aggregate statistics about the address database. */
  async stats(): Promise<ApiResponse<StatsResult>> {
    return this.get<ApiResponse<StatsResult>>('/stats');
  }

  /** Check API health status. */
  async health(): Promise<ApiResponse<HealthResult>> {
    return this.get<ApiResponse<HealthResult>>('/health');
  }

  // --- Private helpers ---

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    return this.handleResponse<T>(response);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorBody: ApiErrorResponse | undefined;
      try {
        errorBody = (await response.json()) as ApiErrorResponse;
      } catch {
        // Response body is not JSON; fall through to generic error.
      }

      const code: ApiErrorCode = errorBody?.error?.code ?? 'SERVER_ERROR';
      const message = errorBody?.error?.message ?? `HTTP ${response.status}`;

      switch (code) {
        case 'ADDRESS_NOT_FOUND':
          throw new AddressNotFoundError(message);
        case 'VALIDATION_ERROR':
          throw new ValidationError(message);
        case 'RATE_LIMITED':
          throw new RateLimitedError(message);
        default:
          throw new QatarAddressError(message, code, response.status);
      }
    }

    return (await response.json()) as T;
  }

  private paginationParams(page?: number, limit?: number): string {
    const params = new URLSearchParams();
    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));
    const str = params.toString();
    return str ? `?${str}` : '';
  }
}
