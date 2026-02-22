-- Migration: 001_create_asset_types
-- Asset types define the virtual currencies in the system

CREATE TABLE IF NOT EXISTS asset_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  symbol      VARCHAR(20)  NOT NULL,
  description TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT asset_types_name_unique   UNIQUE (name),
  CONSTRAINT asset_types_symbol_unique UNIQUE (symbol)
);

CREATE INDEX IF NOT EXISTS idx_asset_types_is_active ON asset_types (is_active);
