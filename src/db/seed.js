/**
 * Database seeder — inserts initial asset types, system wallets, and user wallets.
 *
 * Usage:  node src/db/seed.js
 * Safe to re-run (uses ON CONFLICT DO NOTHING)
 */

import pg from 'pg';
import { config } from 'dotenv';
config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Fixed UUIDs for deterministic seeding — change nothing between runs
const SEED = {
  assetTypes: {
    goldCoins:  '11111111-0000-0000-0000-000000000001',
    diamonds:   '11111111-0000-0000-0000-000000000002',
    loyalPts:   '11111111-0000-0000-0000-000000000003',
  },
  systemAccounts: {
    treasury:   'aaaaaaaa-0000-0000-0000-000000000001',
    revenue:    'aaaaaaaa-0000-0000-0000-000000000002',
    bonusPool:  'aaaaaaaa-0000-0000-0000-000000000003',
  },
  users: {
    alice:      'bbbbbbbb-0000-0000-0000-000000000001',
    bob:        'bbbbbbbb-0000-0000-0000-000000000002',
  },
  // Wallet IDs  [owner_id, asset_type_id] -> wallet_id
  wallets: {
    // System wallets
    treasury_gc:  'cccccccc-0000-0000-0000-000000000001',
    treasury_dia: 'cccccccc-0000-0000-0000-000000000002',
    treasury_lp:  'cccccccc-0000-0000-0000-000000000003',
    revenue_gc:   'cccccccc-0000-0000-0000-000000000004',
    bonuspool_gc: 'cccccccc-0000-0000-0000-000000000005',
    // User wallets
    alice_gc:     'dddddddd-0000-0000-0000-000000000001',
    alice_dia:    'dddddddd-0000-0000-0000-000000000002',
    alice_lp:     'dddddddd-0000-0000-0000-000000000003',
    bob_gc:       'dddddddd-0000-0000-0000-000000000004',
    bob_dia:      'dddddddd-0000-0000-0000-000000000005',
    bob_lp:       'dddddddd-0000-0000-0000-000000000006',
  },
};

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...\n');

    // ── 1. Asset Types ─────────────────────────────────────────────────────────
    const assetTypes = [
      { id: SEED.assetTypes.goldCoins, name: 'Gold Coins',     symbol: 'GC',  description: 'Primary in-game currency' },
      { id: SEED.assetTypes.diamonds,  name: 'Diamonds',       symbol: 'DIA', description: 'Premium currency for rare items' },
      { id: SEED.assetTypes.loyalPts,  name: 'Loyalty Points', symbol: 'LP',  description: 'Loyalty reward points' },
    ];

    for (const at of assetTypes) {
      await client.query(
        `INSERT INTO asset_types (id, name, symbol, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [at.id, at.name, at.symbol, at.description],
      );
      console.log(`  ✔ asset_type: ${at.name} (${at.symbol})`);
    }

    // ── 2. System Wallets (Treasury, Revenue, Bonus Pool) ────────────────────
    const systemWallets = [
      { id: SEED.wallets.treasury_gc,  name: 'Treasury - Gold Coins',    owner_id: SEED.systemAccounts.treasury,  asset_type_id: SEED.assetTypes.goldCoins, balance: 10_000_000 },
      { id: SEED.wallets.treasury_dia, name: 'Treasury - Diamonds',       owner_id: SEED.systemAccounts.treasury,  asset_type_id: SEED.assetTypes.diamonds,  balance: 1_000_000  },
      { id: SEED.wallets.treasury_lp,  name: 'Treasury - Loyalty Points', owner_id: SEED.systemAccounts.treasury,  asset_type_id: SEED.assetTypes.loyalPts,  balance: 50_000_000 },
      { id: SEED.wallets.revenue_gc,   name: 'Revenue - Gold Coins',      owner_id: SEED.systemAccounts.revenue,   asset_type_id: SEED.assetTypes.goldCoins, balance: 0          },
      { id: SEED.wallets.bonuspool_gc, name: 'Bonus Pool - Gold Coins',   owner_id: SEED.systemAccounts.bonusPool, asset_type_id: SEED.assetTypes.goldCoins, balance: 500_000    },
    ];

    for (const w of systemWallets) {
      await client.query(
        `INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance, name)
         VALUES ($1, $2, 'system', $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [w.id, w.owner_id, w.asset_type_id, w.balance, w.name],
      );
      console.log(`  ✔ system_wallet: ${w.name} (id=${w.id.slice(0, 8)}...)`);
    }

    // ── 3. User Wallets & Initial Balances ───────────────────────────────────
    const userWallets = [
      { id: SEED.wallets.alice_gc,  name: 'Alice', owner_id: SEED.users.alice, asset_type_id: SEED.assetTypes.goldCoins, balance: 1000 },
      { id: SEED.wallets.alice_dia, name: 'Alice', owner_id: SEED.users.alice, asset_type_id: SEED.assetTypes.diamonds,  balance: 50   },
      { id: SEED.wallets.alice_lp,  name: 'Alice', owner_id: SEED.users.alice, asset_type_id: SEED.assetTypes.loyalPts,  balance: 500  },
      { id: SEED.wallets.bob_gc,    name: 'Bob',   owner_id: SEED.users.bob,   asset_type_id: SEED.assetTypes.goldCoins, balance: 500  },
      { id: SEED.wallets.bob_dia,   name: 'Bob',   owner_id: SEED.users.bob,   asset_type_id: SEED.assetTypes.diamonds,  balance: 20   },
      { id: SEED.wallets.bob_lp,    name: 'Bob',   owner_id: SEED.users.bob,   asset_type_id: SEED.assetTypes.loyalPts,  balance: 200  },
    ];

    for (const w of userWallets) {
      await client.query(
        `INSERT INTO wallets (id, owner_id, owner_type, asset_type_id, balance, name)
         VALUES ($1, $2, 'user', $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [w.id, w.owner_id, w.asset_type_id, w.balance, w.name],
      );
      console.log(`  ✔ user_wallet:   id=${w.id.slice(0, 8)}... balance=${w.balance}`);
    }

    console.log('\n✅ Seeding complete!\n');
    console.log('─── Seed reference IDs ─────────────────────────────────');
    console.log('Asset Types:');
    Object.entries(SEED.assetTypes).forEach(([k, v]) => console.log(`  ${k.padEnd(12)} = ${v}`));
    console.log('\nSystem Accounts:');
    Object.entries(SEED.systemAccounts).forEach(([k, v]) => console.log(`  ${k.padEnd(12)} = ${v}`));
    console.log('\nUsers:');
    Object.entries(SEED.users).forEach(([k, v]) => console.log(`  ${k.padEnd(12)} = ${v}`));
    console.log('\nWallets:');
    Object.entries(SEED.wallets).forEach(([k, v]) => console.log(`  ${k.padEnd(14)} = ${v}`));
    console.log('────────────────────────────────────────────────────────\n');

  } finally {
    client.release();
    await pool.end();
  }
}

export { SEED };

seed().catch((err) => {
  console.error('✗ Seed error:', err.message);
  process.exit(1);
});