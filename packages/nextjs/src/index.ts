import { QatarAddress } from '@qatar-address/sdk';
import type { ApiResponse, LocateResult, ValidateResult, ZoneSummary, PaginatedResponse } from '@qatar-address/types';

let _client: QatarAddress | null = null;

function getClient(): QatarAddress {
  if (!_client) {
    _client = new QatarAddress({
      baseUrl: process.env.QATAR_ADDRESS_API_URL || 'https://api.qataraddress.com',
    });
  }
  return _client;
}

export async function locateAddress(zone: number, street: number, building: number): Promise<ApiResponse<LocateResult>> {
  return getClient().locate(zone, street, building);
}

export async function validateAddress(zone: number, street?: number, building?: number): Promise<ApiResponse<ValidateResult>> {
  return getClient().validate(zone, street, building);
}

export async function getZones(page?: number, limit?: number): Promise<PaginatedResponse<ZoneSummary>> {
  return getClient().getZones(page, limit);
}

export { QatarAddress } from '@qatar-address/sdk';
export type { LocateResult, ValidateResult, ZoneSummary } from '@qatar-address/types';
