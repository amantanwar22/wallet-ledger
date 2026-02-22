import { query } from '../config/db.js';
import env from '../config/env.js';
import logger from '../config/logger.js';

/**
 * Idempotency middleware.
 *
 * If an `Idempotency-Key` header is present:
 *   1. Check the DB for a stored response for (key + path).
 *   2. If found and not expired → return cached response immediately (no handler called).
 *   3. If not found → proceed, then store the response before sending.
 *
 * This guarantees that retried requests (e.g. after network timeout) are safe.
 */
export default function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key) return next(); // Idempotency is optional on GET routes

  const requestPath = req.path;

  // Wrap res.json to intercept the response body before it's sent
  const originalJson = res.json.bind(res);
  let responseCaptured = false;

  res.json = async function (body) {
    if (!responseCaptured && res.statusCode < 500) {
      responseCaptured = true;
      try {
        const ttlHours = env.IDEMPOTENCY_TTL_HOURS;
        await query(
          `INSERT INTO idempotency_keys (key, request_path, response_status, response_body, expires_at)
           VALUES ($1, $2, $3, $4, NOW() + ($5 || ' hours')::INTERVAL)
           ON CONFLICT (key, request_path) DO NOTHING`,
          [key, requestPath, res.statusCode, JSON.stringify(body), ttlHours],
        );
      } catch (storeErr) {
        // Non-fatal — log and proceed, don't block the response
        logger.error('Failed to store idempotency key', { key, error: storeErr.message });
      }
    }
    return originalJson(body);
  };

  // Check for existing cached response
  query(
    `SELECT response_status, response_body
     FROM idempotency_keys
     WHERE key = $1 AND request_path = $2 AND expires_at > NOW()`,
    [key, requestPath],
  )
    .then(({ rows }) => {
      if (rows.length > 0) {
        const cached = rows[0];
        logger.info('Idempotency cache hit', { key, path: requestPath, requestId: req.id });
        res.setHeader('X-Idempotency-Replayed', 'true');
        responseCaptured = true; // Don't re-store the cached response
        return res.status(cached.response_status).json(cached.response_body);
      }
      next();
    })
    .catch(next);
}
