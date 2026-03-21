import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { QatarAddress, QatarAddressError } from '../../packages/js-sdk/src/index.js';

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

  it('uses default baseUrl when none provided', async () => {
    const body = { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, has_more: false } };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    await client.getZones();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/zones',
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
      'https://api.qataraddress.com/zones?page=1&limit=20',
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
      'https://api.qataraddress.com/locate/61/901/15',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.data.coordinates.lat).toBe(25.3);
    expect(result.data.verified).toBe(true);
  });

  it('validates an address', async () => {
    const body = {
      success: true,
      data: { valid: true, zone_exists: true, street_exists: true, building_exists: true },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    const result = await client.validate(61, 901, 15);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.qataraddress.com/validate/61/901/15',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.data.valid).toBe(true);
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
      'https://api.qataraddress.com/search?q=Dafna&limit=5',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].zone_name).toBe('Al Dafna');
  });
});
