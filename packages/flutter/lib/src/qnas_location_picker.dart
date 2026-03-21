import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qatar_address/qatar_address.dart';
import 'dart:async';

class QNASLocationPicker extends StatefulWidget {
  final String baseUrl;
  final ValueChanged<Map<String, dynamic>?>? onChanged;
  final String locale;
  final bool showApartment;
  final Map<String, String>? initialValue;

  const QNASLocationPicker({
    super.key,
    this.baseUrl = 'https://api.qataraddress.com',
    this.onChanged,
    this.locale = 'en',
    this.showApartment = false,
    this.initialValue,
  });

  @override
  State<QNASLocationPicker> createState() => _QNASLocationPickerState();
}

class _QNASLocationPickerState extends State<QNASLocationPicker> {
  late final QatarAddress _client;
  late final TextEditingController _zoneCtrl;
  late final TextEditingController _streetCtrl;
  late final TextEditingController _buildingCtrl;
  late final TextEditingController _aptCtrl;

  Timer? _debounce;
  bool _isValidating = false;
  String _validationMessage = '';
  Color _messageColor = Colors.white;

  bool get _isAr => widget.locale == 'ar';

  @override
  void initState() {
    super.initState();
    _client = QatarAddress(baseUrl: widget.baseUrl);
    _zoneCtrl = TextEditingController(text: widget.initialValue?['zone'] ?? '');
    _streetCtrl = TextEditingController(text: widget.initialValue?['street'] ?? '');
    _buildingCtrl = TextEditingController(text: widget.initialValue?['building'] ?? '');
    _aptCtrl = TextEditingController(text: widget.initialValue?['apartmentNo'] ?? '');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _zoneCtrl.dispose();
    _streetCtrl.dispose();
    _buildingCtrl.dispose();
    _aptCtrl.dispose();
    _client.dispose();
    super.dispose();
  }

  void _onFieldChanged() {
    _debounce?.cancel();
    setState(() { _validationMessage = ''; });
    widget.onChanged?.call(null);

    if (_zoneCtrl.text.isNotEmpty && _streetCtrl.text.isNotEmpty && _buildingCtrl.text.isNotEmpty) {
      _debounce = Timer(const Duration(milliseconds: 500), _validateAddress);
    }
  }

  Future<void> _validateAddress() async {
    setState(() { _isValidating = true; });

    try {
      final zone = int.parse(_zoneCtrl.text);
      final street = int.parse(_streetCtrl.text);
      final building = int.parse(_buildingCtrl.text);

      final result = await _client.locate(zone, street, building);

      widget.onChanged?.call({
        'zone': _zoneCtrl.text,
        'street': _streetCtrl.text,
        'building': _buildingCtrl.text,
        'apartmentNo': _aptCtrl.text,
        'lat': result.coordinates.lat,
        'lng': result.coordinates.lng,
        'googleMapsLink': result.links.googleMaps,
        'wazeLink': result.links.waze,
        'source': result.source,
        'verified': result.verified,
        'fullAddress': result.fullAddress,
        'fullAddressAr': result.fullAddressAr,
      });

      setState(() {
        _validationMessage = _isAr ? 'تم التحقق من العنوان' : 'Address Verified';
        _messageColor = Colors.greenAccent;
      });
    } catch (_) {
      final zone = int.tryParse(_zoneCtrl.text) ?? 0;
      final estLat = 25.276987 + zone * 0.001;
      final estLng = 51.520008 + zone * 0.001;

      widget.onChanged?.call({
        'zone': _zoneCtrl.text,
        'street': _streetCtrl.text,
        'building': _buildingCtrl.text,
        'apartmentNo': _aptCtrl.text,
        'lat': estLat,
        'lng': estLng,
        'source': 'GENERATED',
        'verified': false,
      });

      setState(() {
        _validationMessage = _isAr ? 'موقع تقريبي' : 'Estimated Location';
        _messageColor = Colors.yellowAccent;
      });
    } finally {
      setState(() { _isValidating = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: _isAr ? TextDirection.rtl : TextDirection.ltr,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF0054A6),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF003F7F), width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _isAr ? 'نظام العنوان الوطني القطري' : 'Qatar National Address System',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 14),
                ),
                if (_isValidating)
                  const SizedBox(
                    width: 16, height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (widget.showApartment) ...[
              _buildLabel(_isAr ? 'رقم الشقة/المنزل' : 'Apartment/House No.'),
              _buildInput(_aptCtrl, 10, false),
              const SizedBox(height: 12),
            ],
            Row(
              children: [
                Expanded(child: Column(children: [
                  _buildLabel(_isAr ? 'مبنى' : 'Building'),
                  _buildInput(_buildingCtrl, 5, true),
                ])),
                const SizedBox(width: 12),
                Expanded(child: Column(children: [
                  _buildLabel(_isAr ? 'شارع' : 'Street'),
                  _buildInput(_streetCtrl, 5, true),
                ])),
                const SizedBox(width: 12),
                Expanded(child: Column(children: [
                  _buildLabel(_isAr ? 'منطقة' : 'Zone'),
                  _buildInput(_zoneCtrl, 3, true),
                ])),
              ],
            ),
            if (_validationMessage.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(_validationMessage, style: TextStyle(color: _messageColor, fontSize: 13, fontWeight: FontWeight.w500)),
            ],
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.only(top: 8),
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: Colors.white24))),
              child: Center(
                child: Text(
                  _isAr ? 'أدخل الأرقام كما تظهر على لوحة العنوان الزرقاء' : 'Enter numbers as shown on your blue address plate',
                  style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Align(
      alignment: _isAr ? Alignment.centerRight : Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500)),
      ),
    );
  }

  Widget _buildInput(TextEditingController controller, int maxLength, bool numericOnly) {
    return TextField(
      controller: controller,
      onChanged: (_) => _onFieldChanged(),
      maxLength: maxLength,
      keyboardType: numericOnly ? TextInputType.number : TextInputType.text,
      inputFormatters: numericOnly ? [FilteringTextInputFormatter.digitsOnly] : null,
      textAlign: TextAlign.center,
      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, letterSpacing: 2),
      decoration: InputDecoration(
        counterText: '',
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      ),
    );
  }
}
