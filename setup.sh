#!/bin/bash
# =============================================================================
# setup.sh — Wallet Ledger Service
#
# One-script setup: creates the database, runs migrations, and seeds data.
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# Prerequisites:
#   - PostgreSQL running on localhost:5432 (or set DB_* env vars)
#   - Node.js 20+ installed
# =============================================================================

set -e

echo ""
echo "============================================"
echo "  Wallet Ledger Service — Setup"
echo "============================================"
echo ""

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# 2. Copy .env if not exists
if [ ! -f .env ]; then
  echo "📄 Creating .env from .env.example..."
  cp .env.example .env
  echo "   ⚠  Edit .env if your PostgreSQL credentials differ from defaults"
  echo ""
fi

# 3. Create the database (ignore error if it already exists)
echo "🗄️  Creating database..."
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-wallet_ledger}"

createdb -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" "$DB_NAME" 2>/dev/null && \
  echo "   ✔ Database '$DB_NAME' created" || \
  echo "   ✔ Database '$DB_NAME' already exists"
echo ""

# 4. Run SQL migrations
echo "🔧 Running migrations..."
npm run migrate
echo ""

# 5. Seed initial data
echo "🌱 Seeding database..."
npm run seed
echo ""

# 6. Done
echo "============================================"
echo "  ✅ Setup complete!"
echo ""
echo "  Start the server:  npm run dev"
echo "  Swagger docs:      http://localhost:3000/docs"
echo "  Health check:      http://localhost:3000/health"
echo "============================================"
echo ""
