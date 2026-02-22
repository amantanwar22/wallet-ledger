-- =============================================================================
-- seed.sql — Wallet Ledger Service
-- Run this after migrations to initialize the database with required seed data.
--
-- Usage: psql -U postgres -d wallet_ledger -f seed.sql
-- =============================================================================

-- ── Asset Types ──────────────────────────────────────────────────────────────
INSERT INTO asset_types (id, name, symbol, description)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Gold Coins',     'GC',  'Primary in-game currency'),
  ('11111111-0000-0000-0000-000000000002', 'Diamonds',       'DIA', 'Premium currency for rare items'),
  ('11111111-0000-0000-0000-000000000003', 'Loyalty Points', 'LP',  'Loyalty reward points')
ON CONFLICT (id) DO NOTHING;

-- ── System Wallets (Treasury, Revenue, Bonus Pool) ────────────────────────────
-- Treasury — acts as the source for all top-up credits
INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance)
VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'system', '11111111-0000-0000-0000-000000000001', 10000000),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'system', '11111111-0000-0000-0000-000000000002', 1000000),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'system', '11111111-0000-0000-0000-000000000003', 50000000)
ON CONFLICT (id) DO NOTHING;

-- Revenue — collects spend transactions
INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance)
VALUES
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'system', '11111111-0000-0000-0000-000000000001', 0)
ON CONFLICT (id) DO NOTHING;

-- Bonus Pool — issues free credits (referrals, daily login, etc.)
INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance)
VALUES
  ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000003', 'system', '11111111-0000-0000-0000-000000000001', 500000)
ON CONFLICT (id) DO NOTHING;

-- ── User Wallets ──────────────────────────────────────────────────────────────
-- Alice (user bbbbbbbb-0000-0000-0000-000000000001) — 1000 GC, 50 DIA, 500 LP
INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance)
VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'user', '11111111-0000-0000-0000-000000000001', 1000),
  ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'user', '11111111-0000-0000-0000-000000000002', 50),
  ('dddddddd-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'user', '11111111-0000-0000-0000-000000000003', 500)
ON CONFLICT (id) DO NOTHING;

-- Bob (user bbbbbbbb-0000-0000-0000-000000000002) — 500 GC, 20 DIA, 200 LP
INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance)
VALUES
  ('dddddddd-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'user', '11111111-0000-0000-0000-000000000001', 500),
  ('dddddddd-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', 'user', '11111111-0000-0000-0000-000000000002', 20),
  ('dddddddd-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000002', 'user', '11111111-0000-0000-0000-000000000003', 200)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Reference: Key UUIDs for API testing
-- =============================================================================
-- Asset Types:
--   Gold Coins     : 11111111-0000-0000-0000-000000000001
--   Diamonds       : 11111111-0000-0000-0000-000000000002
--   Loyalty Points : 11111111-0000-0000-0000-000000000003
--
-- System Wallets (owner IDs — not wallet IDs):
--   Treasury       : aaaaaaaa-0000-0000-0000-000000000001
--   Revenue        : aaaaaaaa-0000-0000-0000-000000000002
--   Bonus Pool     : aaaaaaaa-0000-0000-0000-000000000003
--
-- Wallet IDs:
--   Treasury GC    : cccccccc-0000-0000-0000-000000000001
--   Revenue GC     : cccccccc-0000-0000-0000-000000000004
--   Bonus Pool GC  : cccccccc-0000-0000-0000-000000000005
--   Alice GC       : dddddddd-0000-0000-0000-000000000001
--   Bob GC         : dddddddd-0000-0000-0000-000000000004
--
-- Users:
--   Alice          : bbbbbbbb-0000-0000-0000-000000000001
--   Bob            : bbbbbbbb-0000-0000-0000-000000000002
-- =============================================================================
