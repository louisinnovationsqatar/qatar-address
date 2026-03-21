class LocateResult {
  final ZoneInfo zone;
  final StreetInfo street;
  final BuildingInfo building;
  final Coordinates coordinates;
  final MapLinks links;
  final String source;
  final bool verified;
  final String fullAddress;
  final String fullAddressAr;

  LocateResult({
    required this.zone,
    required this.street,
    required this.building,
    required this.coordinates,
    required this.links,
    required this.source,
    required this.verified,
    required this.fullAddress,
    required this.fullAddressAr,
  });

  factory LocateResult.fromJson(Map<String, dynamic> json) {
    return LocateResult(
      zone: ZoneInfo.fromJson(json['zone']),
      street: StreetInfo.fromJson(json['street']),
      building: BuildingInfo.fromJson(json['building']),
      coordinates: Coordinates.fromJson(json['coordinates']),
      links: MapLinks.fromJson(json['links']),
      source: json['source'] ?? '',
      verified: json['verified'] ?? false,
      fullAddress: json['full_address'] ?? '',
      fullAddressAr: json['full_address_ar'] ?? '',
    );
  }
}

class ZoneInfo {
  final int number;
  final String? name;
  final String? nameAr;

  ZoneInfo({required this.number, this.name, this.nameAr});

  factory ZoneInfo.fromJson(Map<String, dynamic> json) {
    return ZoneInfo(number: json['number'], name: json['name'], nameAr: json['name_ar']);
  }
}

class StreetInfo {
  final int number;
  final String? name;
  final String? nameAr;

  StreetInfo({required this.number, this.name, this.nameAr});

  factory StreetInfo.fromJson(Map<String, dynamic> json) {
    return StreetInfo(number: json['number'], name: json['name'], nameAr: json['name_ar']);
  }
}

class BuildingInfo {
  final int number;
  BuildingInfo({required this.number});
  factory BuildingInfo.fromJson(Map<String, dynamic> json) => BuildingInfo(number: json['number']);
}

class Coordinates {
  final double lat;
  final double lng;

  Coordinates({required this.lat, required this.lng});

  factory Coordinates.fromJson(Map<String, dynamic> json) {
    return Coordinates(lat: (json['lat'] as num).toDouble(), lng: (json['lng'] as num).toDouble());
  }
}

class MapLinks {
  final String googleMaps;
  final String waze;

  MapLinks({required this.googleMaps, required this.waze});

  factory MapLinks.fromJson(Map<String, dynamic> json) {
    return MapLinks(googleMaps: json['google_maps'] ?? '', waze: json['waze'] ?? '');
  }
}

class ValidateResult {
  final bool valid;
  final bool zoneExists;
  final bool streetExists;
  final bool buildingExists;

  ValidateResult({required this.valid, required this.zoneExists, required this.streetExists, required this.buildingExists});

  factory ValidateResult.fromJson(Map<String, dynamic> json) {
    return ValidateResult(
      valid: json['valid'] ?? false,
      zoneExists: json['zone_exists'] ?? false,
      streetExists: json['street_exists'] ?? false,
      buildingExists: json['building_exists'] ?? false,
    );
  }
}

class ZoneSummary {
  final int zoneNumber;
  final String? zoneName;
  final String? zoneNameAr;
  final String? municipality;
  final String? municipalityAr;

  ZoneSummary({required this.zoneNumber, this.zoneName, this.zoneNameAr, this.municipality, this.municipalityAr});

  factory ZoneSummary.fromJson(Map<String, dynamic> json) {
    return ZoneSummary(
      zoneNumber: json['zone_number'],
      zoneName: json['zone_name'],
      zoneNameAr: json['zone_name_ar'],
      municipality: json['municipality'],
      municipalityAr: json['municipality_ar'],
    );
  }
}
