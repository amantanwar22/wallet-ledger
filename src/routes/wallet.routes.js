import { Router } from 'express';
import * as walletController from '../controllers/wallet.controller.js';
import { validateParams, uuidParam } from '../middleware/validate.js';

const router = Router();

/**
 * @swagger
 * /wallets:
 *   get:
 *     summary: List all wallets
 *     tags: [Wallets]
 *     parameters:
 *       - in: query
 *         name: ownerType
 *         schema: { type: string, enum: [user, system] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of wallets
 */
router.get('/', walletController.listWallets);

/**
 * @swagger
 * /wallets/{id}:
 *   get:
 *     summary: Get wallet by ID
 *     tags: [Wallets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Wallet details
 *       404:
 *         description: Wallet not found
 */
router.get('/:id', validateParams(uuidParam), walletController.getWallet);

/**
 * @swagger
 * /wallets/{id}/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Current balance with asset type info
 */
router.get('/:id/balance', validateParams(uuidParam), walletController.getBalance);

/**
 * @swagger
 * /wallets/{id}/transactions:
 *   get:
 *     summary: Get wallet ledger history
 *     tags: [Wallets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated ledger entries
 */
router.get('/:id/transactions', validateParams(uuidParam), walletController.getWalletTransactions);

export default router;
