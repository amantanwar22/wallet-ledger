-- Migration: 003_create_transactions
-- A transaction represents a high-level financial event (topup, bonus, spend)
-- Each transaction produces double-entry ledger_entries

DO $$ BEGIN
  CREATE TYPE transaction_type_enum AS ENUM ('topup', 'bonus', 'spend');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status_enum AS ENUM ('pending', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


CREATE TABLE IF NOT EXISTS transactions (
  id               UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  type             transaction_type_enum   NOT NULL,
  status           transaction_status_enum NOT NULL DEFAULT 'pending',
  user_wallet_id   UUID                    NOT NULL REFERENCES wallets (id),
  system_wallet_id UUID                    NOT NULL REFERENCES wallets (id),
  amount           NUMERIC(20,6)           NOT NULL,
  reference_id     VARCHAR(255),              -- External payment reference (e.g., Stripe charge ID)
  idempotency_key  VARCHAR(255)            UNIQUE,
  description      TEXT,
  metadata         JSONB                   NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

  CONSTRAINT transactions_amount_positive     CHECK (amount > 0),
  CONSTRAINT transactions_wallets_differ      CHECK (user_wallet_id <> system_wallet_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_wallet_id  ON transactions (user_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type            ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_status          ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_id    ON transactions (reference_id);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_key ON transactions (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at      ON transactions (created_at DESC);
