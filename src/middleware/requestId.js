import { v4 as uuidv4 } from 'uuid';

/**
 * Attaches a unique X-Request-ID to every request and response.
 * Used to correlate log entries, errors, and responses for a single request.
 */
export default function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || uuidv4();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}
