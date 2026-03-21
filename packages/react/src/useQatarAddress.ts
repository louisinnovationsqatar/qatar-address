import { useRef, useCallback } from 'react';
import { QatarAddress } from '@qatar-address/sdk';

export interface UseQatarAddressOptions {
  baseUrl?: string;
}

export function useQatarAddress(options: UseQatarAddressOptions = {}) {
  const clientRef = useRef<QatarAddress>(
    new QatarAddress({ baseUrl: options.baseUrl })
  );

  const locate = useCallback(
    (zone: number, street: number, building: number) =>
      clientRef.current.locate(zone, street, building),
    []
  );

  const validate = useCallback(
    (zone: number, street?: number, building?: number) =>
      clientRef.current.validate(zone, street, building),
    []
  );

  const search = useCallback(
    (query: string) => clientRef.current.search(query),
    []
  );

  return { locate, validate, search, client: clientRef.current };
}
