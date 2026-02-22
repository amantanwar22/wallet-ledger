import { withTransaction } from '../config/db.js';
import { InsufficientFundsError, NotFoundError, ConflictError } from '../errors/AppError.js';
import logger from '../config/logger.js';

/**
 * TransactionService — implements all 3 transaction flows with:
 *
 *  1. CONCURRENCY SAFETY   — SELECT ... FOR UPDATE acquires row-level locks
 *  2. DEADLOCK AVOIDANCE   — wallets always locked in ascending UUID order
 *  3. DOUBLE-ENTRY LEDGER  — every flow produces exactly 2 ledger entries
 *  4. ATOMICITY            — entire flow runs in a single PG transaction
 *  5. AUDIT TRAIL          — balance_before / balance_after captured per entry
 */

// ─── Flow 1: Wallet Top-up ────────────────────────────────────────────────
/**
 * User purchases credits with real money.
 * Treasury wallet  →  DEBIT  (credits leave system supply)
 * User wallet      →  CREDIT (user's balance goes up)
 *
 * @param {object} params
 * @param {string} params.walletId       - User's wallet ID
 * @param {string} params.systemWalletId - Treasury wallet ID
 * @param {number} params.amount
 * @param {string} params.referenceId    - External payment reference
 * @param {string} [params.description]
 * @param {object} [params.metadata]
 * @param {string} [params.idempotencyKey]
 */
export async function topup({
  walletId,
  systemWalletId,
  amount,
  referenceId,
  description,
  metadata = {},
  idempotencyKey,
}) {
  return withTransaction(async (client) => {
    // Check for duplicate idempotency key before doing anything
    if (idempotencyKey) {
      const { rows: existing } = await client.query(
        'SELECT id FROM transactions WHERE idempotency_key = $1',
        [idempotencyKey],
      );
      if (existing.length) {
        const { rows: txRows } = await client.query(
          'SELECT * FROM transactions WHERE id = $1',
          [existing[0].id],
        );
        return formatTransaction(txRows[0]);
      }
    }

    // Lock wallets in ascending UUID order to prevent deadlocks
    const [firstId, secondId] = sortIds(systemWalletId, walletId);
    const wallets = await lockWallets(client, firstId, secondId);

    const systemWallet = wallets.find((w) => w.id === systemWalletId);
    const userWallet   = wallets.find((w) => w.id === walletId);

    if (!systemWallet) throw new NotFoundError('System wallet');
    if (!userWallet)   throw new NotFoundError('User wallet');

    if (!systemWallet.is_active) throw new ConflictError('System wallet is inactive');
    if (!userWallet.is_active)   throw new ConflictError('User wallet is inactive');

    // Validate asset type match
    if (systemWallet.asset_type_id !== userWallet.asset_type_id) {
      throw new ConflictError('Wallet asset types do not match');
    }

    // Treasury must have enough supply
    if (parseFloat(systemWallet.balance) < amount) {
      throw new InsufficientFundsError(systemWallet.balance, amount);
    }

    // ── Create transaction record ────────────────────────────────────────
    const { rows: [txn] } = await client.query(
      `INSERT INTO transactions
         (type, status, user_wallet_id, system_wallet_id, amount, reference_id, idempotency_key, description, metadata)
       VALUES ('topup', 'pending', $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [walletId, systemWalletId, amount, referenceId, idempotencyKey || null, description || null, JSON.stringify(metadata)],
    );

    // ── Debit system wallet (treasury loses supply) ──────────────────────
    await debitWallet(client, systemWallet, amount, txn.id);

    // ── Credit user wallet ───────────────────────────────────────────────
    await creditWallet(client, userWallet, amount, txn.id);

    // ── Mark transaction completed ───────────────────────────────────────
    const { rows: [completed] } = await client.query(
      "UPDATE transactions SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *",
      [txn.id],
    );

    logger.info('Topup completed', { transactionId: txn.id, walletId, amount });
    return formatTransaction(completed);
  });
}

// ─── Flow 2: Bonus / Incentive ────────────────────────────────────────────
/**
 * System issues free credits (referral bonus, daily reward, etc.)
 * Bonus-pool wallet  →  DEBIT
 * User wallet        →  CREDIT
 */
export async function bonus({
  walletId,
  systemWalletId,
  amount,
  reason,
  description,
  metadata = {},
  idempotencyKey,
}) {
  return withTransaction(async (client) => {
    if (idempotencyKey) {
      const dup = await checkDuplicate(client, idempotencyKey);
      if (dup) return dup;
    }

    const [firstId, secondId] = sortIds(systemWalletId, walletId);
    const wallets = await lockWallets(client, firstId, secondId);

    const systemWallet = wallets.find((w) => w.id === systemWalletId);
    const userWallet   = wallets.find((w) => w.id === walletId);

    if (!systemWallet) throw new NotFoundError('System wallet');
    if (!userWallet)   throw new NotFoundError('User wallet');
    if (!systemWallet.is_active) throw new ConflictError('Bonus pool wallet is inactive');
    if (!userWallet.is_active)   throw new ConflictError('User wallet is inactive');
    if (systemWallet.asset_type_id !== userWallet.asset_type_id) {
      throw new ConflictError('Wallet asset types do not match');
    }

    if (parseFloat(systemWallet.balance) < amount) {
      throw new InsufficientFundsError(systemWallet.balance, amount);
    }

    const { rows: [txn] } = await client.query(
      `INSERT INTO transactions
         (type, status, user_wallet_id, system_wallet_id, amount, idempotency_key, description, metadata)
       VALUES ('bonus', 'pending', $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [walletId, systemWalletId, amount, idempotencyKey || null, description || ('Bonus: ' + reason), JSON.stringify({ reason, ...metadata })],
    );

    await debitWallet(client, systemWallet, amount, txn.id);
    await creditWallet(client, userWallet, amount, txn.id);

    const { rows: [completed] } = await client.query(
      "UPDATE transactions SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *",
      [txn.id],
    );

    logger.info('Bonus issued', { transactionId: txn.id, walletId, amount, reason });
    return formatTransaction(completed);
  });
}

// ─── Flow 3: Purchase / Spend ─────────────────────────────────────────────
/**
 * User spends credits to buy a service or item within the app.
 * User wallet    →  DEBIT  (balance goes down)
 * Revenue wallet →  CREDIT (system collects revenue)
 */
export async function spend({
  walletId,
  systemWalletId,
  amount,
  serviceId,
  description,
  metadata = {},
  idempotencyKey,
}) {
  return withTransaction(async (client) => {
    if (idempotencyKey) {
      const dup = await checkDuplicate(client, idempotencyKey);
      if (dup) return dup;
    }

    const [firstId, secondId] = sortIds(walletId, systemWalletId);
    const wallets = await lockWallets(client, firstId, secondId);

    const userWallet   = wallets.find((w) => w.id === walletId);
    const systemWallet = wallets.find((w) => w.id === systemWalletId);

    if (!userWallet)   throw new NotFoundError('User wallet');
    if (!systemWallet) throw new NotFoundError('Revenue wallet');
    if (!userWallet.is_active)   throw new ConflictError('User wallet is inactive');
    if (!systemWallet.is_active) throw new ConflictError('Revenue wallet is inactive');
    if (userWallet.asset_type_id !== systemWallet.asset_type_id) {
      throw new ConflictError('Wallet asset types do not match');
    }

    // Critical: ensure user has enough balance
    if (parseFloat(userWallet.balance) < amount) {
      throw new InsufficientFundsError(parseFloat(userWallet.balance), amount);
    }

    const { rows: [txn] } = await client.query(
      `INSERT INTO transactions
         (type, status, user_wallet_id, system_wallet_id, amount, idempotency_key, description, metadata)
       VALUES ('spend', 'pending', $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [walletId, systemWalletId, amount, idempotencyKey || null, description || ('Purchase: ' + serviceId), JSON.stringify({ serviceId, ...metadata })],
    );

    // Debit user first, then credit system
    await debitWallet(client, userWallet, amount, txn.id);
    await creditWallet(client, systemWallet, amount, txn.id);

    const { rows: [completed] } = await client.query(
      "UPDATE transactions SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *",
      [txn.id],
    );

    logger.info('Spend completed', { transactionId: txn.id, walletId, amount, serviceId });
    return formatTransaction(completed);
  });
}

/**
 * Get a transaction by ID.
 */
export async function getTransaction(client_or_query, transactionId) {
  // Accept either a raw query fn or pool client
  const queryFn = typeof client_or_query === 'function' ? client_or_query : null;
  const { query: dbQuery } = await import('../config/db.js');
  const fn = queryFn || dbQuery;

  const { rows } = await fn(
    `SELECT
       t.*,
       json_agg(le ORDER BY le.created_at) AS ledger_entries
     FROM transactions t
     LEFT JOIN ledger_entries le ON le.transaction_id = t.id
     WHERE t.id = $1
     GROUP BY t.id`,
    [transactionId],
  );
  if (!rows.length) throw new NotFoundError('Transaction');
  return formatTransaction(rows[0]);
}

// ─── Internal helpers ─────────────────────────────────────────────────────

/**
 * Lock two wallets by primary key in ascending UUID order.
 * Consistent ordering is the key deadlock-avoidance strategy.
 * When all transactions acquire locks in the same order, circular wait (deadlock) is impossible.
 */
async function lockWallets(client, id1, id2) {
  const { rows } = await client.query(
    `SELECT * FROM wallets WHERE id IN ($1, $2) ORDER BY id FOR UPDATE`,
    [id1, id2],
  );
  if (rows.length < 2) throw new NotFoundError('One or both wallets');
  return rows;
}

/**
 * Sort two wallet IDs so locks are always acquired in ascending order.
 * This is the deadlock avoidance mechanism.
 */
function sortIds(a, b) {
  return a < b ? [a, b] : [b, a];
}

/**
 * Debit (subtract) from a wallet and insert a ledger entry.
 * Updates wallet balance in-place on the locked row.
 */
async function debitWallet(client, wallet, amount, transactionId) {
  const balanceBefore = parseFloat(wallet.balance);
  const balanceAfter  = balanceBefore - amount;

  // Update balance (DB-level check constraint will reject negatives)
  await client.query(
    'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
    [amount, wallet.id],
  );

  await client.query(
    `INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, balance_before, balance_after)
     VALUES ($1, $2, 'debit', $3, $4, $5)`,
    [transactionId, wallet.id, amount, balanceBefore, balanceAfter],
  );
}

/**
 * Credit (add) to a wallet and insert a ledger entry.
 */
async function creditWallet(client, wallet, amount, transactionId) {
  const balanceBefore = parseFloat(wallet.balance);
  const balanceAfter  = balanceBefore + amount;

  await client.query(
    'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
    [amount, wallet.id],
  );

  await client.query(
    `INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, balance_before, balance_after)
     VALUES ($1, $2, 'credit', $3, $4, $5)`,
    [transactionId, wallet.id, amount, balanceBefore, balanceAfter],
  );
}

/**
 * Check if a transaction with this idempotency key already exists.
 * Returns formatted transaction if found, null otherwise.
 */
async function checkDuplicate(client, idempotencyKey) {
  const { rows } = await client.query(
    'SELECT * FROM transactions WHERE idempotency_key = $1',
    [idempotencyKey],
  );
  if (rows.length) {
    logger.info('Idempotency DB hit (transaction layer)', { idempotencyKey });
    return formatTransaction(rows[0]);
  }
  return null;
}

function formatTransaction(row) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    userWalletId: row.user_wallet_id,
    systemWalletId: row.system_wallet_id,
    amount: parseFloat(row.amount),
    referenceId: row.reference_id,
    idempotencyKey: row.idempotency_key,
    description: row.description,
    metadata: row.metadata,
    ledgerEntries: row.ledger_entries || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
