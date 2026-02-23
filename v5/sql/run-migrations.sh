#!/bin/bash
# run-migrations.sh — Execute SQL migrations in order
# Usage: ./sql/run-migrations.sh [--docker | --host]
# Default: --docker (uses docker compose exec)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:---docker}"
ERRORS=0

run_sql() {
  local file="$1"
  echo "Running: $(basename "$file")"
  if [ "$MODE" = "--docker" ]; then
    docker compose exec -T postgres psql -U dev -d dev_ai_influencer \
      -v ON_ERROR_STOP=0 -f "/dev/stdin" < "$file"
  else
    PGPASSWORD="${PGPASSWORD:-dev}" psql -h "${PGHOST:-localhost}" -p "${PGPORT:-5433}" \
      -U "${PGUSER:-dev}" -d "${PGDATABASE:-dev_ai_influencer}" \
      -v ON_ERROR_STOP=0 -f "$file"
  fi
  local rc=$?
  if [ $rc -ne 0 ]; then
    echo "WARNING: $(basename "$file") exited with code $rc"
    ERRORS=$((ERRORS + 1))
  fi
}

echo "=== Running migrations (mode: $MODE) ==="

# Run files in sorted order
for f in "$SCRIPT_DIR"/[0-9]*.sql; do
  if [ -f "$f" ]; then
    run_sql "$f"
  fi
done

echo "=== Migrations complete (warnings: $ERRORS) ==="
