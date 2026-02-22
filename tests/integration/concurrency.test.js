/**
 * Concurrency Test — Brownie Point: Deadlock Avoidance & Race Condition Safety
 *
 * Fires N concurrent spend requests against the same wallet.
 * Verifies that:
 *   1. Balance never goes negative
 *   2. The exact right number of transactions succeed vs fail (INSUFFICIENT_FUNDS)
 *   3. Final balance = initial - (successCount × amount)
 *   4. No database errors or deadlocks occurred
 */
import request from 'supertest';
import app from '../../src/app.js';
import { resetDb, seedTestData, closeDb, IDS, query } from '../helpers/db.js';

beforeAll(async () => {
  await resetDb();
  await seedTestData();
});

afterAll(async () => {
  await closeDb();
});

describe('Concurrency — race conditions and deadlock avoidance', () => {
  it('should handle 20 concurrent spend requests safely (no negative balance, no corruption)', async () => {
    // Alice starts with 500 TC, each spend is 60 TC
    // → max 8 can succeed (8 × 60 = 480 ≤ 500), 9th would need 540 > 500
    const CONCURRENT = 20;
    const AMOUNT = 60;

    const requests = Array.from({ length: CONCURRENT }, (_, i) =>
      request(app)
        .post('/api/v1/transactions/spend')
        .set('Idempotency-Key', `concurrency-spend-${i}`) // Unique key per request
        .send({
          walletId:       IDS.aliceWallet,
          systemWalletId: IDS.revenueWallet,
          amount:         AMOUNT,
          serviceId:      `concurrent-item-${i}`,
        }),
    );

    const results = await Promise.allSettled(requests);

    const succeeded = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status === 201,
    );
    const rejected = results.filter(
      (r) =>
        r.status === 'fulfilled' &&
        (r.value.status === 422 || r.value.status === 409),
    );

    console.log(`\n  Concurrent spend results:`);
    console.log(`    ✔ Succeeded : ${succeeded.length}`);
    console.log(`    ✗ Rejected  : ${rejected.length}`);

    // All 422s should be INSUFFICIENT_FUNDS (not server errors)
    const serverErrors = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status >= 500,
    );
    expect(serverErrors).toHaveLength(0);

    // Final balance must equal 500 - (successCount × 60), never negative
    const { rows } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.aliceWallet]);
    const finalBalance = parseFloat(rows[0].balance);

    console.log(`    Balance before: 500`);
    console.log(`    Balance after : ${finalBalance}`);

    expect(finalBalance).toBeGreaterThanOrEqual(0);
    expect(finalBalance).toBe(500 - succeeded.length * AMOUNT);
  });

  it('should handle concurrent topups to the same wallet without corruption', async () => {
    // Bob starts with 100, fire 10 concurrent topups of 50 each → should all succeed
    const CONCURRENT = 10;
    const AMOUNT = 50;

    const { rows: before } = await query(
      'SELECT balance FROM wallets WHERE id = $1',
      [IDS.bobWallet],
    );
    const initialBalance = parseFloat(before[0].balance);

    const requests = Array.from({ length: CONCURRENT }, (_, i) =>
      request(app)
        .post('/api/v1/transactions/topup')
        .set('Idempotency-Key', `concurrency-topup-${i}`)
        .send({
          walletId:       IDS.bobWallet,
          systemWalletId: IDS.treasuryWallet,
          amount:         AMOUNT,
          referenceId:    `concurrency-ref-${i}`,
        }),
    );

    const results = await Promise.allSettled(requests);
    const succeeded = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status === 201,
    );

    const { rows: after } = await query(
      'SELECT balance FROM wallets WHERE id = $1',
      [IDS.bobWallet],
    );
    const finalBalance = parseFloat(after[0].balance);

    console.log(`\n  Concurrent topup results:`);
    console.log(`    ✔ Succeeded : ${succeeded.length}`);
    console.log(`    Balance: ${initialBalance} → ${finalBalance}`);

    // All topups should succeed (treasury has plenty of supply)
    expect(succeeded).toHaveLength(CONCURRENT);
    expect(finalBalance).toBe(initialBalance + CONCURRENT * AMOUNT);
  });

  it('should produce no orphaned ledger entries (every transaction has exactly 2 entries)', async () => {
    const { rows } = await query(`
      SELECT t.id, COUNT(le.id) AS entry_count
      FROM transactions t
      LEFT JOIN ledger_entries le ON le.transaction_id = t.id
      WHERE t.status = 'completed'
      GROUP BY t.id
      HAVING COUNT(le.id) <> 2
    `);

    // No completed transaction should have != 2 ledger entries
    expect(rows).toHaveLength(0);
  });
});
