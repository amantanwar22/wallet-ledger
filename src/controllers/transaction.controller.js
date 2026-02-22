import * as txnService from '../services/transaction.service.js';

/**
 * POST /api/v1/transactions/topup
 */
export async function topup(req, res, next) {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    const txn = await txnService.topup({ ...req.body, idempotencyKey });
    res.status(201).json({ success: true, data: txn });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/transactions/bonus
 */
export async function bonus(req, res, next) {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    const txn = await txnService.bonus({ ...req.body, idempotencyKey });
    res.status(201).json({ success: true, data: txn });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/transactions/spend
 */
export async function spend(req, res, next) {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    const txn = await txnService.spend({ ...req.body, idempotencyKey });
    res.status(201).json({ success: true, data: txn });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/transactions/:id
 */
export async function getTransaction(req, res, next) {
  try {
    const { query } = await import('../config/db.js');
    const txn = await txnService.getTransaction(query, req.params.id);
    res.json({ success: true, data: txn });
  } catch (err) { next(err); }
}
