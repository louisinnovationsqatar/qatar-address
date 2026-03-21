class QatarAddressException implements Exception {
  final String code;
  final String message;
  final int statusCode;

  QatarAddressException({required this.code, required this.message, required this.statusCode});

  @override
  String toString() => 'QatarAddressException($code): $message';
}
