import { query } from '../config/db.js';
import { NotFoundError } from '../errors/AppError.js';

/**
 * WalletService — read-only queries for wallet data.
 * All mutations go through TransactionService.
 */

/**
 * Retrieve a wallet by ID. Throws 404 if not found.
 */
export async function getWalletById(walletId) {
  const { rows } = await query(
    `SELECT
       w.id,
       w.name,
       w.owner_id,
       w.owner_type,
       w.balance,
       w.is_active,
       w.created_at,
       w.updated_at,
       at.id   AS asset_type_id,
       at.name AS asset_type_name,
       at.symbol AS asset_type_symbol
     FROM wallets w
     JOIN asset_types at ON at.id = w.asset_type_id
     WHERE w.id = $1`,
    [walletId],
  );
  if (!rows.length) throw new NotFoundError('Wallet');
  return formatWallet(rows[0]);
}

/**
 * List all wallets with optional filters.
 */
export async function listWallets({ ownerType, page = 1, limit = 20 } = {}) {
  const conditions = [];
  const params = [];

  if (ownerType) {
    conditions.push(`w.owner_type = $${params.length + 1}`);
    params.push(ownerType);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows } = await query(
    `SELECT
       w.id, w.name, w.owner_id, w.owner_type, w.balance, w.is_active,
       w.created_at, w.updated_at,
       at.id AS asset_type_id, at.name AS asset_type_name, at.symbol AS asset_type_symbol
     FROM wallets w
     JOIN asset_types at ON at.id = w.asset_type_id
     ${where}
     ORDER BY w.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  const { rows: countRows } = await query(
    `SELECT COUNT(*) AS total FROM wallets w ${where}`,
    params,
  );

  return {
    data: rows.map(formatWallet),
    pagination: {
      page,
      limit,
      total: parseInt(countRows[0].total),
      pages: Math.ceil(parseInt(countRows[0].total) / limit),
    },
  };
}

/**
 * Get paginated ledger transaction history for a wallet.
 */
export async function getWalletTransactions(walletId, { page = 1, limit = 20 } = {}) {
  // Verify wallet exists
  await getWalletById(walletId);

  const offset = (page - 1) * limit;

  const { rows } = await query(
    `SELECT
       le.id, le.entry_type, le.amount, le.balance_before, le.balance_after, le.created_at,
       t.id AS transaction_id, t.type AS transaction_type, t.status,
       t.reference_id, t.description, t.metadata
     FROM ledger_entries le
     JOIN transactions t ON t.id = le.transaction_id
     WHERE le.wallet_id = $1
     ORDER BY le.created_at DESC
     LIMIT $2 OFFSET $3`,
    [walletId, limit, offset],
  );

  const { rows: countRows } = await query(
    'SELECT COUNT(*) AS total FROM ledger_entries WHERE wallet_id = $1',
    [walletId],
  );

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: parseInt(countRows[0].total),
      pages: Math.ceil(parseInt(countRows[0].total) / limit),
    },
  };
}

/**
 * List all active asset types.
 */
export async function listAssetTypes() {
  const { rows } = await query(
    'SELECT * FROM asset_types WHERE is_active = TRUE ORDER BY name',
  );
  return rows;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatWallet(row) {
  return {
    id: row.id,
    name: row.name ?? null,
    ownerId: row.owner_id,
    ownerType: row.owner_type,
    balance: parseFloat(row.balance),
    isActive: row.is_active,
    assetType: {
      id: row.asset_type_id,
      name: row.asset_type_name,
      symbol: row.asset_type_symbol,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
