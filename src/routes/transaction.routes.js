import { Router } from 'express';
import * as txnController from '../controllers/transaction.controller.js';
import {
  validateBody,
  validateParams,
  uuidParam,
  topupSchema,
  bonusSchema,
  spendSchema,
} from '../middleware/validate.js';
import idempotency from '../middleware/idempotency.js';
import { mutationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * @swagger
 * /transactions/topup:
 *   post:
 *     summary: Wallet top-up (purchase credits)
 *     description: Credits a user's wallet from the system treasury. Requires an Idempotency-Key header to prevent duplicate credits.
 *     tags: [Transactions]
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *         description: Unique key to ensure safe retries
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletId, systemWalletId, amount, referenceId]
 *             properties:
 *               walletId:       { type: string, format: uuid }
 *               systemWalletId: { type: string, format: uuid }
 *               amount:         { type: number, minimum: 0.000001 }
 *               referenceId:    { type: string, description: "External payment reference (e.g. Stripe charge ID)" }
 *               description:    { type: string }
 *               metadata:       { type: object }
 *     responses:
 *       201:
 *         description: Top-up completed
 *       409:
 *         description: Idempotency conflict or insufficient system funds
 *       422:
 *         description: Validation error or insufficient funds
 */
router.post('/topup',  mutationLimiter, idempotency, validateBody(topupSchema), txnController.topup);

/**
 * @swagger
 * /transactions/bonus:
 *   post:
 *     summary: Issue bonus/incentive credits
 *     description: Issues free credits from a bonus-pool wallet to a user (e.g. referral reward).
 *     tags: [Transactions]
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletId, systemWalletId, amount, reason]
 *             properties:
 *               walletId:       { type: string, format: uuid }
 *               systemWalletId: { type: string, format: uuid }
 *               amount:         { type: number, minimum: 0.000001 }
 *               reason:         { type: string }
 *               metadata:       { type: object }
 *     responses:
 *       201:
 *         description: Bonus issued
 *       422:
 *         description: Validation error or insufficient pool funds
 */
router.post('/bonus', mutationLimiter, idempotency, validateBody(bonusSchema), txnController.bonus);

/**
 * @swagger
 * /transactions/spend:
 *   post:
 *     summary: Spend credits (purchase a service)
 *     description: Debits a user's wallet and credits the system revenue wallet. Fails with 422 if balance is insufficient.
 *     tags: [Transactions]
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletId, systemWalletId, amount, serviceId]
 *             properties:
 *               walletId:       { type: string, format: uuid }
 *               systemWalletId: { type: string, format: uuid }
 *               amount:         { type: number, minimum: 0.000001 }
 *               serviceId:      { type: string }
 *               description:    { type: string }
 *               metadata:       { type: object }
 *     responses:
 *       201:
 *         description: Spend completed
 *       422:
 *         description: Insufficient funds or validation error
 */
router.post('/spend', mutationLimiter, idempotency, validateBody(spendSchema), txnController.spend);

/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     summary: Get transaction details
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Transaction with ledger entries
 *       404:
 *         description: Transaction not found
 */
router.get('/:id', validateParams(uuidParam), txnController.getTransaction);

export default router;
