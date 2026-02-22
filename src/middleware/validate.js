import Joi from 'joi';
import { ValidationError } from '../errors/AppError.js';

/**
 * Returns an Express middleware that validates req.body against the given Joi schema.
 * Throws a ValidationError (422) with all field errors on failure.
 *
 * @param {Joi.Schema} schema
 */
export const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message.replace(/['"]/g, ''),
    }));
    return next(new ValidationError('Request validation failed', details));
  }

  req.body = value; // Use coerced + stripped value
  return next();
};

/**
 * Returns an Express middleware that validates req.params against the given Joi schema.
 */
export const validateParams = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.params, { abortEarly: false });
  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message.replace(/['"]/g, ''),
    }));
    return next(new ValidationError('Invalid path parameters', details));
  }
  req.params = value;
  return next();
};

// ── Reusable field schemas ─────────────────────────────────────────────────
export const uuidParam = Joi.object({
  id: Joi.string().uuid().required(),
});

// ── Transaction request schemas ────────────────────────────────────────────
export const topupSchema = Joi.object({
  walletId:       Joi.string().uuid().required().description('User wallet UUID'),
  systemWalletId: Joi.string().uuid().required().description('Treasury wallet UUID'),
  amount:         Joi.number().positive().precision(6).required(),
  referenceId:    Joi.string().max(255).required().description('External payment reference'),
  description:    Joi.string().max(500).optional(),
  metadata:       Joi.object().optional().default({}),
});

export const bonusSchema = Joi.object({
  walletId:         Joi.string().uuid().required().description('User wallet UUID'),
  amount:           Joi.number().positive().precision(6).required(),
  systemWalletId:   Joi.string().uuid().required().description('Bonus-pool wallet UUID'),
  reason:           Joi.string().max(255).required().description('e.g. referral, daily_login'),
  description:      Joi.string().max(500).optional(),
  metadata:         Joi.object().optional().default({}),
});

export const spendSchema = Joi.object({
  walletId:         Joi.string().uuid().required().description('User wallet UUID'),
  amount:           Joi.number().positive().precision(6).required(),
  systemWalletId:   Joi.string().uuid().required().description('Revenue wallet UUID'),
  serviceId:        Joi.string().max(255).required().description('Service or item being purchased'),
  description:      Joi.string().max(500).optional(),
  metadata:         Joi.object().optional().default({}),
});
