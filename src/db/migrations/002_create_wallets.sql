-- Migration: 002_create_wallets
-- Each wallet belongs to an owner (user or system account) and holds one asset type

DO $$ BEGIN
  CREATE TYPE owner_type_enum AS ENUM ('user', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS wallets (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID         NOT NULL,
  owner_type    owner_type_enum NOT NULL DEFAULT 'user',
  asset_type_id UUID         NOT NULL REFERENCES asset_types (id),
  balance       NUMERIC(20,6) NOT NULL DEFAULT 0,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- A user can only have one wallet per asset type
  CONSTRAINT wallets_owner_asset_unique UNIQUE (owner_id, asset_type_id),

  -- Balance must never go negative (enforced at DB level too)
  CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_wallets_owner_id      ON wallets (owner_id);
CREATE INDEX IF NOT EXISTS idx_wallets_asset_type_id ON wallets (asset_type_id);
CREATE INDEX IF NOT EXISTS idx_wallets_owner_type    ON wallets (owner_type);
