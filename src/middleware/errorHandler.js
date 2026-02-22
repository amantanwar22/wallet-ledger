import logger from '../config/logger.js';
import env from '../config/env.js';

/**
 * Global error handler middleware.
 * Must be the LAST middleware added to the Express app.
 *
 * Distinguishes operational errors (AppError) from unexpected bugs,
 * and returns a consistent JSON error envelope.
 */
// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
  const requestId = req.id || 'unknown';

  // Operational, expected errors (thrown deliberately)
  if (err.isOperational) {
    logger.warn('Operational error', {
      requestId,
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
      path: req.path,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
      requestId,
    });
  }

  // PostgreSQL constraint violations → translate to 422
  if (err.code === '23514') {
    // check_violation
    logger.warn('DB check constraint violation', { requestId, detail: err.detail });
    return res.status(422).json({
      success: false,
      error: { code: 'CONSTRAINT_VIOLATION', message: err.detail || 'Database constraint violated' },
      requestId,
    });
  }

  if (err.code === '23505') {
    // unique_violation
    logger.warn('DB unique constraint violation', { requestId, detail: err.detail });
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'Resource already exists' },
      requestId,
    });
  }

  // Unexpected / programming errors — log full stack, return generic 500
  logger.error('Unhandled error', {
    requestId,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (env.NODE_ENV === 'production') {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      requestId,
    });
  }

  // Development — expose stack trace
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: err.message, stack: err.stack },
    requestId,
  });
}
