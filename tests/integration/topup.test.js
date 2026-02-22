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

describe('POST /api/v1/transactions/topup', () => {
  const IDEMPOTENCY_KEY = 'topup-test-001';

  const payload = {
    walletId:       IDS.aliceWallet,
    systemWalletId: IDS.treasuryWallet,
    amount:         100,
    referenceId:    'stripe-charge-111',
    description:    'Purchase 100 TC',
  };

  it('should credit user wallet and debit treasury wallet', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/topup')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('topup');
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.amount).toBe(100);

    // Verify Alice's balance increased by 100
    const { rows } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.aliceWallet]);
    expect(parseFloat(rows[0].balance)).toBe(600); // 500 + 100

    // Verify treasury decreased by 100
    const { rows: sys } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.treasuryWallet]);
    expect(parseFloat(sys[0].balance)).toBe(999_900); // 1_000_000 - 100
  });

  it('should create exactly 2 ledger entries (debit + credit)', async () => {
    const { rows: txns } = await query(
      "SELECT id FROM transactions WHERE idempotency_key = $1",
      [IDEMPOTENCY_KEY],
    );
    const { rows: entries } = await query(
      'SELECT entry_type FROM ledger_entries WHERE transaction_id = $1',
      [txns[0].id],
    );
    expect(entries).toHaveLength(2);
    const types = entries.map((e) => e.entry_type).sort();
    expect(types).toEqual(['credit', 'debit']);
  });

  it('should return the cached response on idempotency replay (no new transaction)', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/topup')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send(payload)
      .expect(201);

    // Balance should NOT have changed again
    const { rows } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.aliceWallet]);
    expect(parseFloat(rows[0].balance)).toBe(600); // still 600

    // Only 1 transaction with this key
    const { rows: txns } = await query(
      "SELECT COUNT(*) AS cnt FROM transactions WHERE idempotency_key = $1",
      [IDEMPOTENCY_KEY],
    );
    expect(parseInt(txns[0].cnt)).toBe(1);
  });

  it('should fail with 422 if amount is negative', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/topup')
      .set('Idempotency-Key', 'topup-neg')
      .send({ ...payload, amount: -50, referenceId: 'bad' })
      .expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should fail with 422 if amount exceeds treasury balance', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/topup')
      .set('Idempotency-Key', 'topup-overflow')
      .send({ ...payload, amount: 999_999_999, referenceId: 'big-charge' })
      .expect(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
  });
});
