import 'dotenv/config';
import app from './app.js';
import env from './config/env.js';
import { closePool, ping } from './config/db.js';
import logger from './config/logger.js';

const server = app.listen(env.PORT, async () => {
  try {
    await ping();
    logger.info(`🚀 Wallet Ledger API running`, {
      port: env.PORT,
      env: env.NODE_ENV,
      docs: `http://localhost:${env.PORT}/docs`,
    });
  } catch (err) {
    logger.error('❌ Failed to connect to database on startup', { error: err.message });
    process.exit(1);
  }
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed');
    await closePool();
    logger.info('DB pool closed');
    process.exit(0);
  });

  // Force kill after 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Unhandled promise rejections — log and exit cleanly
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: String(reason) });
  process.exit(1);
});

export default server;
