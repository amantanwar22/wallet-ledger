-- Migration: 004_create_ledger_entries
-- Double-entry: every transaction creates exactly 2 entries (one debit, one credit)
-- This ensures the ledger is always balanced and provides a full audit trail

DO $$ BEGIN
  CREATE TYPE entry_type_enum AS ENUM ('debit', 'credit');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


CREATE TABLE IF NOT EXISTS ledger_entries (
  id             UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID             NOT NULL REFERENCES transactions (id),
  wallet_id      UUID             NOT NULL REFERENCES wallets (id),
  entry_type     entry_type_enum  NOT NULL,
  amount         NUMERIC(20,6)    NOT NULL,
  balance_before NUMERIC(20,6)    NOT NULL,   -- Balance snapshot for full audit trail
  balance_after  NUMERIC(20,6)    NOT NULL,   -- Balance snapshot for full audit trail
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT ledger_entries_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries (transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_wallet_id      ON ledger_entries (wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at     ON ledger_entries (created_at DESC);
