import { Router } from 'express';
import { ping } from '../config/db.js';
import * as walletController from '../controllers/wallet.controller.js';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Database unreachable
 */
router.get('/health', async (req, res) => {
  try {
    await ping();
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @swagger
 * /asset-types:
 *   get:
 *     summary: List all asset types
 *     tags: [System]
 *     responses:
 *       200:
 *         description: List of active asset types
 */
router.get('/asset-types', walletController.listAssetTypes);

export default router;
