# Wallet Ledger Service

A production-ready **internal wallet service** built with **Node.js + Express + PostgreSQL**.

Tracks virtual currency balances (Gold Coins, Diamonds, Loyalty Points) for a high-traffic gaming/loyalty platform using **double-entry bookkeeping**, **ACID transactions**, and full **concurrency safety**.

---

## Technology Choices & Why

| Tech | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 LTS | Non-blocking I/O, excellent for high-concurrency API workloads |
| Framework | Express 5 | Minimal, battle-tested, full control over the request pipeline |
| Language | JavaScript (ES2022 ESM) | No build step, maximum transparency |
| Database | PostgreSQL 16 | ACID guarantees, row-level locking (`SELECT ... FOR UPDATE`), advisory locks |
| DB Client | `pg` (node-postgres) | Direct driver, zero ORM magic — every SQL statement is explicit |
| Migrations | Raw SQL files + custom runner | You see exactly what SQL runs; no framework abstraction |
| Validation | Joi | Mature, excellent error messages |
| Docs | Swagger UI | Auto-generated, interactive API docs |
| Testing | Jest + Supertest | Integration tests against a real PostgreSQL instance |

---

## Concurrency Strategy

### Race Conditions → `SELECT ... FOR UPDATE`

Every balance mutation runs inside a PostgreSQL transaction with an explicit row-level lock:

```sql
SELECT * FROM wallets WHERE id IN ($1, $2) ORDER BY id FOR UPDATE
```

This ensures only one transaction at a time can modify a wallet's balance.

### Deadlock Avoidance → Consistent Lock Ordering

When a transaction involves two wallets (e.g., debit treasury + credit user), locks are **always acquired in ascending UUID order**. This eliminates circular-wait conditions, making deadlocks impossible regardless of request order.

```js
// src/services/transaction.service.js
const [firstId, secondId] = a < b ? [a, b] : [b, a];
// Always lock firstId before secondId
```

### Idempotency → `Idempotency-Key` Header + DB Table

All mutation endpoints accept an `Idempotency-Key` header. The response is stored in the `idempotency_keys` table and returned as-is on replay, with no new transaction created. Safe for client retries after network failures.

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
# Clone and start everything (PostgreSQL + app + migrations + seed)
git clone <repo-url>
cd wallet-ledger
docker-compose down -v
docker-compose up --build
```

The app will be available at `http://localhost:3000`.

### Option B — Local Development

**Prerequisites**: Node.js 20+, PostgreSQL 16

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# 3. Create database
psql -U postgres -c "CREATE DATABASE wallet_ledger"

# 4. Run migrations
npm run migrate

# 5. Seed initial data
npm run seed

# 6. Start the server
npm run dev
```

**Alternative seed (raw SQL)**:
```bash
psql -U postgres -d wallet_ledger -f seed.sql
```

---

## API Endpoints

**Base URL**: `http://localhost:3000/api/v1`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check (DB ping) |
| `GET` | `/asset-types` | List virtual currency types |
| `GET` | `/wallets` | List all wallets |
| `GET` | `/wallets/:id` | Get wallet details |
| `GET` | `/wallets/:id/balance` | Get current balance |
| `GET` | `/wallets/:id/transactions` | Paginated ledger history |
| `POST` | `/transactions/topup` | Top-up (purchase credits) |
| `POST` | `/transactions/bonus` | Issue free credits (referral, etc.) |
| `POST` | `/transactions/spend` | Spend credits on a service |
| `GET` | `/transactions/:id` | Get transaction details |

**Interactive Docs**: `http://localhost:3000/docs`

---

## Example API Calls

> Use the wallet IDs printed by `npm run seed`. Replace IDs as needed.

### 1. Top-up (User buys Gold Coins)
```bash
curl -X POST http://localhost:3000/api/v1/transactions/topup \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-$(date +%s)" \
  -d '{
    "walletId":       "dddddddd-0000-0000-0000-000000000001",
    "systemWalletId": "cccccccc-0000-0000-0000-000000000001",
    "amount":         100,
    "referenceId":    "stripe-charge-abc123"
  }'
```

### 2. Bonus (Issue referral reward)
```bash
curl -X POST http://localhost:3000/api/v1/transactions/bonus \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bonus-ref-$(date +%s)" \
  -d '{
    "walletId":       "dddddddd-0000-0000-0000-000000000001",
    "systemWalletId": "cccccccc-0000-0000-0000-000000000005",
    "amount":         50,
    "reason":         "referral"
  }'
```

### 3. Spend (User buys an in-game item)
```bash
curl -X POST http://localhost:3000/api/v1/transactions/spend \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: spend-$(date +%s)" \
  -d '{
    "walletId":       "dddddddd-0000-0000-0000-000000000001",
    "systemWalletId": "cccccccc-0000-0000-0000-000000000004",
    "amount":         30,
    "serviceId":      "item-iron-sword-001"
  }'
```

### 4. Check balance
```bash
curl http://localhost:3000/api/v1/wallets/dddddddd-0000-0000-0000-000000000001/balance
```

---

## Running Tests

Requires a running PostgreSQL instance and a test database:

```bash
# Create test database
psql -U postgres -c "CREATE DATABASE wallet_ledger_test"

# Set test env
export DB_NAME=wallet_ledger_test

# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

---

## Seed Reference IDs

| Entity | Name | ID |
|---|---|---|
| Asset Type | Gold Coins | `11111111-0000-0000-0000-000000000001` |
| Asset Type | Diamonds | `11111111-0000-0000-0000-000000000002` |
| Asset Type | Loyalty Points | `11111111-0000-0000-0000-000000000003` |
| System Wallet | Treasury GC | `cccccccc-0000-0000-0000-000000000001` |
| System Wallet | Revenue GC | `cccccccc-0000-0000-0000-000000000004` |
| System Wallet | Bonus Pool GC | `cccccccc-0000-0000-0000-000000000005` |
| User Wallet | Alice — Gold Coins | `dddddddd-0000-0000-0000-000000000001` |
| User Wallet | Bob — Gold Coins | `dddddddd-0000-0000-0000-000000000004` |
| User (Alice) | — | `bbbbbbbb-0000-0000-0000-000000000001` |
| User (Bob) | — | `bbbbbbbb-0000-0000-0000-000000000002` |

---

## Architecture

```
src/
├── config/        # DB pool (pg), Winston logger, Joi env validation
├── db/
│   ├── migrations/  # Raw SQL files — 001..005
│   ├── migrate.js   # Migration runner (tracks applied files)
│   └── seed.js      # Programmatic seeder
├── middleware/    # errorHandler, idempotency, rateLimiter, requestId, validate
├── routes/        # wallet.routes.js, transaction.routes.js, index.js
├── controllers/   # Thin HTTP layer
├── services/
│   ├── wallet.service.js      # Read-only balance/history queries
│   └── transaction.service.js # All 3 flows with locking, double-entry
├── errors/        # AppError hierarchy
├── app.js         # Express setup (Swagger, middleware, routes)
└── server.js      # HTTP server + graceful shutdown
```

## Double-Entry Bookkeeping

Every transaction produces exactly **2 ledger entries** — one debit and one credit. This keeps the ledger mathematically balanced and provides a complete audit trail with `balance_before` / `balance_after` snapshots per entry.

```
Top-up example:
  Treasury wallet  → DEBIT  $100  (balance: 10000 → 9900)
  User wallet      → CREDIT $100  (balance: 500   → 600)
```
