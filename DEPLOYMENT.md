# Deployment Guide — Docker

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed (included with Docker Desktop)

---

## Quick Start (One Command)

```bash
docker-compose up --build
```

This single command:
1. Pulls PostgreSQL 16 Alpine image
2. Builds the Node.js app image
3. Starts PostgreSQL with a health check
4. Waits for DB to be healthy
5. Runs all SQL migrations
6. Seeds initial data (asset types, system wallets, user wallets)
7. Starts the API server on port **3000**

**API URL**: `http://localhost:3000`  
**Swagger Docs**: `http://localhost:3000/docs`  
**Health Check**: `http://localhost:3000/health`

---

## Step-by-Step Breakdown

### 1. Clone and navigate

```bash
git clone <repo-url>
cd wallet-ledger
```

### 2. Build and start in detached mode

```bash
docker-compose up --build -d
```

The `-d` flag runs containers in the background.

### 3. Verify containers are running

```bash
docker-compose ps
```

Expected output:

```
NAME                  STATUS
wallet-ledger-db      Up (healthy)
wallet-ledger-app     Up
```

### 4. Check the logs

```bash
# All services
docker-compose logs -f

# App only
docker-compose logs -f app

# Database only
docker-compose logs -f postgres
```

### 5. Verify the API is live

```bash
curl http://localhost:3000/health
```

Expected:

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-02-22T10:00:00.000Z",
  "uptime": 5.123
}
```

---

## Environment Configuration

The `docker-compose.yml` sets all required env vars for you. To override any value, edit the `environment` section under the `app` service:

```yaml
app:
  environment:
    NODE_ENV: production
    PORT: 3000
    DB_HOST: postgres        # Docker service name (not localhost)
    DB_PORT: 5432
    DB_NAME: wallet_ledger
    DB_USER: postgres
    DB_PASSWORD: postgres    # Change in production!
    DB_POOL_MIN: 2
    DB_POOL_MAX: 10
    LOG_LEVEL: info
```

> **Important**: `DB_HOST` must be the Docker service name (`postgres`), not `localhost`.

---

## Common Operations

### Stop all services
```bash
docker-compose down
```

### Stop and remove all data (clean slate)
```bash
docker-compose down -v
```

The `-v` flag removes the PostgreSQL volume, wiping all data.

### Rebuild after code changes
```bash
docker-compose up --build -d
```

### Run migrations manually
```bash
docker exec -it wallet-ledger-app node src/db/migrate.js
```

### Re-seed the database
```bash
docker exec -it wallet-ledger-app node src/db/seed.js
```

### Access the PostgreSQL shell
```bash
docker exec -it wallet-ledger-db psql -U postgres -d wallet_ledger
```

### View all wallets directly in SQL
```bash
docker exec -it wallet-ledger-db psql -U postgres -d wallet_ledger \
  -c "SELECT id, name, owner_type, balance FROM wallets ORDER BY owner_type, name;"
```

---

## Production Checklist

Before deploying to production, make these changes:

| Item | What to change |
|---|---|
| **DB Password** | Change `POSTGRES_PASSWORD` and `DB_PASSWORD` to a strong secret |
| **Rate Limiting** | Adjust `RATE_LIMIT_MAX_REQUESTS` based on expected traffic |
| **Logging** | Set `LOG_LEVEL=warn` to reduce noise |
| **Volumes** | Ensure `postgres_data` volume is on a persistent disk with backups |
| **Port** | Consider removing the `ports` mapping on PostgreSQL (only expose via internal Docker network) |
| **Health Check** | Add a health check to the `app` service for container orchestration |

### Example production `docker-compose.override.yml`

```yaml
version: '3.9'

services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: []  # Don't expose PostgreSQL externally

  app:
    environment:
      DB_PASSWORD: ${DB_PASSWORD}
      NODE_ENV: production
      LOG_LEVEL: warn
    restart: always
```

Then run with:

```bash
DB_PASSWORD=your-strong-secret docker-compose up --build -d
```

---

## Architecture in Docker

```
┌────────────────────────────────────────────┐
│              Docker Network                │
│                                            │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │  PostgreSQL   │    │   Node.js App    │  │
│  │  Port: 5432   │◄───│   Port: 3000     │  │
│  │  (internal)   │    │   (exposed)      │  │
│  │               │    │                  │  │
│  │  Volume:      │    │  Runs:           │  │
│  │  postgres_data│    │  1. migrate.js   │  │
│  └──────────────┘    │  2. seed.js      │  │
│                       │  3. server.js    │  │
│                       └──────────────────┘  │
│                              │              │
└──────────────────────────────┼──────────────┘
                               │
                         localhost:3000
                          (your machine)
```
