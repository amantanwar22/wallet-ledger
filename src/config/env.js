import { config } from 'dotenv';
config(); // Load .env before validating — idempotent, safe to call multiple times

import Joi from 'joi';


const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().integer().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_POOL_MIN: Joi.number().integer().min(0).default(2),
  DB_POOL_MAX: Joi.number().integer().min(1).default(10),

  RATE_LIMIT_WINDOW_MS: Joi.number().integer().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().default(100),

  IDEMPOTENCY_TTL_HOURS: Joi.number().integer().default(24),

  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'debug').default('info'),
}).unknown(true);

const { error, value: env } = schema.validate(process.env, { abortEarly: false });

if (error) {
  const missing = error.details.map((d) => d.message).join('\n  ');
  throw new Error(`Environment validation failed:\n  ${missing}`);
}

export default env;
