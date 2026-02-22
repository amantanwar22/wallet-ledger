import * as walletService from '../services/wallet.service.js';

/**
 * GET /api/v1/wallets
 */
export async function listWallets(req, res, next) {
  try {
    const { ownerType, page, limit } = req.query;
    const result = await walletService.listWallets({
      ownerType,
      page: page ? parseInt(page) : 1,
      limit: limit ? Math.min(parseInt(limit), 100) : 20,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/wallets/:id
 */
export async function getWallet(req, res, next) {
  try {
    const wallet = await walletService.getWalletById(req.params.id);
    res.json({ success: true, data: wallet });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/wallets/:id/balance
 */
export async function getBalance(req, res, next) {
  try {
    const wallet = await walletService.getWalletById(req.params.id);
    res.json({
      success: true,
      data: {
        walletId: wallet.id,
        balance: wallet.balance,
        assetType: wallet.assetType,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/wallets/:id/transactions
 */
export async function getWalletTransactions(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await walletService.getWalletTransactions(req.params.id, {
      page: page ? parseInt(page) : 1,
      limit: limit ? Math.min(parseInt(limit), 100) : 20,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/asset-types
 */
export async function listAssetTypes(req, res, next) {
  try {
    const data = await walletService.listAssetTypes();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
