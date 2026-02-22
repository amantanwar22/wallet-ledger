-- Migration: 005_create_idempotency_keys
-- Stores responses for idempotent requests to prevent duplicate transactions
-- on client retry (e.g., network timeout, double-click, etc.)

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  key             VARCHAR(255) NOT NULL,
  request_path    VARCHAR(500) NOT NULL,
  response_status INTEGER      NOT NULL,
  response_body   JSONB        NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ  NOT NULL,

  CONSTRAINT idempotency_keys_key_path_unique UNIQUE (key, request_path)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key        ON idempotency_keys (key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys (expires_at);

-- migrations tracking table (managed by migrate.js)
CREATE TABLE IF NOT EXISTS schema_migrations (
  id         SERIAL       PRIMARY KEY,
  filename   VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
