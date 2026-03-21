import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';
import 'exceptions.dart';

class QatarAddress {
  final String baseUrl;
  final http.Client _client;

  QatarAddress({this.baseUrl = 'https://api.qataraddress.com', http.Client? client})
      : _client = client ?? http.Client();

  Future<List<ZoneSummary>> getZones({int page = 1, int limit = 50}) async {
    final data = await _get('/api/v1/zones?page=$page&limit=$limit');
    return (data['data'] as List).map((z) => ZoneSummary.fromJson(z)).toList();
  }

  Future<LocateResult> locate(int zone, int street, int building) async {
    final data = await _get('/api/v1/locate/$zone/$street/$building');
    return LocateResult.fromJson(data['data']);
  }

  Future<ValidateResult> validate(int zone, {int? street, int? building}) async {
    var params = 'zone=$zone';
    if (street != null) params += '&street=$street';
    if (building != null) params += '&building=$building';
    final data = await _get('/api/v1/validate?$params');
    return ValidateResult.fromJson(data['data']);
  }

  Future<List<dynamic>> search(String query, {String? lang, String? type}) async {
    var params = 'q=${Uri.encodeComponent(query)}';
    if (lang != null) params += '&lang=$lang';
    if (type != null) params += '&type=$type';
    final data = await _get('/api/v1/search?$params');
    return data['data'] as List;
  }

  Future<Map<String, dynamic>> reverse(double lat, double lng, {int radius = 200}) async {
    final data = await _get('/api/v1/reverse?lat=$lat&lng=$lng&radius=$radius');
    return data['data'];
  }

  Future<Map<String, dynamic>> contribute(Map<String, dynamic> input) async {
    final data = await _post('/api/v1/contribute', input);
    return data['data'];
  }

  Future<Map<String, dynamic>> health() async {
    final data = await _get('/api/v1/health');
    return data['data'];
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final response = await _client.get(Uri.parse('$baseUrl$path'));
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final response = await _client.post(
      Uri.parse('$baseUrl$path'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      final error = data['error'] as Map<String, dynamic>? ?? {};
      throw QatarAddressException(
        code: error['code'] ?? 'SERVER_ERROR',
        message: error['message'] ?? 'Request failed',
        statusCode: response.statusCode,
      );
    }
    return data;
  }

  void dispose() => _client.close();
}
