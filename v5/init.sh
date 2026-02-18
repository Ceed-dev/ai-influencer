#!/bin/bash
# v5.0 Development Environment Setup
# Idempotent — safe to run multiple times
# Usage: ./init.sh [--check-only]
#
# Spec: docs/v5-specification/01-tech-stack.md, 02-architecture.md Section 15-16
set -euo pipefail

CHECK_ONLY=false
if [[ "${1:-}" == "--check-only" ]]; then
  CHECK_ONLY=true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[OK]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "     $1"; }

ERRORS=0

echo "================================================"
echo "  v5.0 Development Environment Setup"
echo "  Mode: $([ "$CHECK_ONLY" = true ] && echo 'CHECK ONLY' || echo 'SETUP')"
echo "================================================"
echo ""

# ------------------------------------------------------------------
# 1. Check prerequisites
# ------------------------------------------------------------------
echo "--- Prerequisites ---"

# Docker
if command -v docker &>/dev/null; then
  DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
  pass "Docker installed (v${DOCKER_VERSION})"
else
  fail "Docker not found. Install: https://docs.docker.com/get-docker/"
fi

# Docker Compose (v2 plugin)
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
  pass "Docker Compose installed (v${COMPOSE_VERSION})"
else
  fail "Docker Compose not found. Install docker-compose-plugin."
fi

# Node.js 20+
if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version | tr -d 'v')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [[ "$NODE_MAJOR" -ge 20 ]]; then
    pass "Node.js installed (v${NODE_VERSION})"
  else
    fail "Node.js 20+ required (found v${NODE_VERSION})"
  fi
else
  fail "Node.js not found. Install Node.js 20 LTS."
fi

# npm
if command -v npm &>/dev/null; then
  NPM_VERSION=$(npm --version)
  pass "npm installed (v${NPM_VERSION})"
else
  fail "npm not found."
fi

echo ""

if [[ $ERRORS -gt 0 && "$CHECK_ONLY" == true ]]; then
  echo -e "${RED}Prerequisite checks failed ($ERRORS errors). Fix before running setup.${NC}"
  exit 1
fi

if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}Prerequisites missing ($ERRORS errors). Cannot continue.${NC}"
  exit 1
fi

# ------------------------------------------------------------------
# 2. Docker Compose up (if not running)
# ------------------------------------------------------------------
echo "--- Docker Services ---"

if [[ "$CHECK_ONLY" == true ]]; then
  if docker compose ps --status running 2>/dev/null | grep -q "v5-postgres"; then
    pass "Postgres container running"
  else
    warn "Postgres container not running"
  fi
else
  if docker compose ps --status running 2>/dev/null | grep -q "v5-postgres"; then
    pass "Docker services already running"
  else
    info "Starting Docker services..."
    docker compose up -d postgres pgbouncer
    pass "Docker services started"
  fi
fi

echo ""

# ------------------------------------------------------------------
# 3. Wait for postgres healthy
# ------------------------------------------------------------------
echo "--- Database Health ---"

if [[ "$CHECK_ONLY" == false ]]; then
  info "Waiting for PostgreSQL to be healthy..."
  RETRIES=30
  until docker compose exec -T postgres pg_isready -U dev -d dev_ai_influencer &>/dev/null || [[ $RETRIES -eq 0 ]]; do
    RETRIES=$((RETRIES - 1))
    sleep 1
  done

  if [[ $RETRIES -gt 0 ]]; then
    pass "PostgreSQL is healthy"
  else
    fail "PostgreSQL failed to become healthy"
  fi
else
  if docker compose exec -T postgres pg_isready -U dev -d dev_ai_influencer &>/dev/null 2>&1; then
    pass "PostgreSQL is healthy"
  else
    warn "PostgreSQL is not reachable"
  fi
fi

# ------------------------------------------------------------------
# 4. Apply DDL (if tables don't exist)
# ------------------------------------------------------------------
echo ""
echo "--- Schema ---"

TABLE_COUNT=$(docker compose exec -T postgres psql -U dev -d dev_ai_influencer -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")

if [[ "$TABLE_COUNT" -gt 0 ]]; then
  pass "Database has ${TABLE_COUNT} tables"
else
  if [[ -f "schema.sql" ]]; then
    if [[ "$CHECK_ONLY" == true ]]; then
      warn "No tables found. Run without --check-only to apply schema.sql"
    else
      info "Applying schema.sql..."
      docker compose exec -T postgres psql -U dev -d dev_ai_influencer < schema.sql
      pass "Schema applied"
    fi
  else
    warn "No tables and no schema.sql found. Create schema.sql or run migrations."
  fi
fi

# Check pgvector extension
PGVECTOR=$(docker compose exec -T postgres psql -U dev -d dev_ai_influencer -tAc \
  "SELECT 1 FROM pg_extension WHERE extname = 'vector';" 2>/dev/null || echo "")

if [[ "$PGVECTOR" == "1" ]]; then
  pass "pgvector extension enabled"
else
  if [[ "$CHECK_ONLY" == true ]]; then
    warn "pgvector extension not enabled"
  else
    info "Enabling pgvector extension..."
    docker compose exec -T postgres psql -U dev -d dev_ai_influencer -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null
    pass "pgvector extension enabled"
  fi
fi

echo ""

# ------------------------------------------------------------------
# 5. npm install (if node_modules stale)
# ------------------------------------------------------------------
echo "--- Dependencies ---"

if [[ -d "node_modules" ]]; then
  if [[ "package.json" -nt "node_modules/.package-lock.json" ]] 2>/dev/null; then
    if [[ "$CHECK_ONLY" == true ]]; then
      warn "node_modules may be stale (package.json is newer)"
    else
      info "package.json changed. Running npm install..."
      npm install
      pass "Dependencies installed"
    fi
  else
    pass "Dependencies up to date"
  fi
else
  if [[ "$CHECK_ONLY" == true ]]; then
    warn "node_modules not found. Run without --check-only to install."
  else
    info "Installing dependencies..."
    npm install
    pass "Dependencies installed"
  fi
fi

echo ""

# ------------------------------------------------------------------
# 6. TypeScript compile check
# ------------------------------------------------------------------
echo "--- TypeScript ---"

if [[ -f "tsconfig.json" ]]; then
  if npx tsc --noEmit 2>/dev/null; then
    pass "TypeScript compilation check passed"
  else
    warn "TypeScript compilation has errors (run 'npx tsc --noEmit' for details)"
  fi
else
  warn "tsconfig.json not found"
fi

echo ""

# ------------------------------------------------------------------
# 7. Health check summary
# ------------------------------------------------------------------
echo "--- Connection Tests ---"

# DB connection via pgbouncer
if docker compose exec -T postgres psql -U dev -d dev_ai_influencer -c "SELECT 1;" &>/dev/null 2>&1; then
  pass "Database connection OK"
else
  warn "Database connection failed"
fi

# pgvector test
if docker compose exec -T postgres psql -U dev -d dev_ai_influencer -tAc \
  "SELECT '[1,2,3]'::vector;" &>/dev/null 2>&1; then
  pass "pgvector working"
else
  warn "pgvector not working"
fi

echo ""

# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------
echo "================================================"
if [[ $ERRORS -eq 0 ]]; then
  echo -e "  ${GREEN}Environment ready!${NC}"
  echo ""
  echo "  Next steps:"
  echo "    docker compose up -d    # Start all services"
  echo "    npm run dev             # Start app in dev mode"
  echo "    npm run typecheck       # TypeScript check"
  echo "    npm test                # Run tests"
else
  echo -e "  ${RED}Setup completed with $ERRORS error(s)${NC}"
  echo "  Fix the issues above and re-run this script."
fi
echo "================================================"

exit $ERRORS
