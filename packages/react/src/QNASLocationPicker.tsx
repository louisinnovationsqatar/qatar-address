import { useState, useEffect, useRef, useCallback } from 'react';
import { QatarAddress } from '@qatar-address/sdk';
import type { LocateResult } from '@qatar-address/types';

export interface QNASLocation {
  zone: string;
  street: string;
  building: string;
  apartmentNo?: string;
  fullAddress: string;
  fullAddressAr: string;
  coordinates?: { lat: number; lng: number };
  googleMapsLink?: string;
  wazeLink?: string;
  source?: string;
  verified?: boolean;
}

export interface QNASLocationPickerProps {
  baseUrl?: string;
  onChange?: (location: QNASLocation | null) => void;
  initialValue?: { zone?: string; street?: string; building?: string; apartmentNo?: string };
  locale?: 'en' | 'ar';
  showApartment?: boolean;
  showMap?: boolean;
  className?: string;
}

export function QNASLocationPicker({
  baseUrl,
  onChange,
  initialValue,
  locale = 'en',
  showApartment = false,
  showMap = false,
  className = '',
}: QNASLocationPickerProps) {
  const [zone, setZone] = useState(initialValue?.zone || '');
  const [street, setStreet] = useState(initialValue?.street || '');
  const [building, setBuilding] = useState(initialValue?.building || '');
  const [apartmentNo, setApartmentNo] = useState(initialValue?.apartmentNo || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientRef = useRef(new QatarAddress({ baseUrl }));

  const isAr = locale === 'ar';

  const buildAddress = useCallback(
    (apt: string, bld: string, str: string, zn: string) => {
      if (apt) {
        return isAr
          ? `شقة/منزل ${apt}، مبنى ${bld}، شارع ${str}، منطقة ${zn}، قطر`
          : `Apt/House ${apt}, Building ${bld}, Street ${str}, Zone ${zn}, Qatar`;
      }
      return isAr
        ? `مبنى ${bld}، شارع ${str}، منطقة ${zn}، قطر`
        : `Building ${bld}, Street ${str}, Zone ${zn}, Qatar`;
    },
    [isAr]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValidationMessage('');
    setHasError(false);

    if (zone && street && building) {
      debounceRef.current = setTimeout(() => {
        validateAddress();
      }, 500);
    } else {
      onChange?.(null);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, street, building]);

  const validateAddress = async () => {
    setIsValidating(true);
    try {
      const zoneNum = parseInt(zone);
      const streetNum = parseInt(street);
      const buildingNum = parseInt(building);

      const response = await clientRef.current.locate(zoneNum, streetNum, buildingNum);
      const result = response.data;

      const location: QNASLocation = {
        zone,
        street,
        building,
        apartmentNo: apartmentNo || undefined,
        fullAddress: buildAddress(apartmentNo, building, street, zone),
        fullAddressAr: `مبنى ${building}، شارع ${street}، منطقة ${zone}، قطر`,
        coordinates: result.coordinates,
        googleMapsLink: result.links.google_maps,
        wazeLink: result.links.waze,
        source: result.source,
        verified: result.verified,
      };

      onChange?.(location);
      setValidationMessage(
        result.source === 'QNAS_API'
          ? isAr ? 'تم التحقق من العنوان' : 'Address Verified'
          : isAr ? 'تم العثور على العنوان' : 'Address Found'
      );
    } catch {
      // Address not found - generate estimated location
      const estLat = 25.276987 + parseInt(zone) * 0.001;
      const estLng = 51.520008 + parseInt(zone) * 0.001;

      onChange?.({
        zone,
        street,
        building,
        apartmentNo: apartmentNo || undefined,
        fullAddress: buildAddress(apartmentNo, building, street, zone),
        fullAddressAr: `مبنى ${building}، شارع ${street}، منطقة ${zone}، قطر`,
        coordinates: { lat: estLat, lng: estLng },
        googleMapsLink: `https://www.google.com/maps/search/?api=1&query=${estLat},${estLng}`,
        source: 'GENERATED',
        verified: false,
      });
      setValidationMessage(
        isAr ? 'موقع تقريبي (المبنى غير موجود)' : 'Estimated Location (Building not found)'
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleNumericInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/\D/g, ''));
  };

  const inputClass = 'w-full bg-white border-2 border-white/30 focus:border-white text-center font-bold text-lg rounded px-2 py-2 outline-none';

  return (
    <div className={`space-y-4 ${className}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Blue Plate */}
      <div className="bg-[#0054A6] p-4 rounded-lg space-y-3 border-2 border-[#003f7f]">
        <h3 className="text-white font-medium text-sm flex items-center justify-between">
          <span>{isAr ? 'نظام العنوان الوطني القطري' : 'Qatar National Address System'}</span>
          {isValidating && (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
        </h3>

        {/* Apartment/House (optional) */}
        {showApartment && (
          <div>
            <label className="text-white text-xs font-medium block mb-1">
              {isAr ? 'رقم الشقة/المنزل' : 'Apartment/House No.'}
            </label>
            <input
              type="text"
              value={apartmentNo}
              onChange={(e) => setApartmentNo(e.target.value)}
              placeholder={isAr ? 'اختياري' : 'Optional'}
              maxLength={10}
              className={inputClass}
              style={{ letterSpacing: '0.1em' }}
            />
          </div>
        )}

        {/* 3-column: Building | Street | Zone */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-white text-xs font-medium block mb-1">
              {isAr ? 'مبنى' : 'Building'}
            </label>
            <input
              type="text"
              value={building}
              onChange={handleNumericInput(setBuilding)}
              maxLength={5}
              className={inputClass}
              style={{ letterSpacing: '0.1em' }}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="text-white text-xs font-medium block mb-1">
              {isAr ? 'شارع' : 'Street'}
            </label>
            <input
              type="text"
              value={street}
              onChange={handleNumericInput(setStreet)}
              maxLength={5}
              className={inputClass}
              style={{ letterSpacing: '0.1em' }}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="text-white text-xs font-medium block mb-1">
              {isAr ? 'منطقة' : 'Zone'}
            </label>
            <input
              type="text"
              value={zone}
              onChange={handleNumericInput(setZone)}
              maxLength={3}
              className={inputClass}
              style={{ letterSpacing: '0.1em' }}
              inputMode="numeric"
            />
          </div>
        </div>

        {/* Validation status */}
        {validationMessage && (
          <div
            className={`text-sm font-medium ${
              validationMessage.includes('Verified') || validationMessage.includes('تم التحقق')
                ? 'text-green-300'
                : validationMessage.includes('Estimated') || validationMessage.includes('تقريبي')
                ? 'text-yellow-300'
                : validationMessage.includes('Found') || validationMessage.includes('تم العثور')
                ? 'text-green-300'
                : 'text-red-300'
            }`}
          >
            {validationMessage}
          </div>
        )}

        <div className="text-xs text-white/70 text-center border-t border-white/20 pt-2">
          {isAr
            ? 'أدخل الأرقام كما تظهر على لوحة العنوان الزرقاء'
            : 'Enter numbers as shown on your blue address plate'}
        </div>
      </div>

      {/* Map link (optional) */}
      {showMap && zone && street && building && (
        <div className="text-sm text-gray-600">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${25.276987 + parseInt(zone || '0') * 0.001},${51.520008 + parseInt(zone || '0') * 0.001}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            {isAr ? 'عرض على الخريطة' : 'View on Map'}
          </a>
        </div>
      )}

      {/* Error panel */}
      {hasError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          {isAr
            ? 'فشل التحقق من العنوان — تحقق من اتصالك بالإنترنت وحاول مرة أخرى.'
            : 'Address Validation Failed — check your internet connection and try again.'}
        </div>
      )}
    </div>
  );
}
