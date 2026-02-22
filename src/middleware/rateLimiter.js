import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

/**
 * General API rate limiter — applied globally.
 * 100 requests per IP per minute by default.
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.',
    },
  },
  keyGenerator: (req) => req.ip,
});

/**
 * Stricter rate limiter for mutation endpoints (topup, bonus, spend).
 * 20 requests per IP per minute.
 */
export const mutationLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many transaction requests. Please slow down.',
    },
  },
  keyGenerator: (req) => req.ip,
});
