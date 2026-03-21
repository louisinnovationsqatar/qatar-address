import type { ApiErrorCode } from '@qatar-address/types';

/**
 * Base error class for all Qatar Address SDK errors.
 */
export class QatarAddressError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;

  constructor(message: string, code: ApiErrorCode, statusCode: number) {
    super(message);
    this.name = 'QatarAddressError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the requested address (zone/street/building) does not exist.
 */
export class AddressNotFoundError extends QatarAddressError {
  constructor(message = 'Address not found') {
    super(message, 'ADDRESS_NOT_FOUND', 404);
    this.name = 'AddressNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the request payload fails server-side validation.
 */
export class ValidationError extends QatarAddressError {
  constructor(message = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the client has exceeded the API rate limit.
 */
export class RateLimitedError extends QatarAddressError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMITED', 429);
    this.name = 'RateLimitedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
