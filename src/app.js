import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import requestId from './middleware/requestId.js';
import errorHandler from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import logger from './config/logger.js';
import env from './config/env.js';

import walletRoutes from './routes/wallet.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import systemRoutes from './routes/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const app = express();

// ─── Security & fundamental middleware ────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Observability ────────────────────────────────────────────────────────
app.use(requestId);
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.path === '/health',
  }),
);

// ─── Rate limiting ────────────────────────────────────────────────────────
app.use('/api', generalLimiter);

// ─── Swagger / OpenAPI docs ───────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Wallet Ledger API',
      version: pkg.version,
      description:
        'Internal wallet service with double-entry bookkeeping, concurrency safety, and idempotent transactions.',
      contact: { name: 'API Support' },
    },
    servers: [
      { url: `http://localhost:${env.PORT}/api/v1`, description: 'Local development' },
    ],
    tags: [
      { name: 'Wallets',      description: 'Wallet balance and ledger history' },
      { name: 'Transactions', description: 'Top-up, bonus, and spend flows' },
      { name: 'System',       description: 'Health check and reference data' },
    ],
  },
  apis: [join(__dirname, 'routes', '*.js')],
});

app.use('/docs', swaggerUi.serve);
app.get('/docs', swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get('/docs.json', (req, res) => res.json(swaggerSpec));

// ─── Routes ───────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const { ping } = await import('./config/db.js');
    await ping();
    res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
  } catch {
    res.status(503).json({ success: false, status: 'unhealthy' });
  }
});

app.use('/api/v1', systemRoutes);
app.use('/api/v1/wallets', walletRoutes);
app.use('/api/v1/transactions', transactionRoutes);

// Root redirect to docs
app.get('/', (req, res) => res.redirect('/docs'));

// ─── 404 handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    requestId: req.id,
  });
});

// ─── Global error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

export default app;
