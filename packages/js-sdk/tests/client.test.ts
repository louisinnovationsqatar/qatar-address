import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { QatarAddress, QatarAddressError } from '../src/index.js';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? 'OK' : 'Error',
    type: 'basic',
    url: '',
    clone: () => jsonResponse(body, status) as Response,
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

describe('QatarAddress SDK', () => {
  let mockFetch: Mock;
  let client: QatarAddress;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    client = new QatarAddress();
  });

  it('uses default baseUrl with /api/v1 prefix', async () => {
    const body = { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, has_more: false } };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    await client.getZones();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/api/v1/zones',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('fetches zones correctly', async () => {
    const body = {
      success: true,
      data: [
        { zone_number: 1, zone_name: 'West Bay', zone_name_ar: null, municipality: null, municipality_ar: null },
      ],
      pagination: { page: 1, limit: 20, total: 1, has_more: false },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    const result = await client.getZones(1, 20);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/api/v1/zones?page=1&limit=20',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].zone_number).toBe(1);
  });

  it('locates a building', async () => {
    const body = {
      success: true,
      data: {
        zone: { number: 61, name: 'Al Dafna', name_ar: null },
        street: { number: 901, name: null, name_ar: null },
        building: { number: 15 },
        coordinates: { lat: 25.3, lng: 51.5 },
        links: { google_maps: 'https://maps.google.com/?q=25.3,51.5', waze: '' },
        source: 'QNAS_API',
        verified: true,
        full_address: 'Building 15, Street 901, Zone 61',
        full_address_ar: '',
      },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    const result = await client.locate(61, 901, 15);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/api/v1/locate/61/901/15',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.data.coordinates.lat).toBe(25.3);
    expect(result.data.verified).toBe(true);
  });

  it('validates an address using query params', async () => {
    const body = {
      success: true,
      data: { valid: true, zone_exists: true, street_exists: true, building_exists: true },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    const result = await client.validate(61, 901, 15);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/api/v1/validate?zone=61&street=901&building=15',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.data.valid).toBe(true);
  });

  it('validates zone-only address', async () => {
    const body = {
      success: true,
      data: { valid: true, zone_exists: true, street_exists: false, building_exists: false },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    await client.validate(61);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/api/v1/validate?zone=61',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws QatarAddressError on API error', async () => {
    const errorBody = {
      success: false,
      error: { code: 'ADDRESS_NOT_FOUND', message: 'Zone 999 not found' },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(errorBody, 404));

    await expect(client.locate(999, 1, 1)).rejects.toThrow(QatarAddressError);
    await expect(
      (async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(errorBody, 404));
        await client.locate(999, 1, 1);
      })(),
    ).rejects.toMatchObject({
      code: 'ADDRESS_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('searches addresses', async () => {
    const body = {
      success: true,
      data: [
        { type: 'zone', zone_number: 61, zone_name: 'Al Dafna', zone_name_ar: null },
      ],
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    const result = await client.search('Dafna', { limit: 5 });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/api/v1/search?q=Dafna&limit=5',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].zone_name).toBe('Al Dafna');
  });

  it('reverse geocodes', async () => {
    const body = {
      success: true,
      data: {
        zone: { number: 61, name: 'Al Dafna', name_ar: null },
        street: { number: 901, name: null, name_ar: null },
        building: { number: 15 },
        coordinates: { lat: 25.3, lng: 51.5 },
        distance_meters: 42.5,
        links: { google_maps: 'https://maps.google.com/?q=25.3,51.5', waze: '' },
      },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    const result = await client.reverse(25.3, 51.5, 500);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/api/v1/reverse?lat=25.3&lng=51.5&radius=500',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.data.distance_meters).toBe(42.5);
  });

  it('checks contribution status with correct route', async () => {
    const body = {
      success: true,
      data: { id: 42, status: 'pending', created_at: '2025-01-01' },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    await client.getContributionStatus(42);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/api/v1/contributions/42/status',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('checks health with correct route', async () => {
    const body = {
      success: true,
      data: { status: 'ok', database: true, redis: true, uptime_seconds: 100 },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    await client.health();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/api/v1/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('uses custom baseUrl', async () => {
    const customClient = new QatarAddress({ baseUrl: 'https://qa.louis-innovations.com' });
    const body = { success: true, data: { status: 'ok', database: true, redis: true, uptime_seconds: 100 } };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    await customClient.health();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://qa.louis-innovations.com/api/v1/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
