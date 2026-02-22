/**
 * Test DB helper — sets up a test database connection and resets state between tests.
 */
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'wallet_ledger_test',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

export const db = pool;

export const query = (text, params) => pool.query(text, params);

/**
 * Truncate all data tables between test runs (not schema).
 * Order matters due to FK constraints.
 */
export async function resetDb() {
  await pool.query(`
    TRUNCATE TABLE
      idempotency_keys,
      ledger_entries,
      transactions,
      wallets,
      asset_types
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Insert a minimal set of seed data for tests using fixed IDs.
 */
export async function seedTestData() {
  // Asset type
  await pool.query(`
    INSERT INTO asset_types (id, name, symbol)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Coin', 'TC')
  `);

  // System treasury wallet
  await pool.query(`
    INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance)
    VALUES (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'system',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      1000000
    )
  `);

  // System bonus pool
  await pool.query(`
    INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance)
    VALUES (
      'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      'system',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      500000
    )
  `);

  // System revenue wallet
  await pool.query(`
    INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance)
    VALUES (
      '99999999-9999-9999-9999-999999999999',
      '88888888-8888-8888-8888-888888888888',
      'system',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      0
    )
  `);

  // User wallet — Alice with 500 TC
  await pool.query(`
    INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance)
    VALUES (
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      '11111111-1111-1111-1111-111111111111',
      'user',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      500
    )
  `);

  // User wallet — Bob with 100 TC
  await pool.query(`
    INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance)
    VALUES (
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      'user',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      100
    )
  `);
}

// IDs handy for tests
export const IDS = {
  assetType:     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  treasuryWallet:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  bonusWallet:   'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  revenueWallet: '99999999-9999-9999-9999-999999999999',
  aliceWallet:   'dddddddd-dddd-dddd-dddd-dddddddddddd',
  bobWallet:     '22222222-2222-2222-2222-222222222222',
};

export async function closeDb() {
  await pool.end();
}
