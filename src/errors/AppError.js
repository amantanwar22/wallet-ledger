/**
 * Base application error class.
 * All thrown errors in the app should extend this for consistent handling.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes operational errors from unexpected bugs

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

export class InsufficientFundsError extends AppError {
  constructor(available, required) {
    super(
      `Insufficient funds: available ${available}, required ${required}`,
      422,
      'INSUFFICIENT_FUNDS',
      { available, required },
    );
  }
}

export class IdempotencyConflictError extends AppError {
  constructor() {
    super(
      'An active request with this idempotency key already exists',
      409,
      'IDEMPOTENCY_CONFLICT',
    );
  }
}
