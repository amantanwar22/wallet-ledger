-- Migration: 006_add_wallet_name
-- Adds a human-readable name to wallets so system wallets are identifiable via the API

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS name VARCHAR(100) NULL;

-- Update existing system wallets with descriptive names
UPDATE wallets SET name = 'Treasury - Gold Coins'     WHERE id = 'cccccccc-0000-0000-0000-000000000001';
UPDATE wallets SET name = 'Treasury - Diamonds'        WHERE id = 'cccccccc-0000-0000-0000-000000000002';
UPDATE wallets SET name = 'Treasury - Loyalty Points'  WHERE id = 'cccccccc-0000-0000-0000-000000000003';
UPDATE wallets SET name = 'Revenue - Gold Coins'       WHERE id = 'cccccccc-0000-0000-0000-000000000004';
UPDATE wallets SET name = 'Bonus Pool - Gold Coins'    WHERE id = 'cccccccc-0000-0000-0000-000000000005';
-- Update existing user wallets with names (Alice and Bob)
UPDATE wallets SET name = 'Alice' WHERE id IN ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000003');
UPDATE wallets SET name = 'Bob'   WHERE id IN ('dddddddd-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000006');
