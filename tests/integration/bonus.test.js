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

describe('POST /api/v1/transactions/bonus', () => {
  const payload = {
    walletId:       IDS.aliceWallet,
    systemWalletId: IDS.bonusWallet,
    amount:         50,
    reason:         'referral',
    description:    'Referral bonus',
  };

  it('should credit user and debit bonus pool', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/bonus')
      .set('Idempotency-Key', 'bonus-test-001')
      .send(payload)
      .expect(201);

    expect(res.body.data.type).toBe('bonus');
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.amount).toBe(50);

    const { rows: alice } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.aliceWallet]);
    expect(parseFloat(alice[0].balance)).toBe(550); // 500 + 50

    const { rows: pool } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.bonusWallet]);
    expect(parseFloat(pool[0].balance)).toBe(499_950); // 500_000 - 50
  });

  it('should be idempotent — replaying returns same response without changing balance', async () => {
    await request(app)
      .post('/api/v1/transactions/bonus')
      .set('Idempotency-Key', 'bonus-test-001')
      .send(payload)
      .expect(201);

    const { rows: alice } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.aliceWallet]);
    expect(parseFloat(alice[0].balance)).toBe(550); // still 550

    const { rows: count } = await query(
      "SELECT COUNT(*) AS cnt FROM transactions WHERE idempotency_key = 'bonus-test-001'",
    );
    expect(parseInt(count[0].cnt)).toBe(1);
  });

  it('should fail if bonus pool has insufficient balance', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/bonus')
      .set('Idempotency-Key', 'bonus-overflow')
      .send({ ...payload, amount: 999_999_999 })
      .expect(422);

    expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
  });
});
