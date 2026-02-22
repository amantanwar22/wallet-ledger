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

describe('POST /api/v1/transactions/spend', () => {
  const payload = {
    walletId:       IDS.aliceWallet,
    systemWalletId: IDS.revenueWallet,
    amount:         100,
    serviceId:      'item-sword-001',
    description:    'Buy Iron Sword',
  };

  it('should debit user wallet and credit revenue wallet', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Idempotency-Key', 'spend-test-001')
      .send(payload)
      .expect(201);

    expect(res.body.data.type).toBe('spend');
    expect(res.body.data.status).toBe('completed');

    const { rows: alice } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.aliceWallet]);
    expect(parseFloat(alice[0].balance)).toBe(400); // 500 - 100

    const { rows: rev } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.revenueWallet]);
    expect(parseFloat(rev[0].balance)).toBe(100); // 0 + 100
  });

  it('should reject spend if user balance is insufficient', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Idempotency-Key', 'spend-overdraft')
      .send({ ...payload, amount: 9999 })
      .expect(422);

    expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');

    // Balance should be unchanged
    const { rows } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.aliceWallet]);
    expect(parseFloat(rows[0].balance)).toBe(400); // no change
  });

  it('should be idempotent', async () => {
    // Replay same key
    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Idempotency-Key', 'spend-test-001')
      .send(payload)
      .expect(201);

    // Balance must not have changed again
    const { rows } = await query('SELECT balance FROM wallets WHERE id = $1', [IDS.aliceWallet]);
    expect(parseFloat(rows[0].balance)).toBe(400);
  });

  it('should fail validation if walletId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Idempotency-Key', 'spend-invalid')
      .send({ amount: 10, systemWalletId: IDS.revenueWallet, serviceId: 'x' })
      .expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/wallets/:id/transactions', () => {
  it('should return paginated ledger entries', async () => {
    const res = await request(app)
      .get(`/api/v1/wallets/${IDS.aliceWallet}/transactions`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination).toBeDefined();
  });
});
