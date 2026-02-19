#!/usr/bin/env bash
# v5 Daily Monitoring Report
# Runs daily via cron. Outputs to terminal + v5/logs/daily-report-YYYY-MM-DD.txt
# Then auto-commits and pushes the log file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
V5_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$V5_DIR/.." && pwd)"
TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d)
LOG_FILE="$V5_DIR/logs/daily-report-${TODAY}.txt"
FEATURE_LIST="$V5_DIR/feature_list.json"
PROGRESS_FILE="$V5_DIR/progress.txt"

# ============================================================
# Helper functions
# ============================================================

section() {
  echo ""
  echo "--- $1 ---"
  echo ""
}

warn() {
  echo "  [WARN] $1"
}

info() {
  echo "  $1"
}

count_json_field() {
  # $1=jq filter, $2=file
  if [ -f "$2" ]; then
    node -e "
      const d = require('$2');
      const r = d.features.filter(f => $1);
      console.log(r.length);
    " 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# ============================================================
# Generate report (captured by tee)
# ============================================================

generate_report() {

echo "=========================================="
echo " Daily Report $TODAY"
echo "=========================================="

# ----------------------------------------------------------
# 1. Progress Summary
# ----------------------------------------------------------
section "1. Progress Summary"

if [ -f "$FEATURE_LIST" ]; then
  node -e "
    const fl = require('$FEATURE_LIST');
    const passed = fl.features.filter(f => f.passes).length;
    const total = fl.features.length;
    const pct = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    console.log('  Overall: ' + passed + ' / ' + total + ' features passed (' + pct + '%)');
    console.log('');

    // By category
    console.log('  By category:');
    const cats = {};
    fl.features.forEach(f => {
      if (!cats[f.category]) cats[f.category] = { total: 0, passed: 0 };
      cats[f.category].total++;
      if (f.passes) cats[f.category].passed++;
    });
    Object.keys(cats).sort().forEach(c => {
      const { total, passed } = cats[c];
      const p = total > 0 ? ((passed / total) * 100).toFixed(0) : '0';
      const bar = '#'.repeat(Math.round(passed / total * 20)) + '.'.repeat(20 - Math.round(passed / total * 20));
      console.log('    ' + c.padEnd(18) + ' [' + bar + '] ' + String(passed).padStart(3) + '/' + String(total).padStart(3) + ' (' + p + '%)');
    });
    console.log('');

    // By agent
    console.log('  By agent:');
    const agents = {};
    fl.features.forEach(f => {
      if (!agents[f.agent]) agents[f.agent] = { total: 0, passed: 0 };
      agents[f.agent].total++;
      if (f.passes) agents[f.agent].passed++;
    });
    Object.keys(agents).sort().forEach(a => {
      const { total, passed } = agents[a];
      const p = total > 0 ? ((passed / total) * 100).toFixed(0) : '0';
      console.log('    ' + a.padEnd(22) + String(passed).padStart(3) + '/' + String(total).padStart(3) + ' (' + p + '%)');
    });
  "
else
  warn "feature_list.json not found — skipping progress summary"
fi

# ----------------------------------------------------------
# 2. Recent Activity
# ----------------------------------------------------------
section "2. Recent Activity"

if [ -f "$PROGRESS_FILE" ]; then
  info "Latest 30 lines from progress.txt:"
  echo ""
  tail -30 "$PROGRESS_FILE" | sed 's/^/    /'
  echo ""

  # Blockers
  BLOCKERS=$(grep -i "BLOCK\|STUCK\|WAITING" "$PROGRESS_FILE" 2>/dev/null | tail -10 || true)
  if [ -n "$BLOCKERS" ]; then
    info "Blockers detected:"
    echo "$BLOCKERS" | sed 's/^/    /'
  else
    info "No blockers detected"
  fi
  echo ""

  # Today's COMPLETE count
  COMPLETE_TODAY=$(grep -c "$TODAY.*COMPLETE\|COMPLETE.*$TODAY" "$PROGRESS_FILE" 2>/dev/null || echo "0")
  info "Features completed today: $COMPLETE_TODAY"
else
  warn "progress.txt not found — skipping activity summary (expected before implementation starts)"
fi

# ----------------------------------------------------------
# 3. Anti-pattern Detection
# ----------------------------------------------------------
section "3. Anti-pattern Detection"

AP_COUNT=0

# AP1: One-shotting — single commit with multiple FEAT in message
info "AP1: One-shotting (multiple FEATs in single commit)"
AP1_HITS=$(git -C "$PROJECT_DIR" log --since="$YESTERDAY" --oneline 2>/dev/null \
  | grep -iE "FEAT-" \
  | while IFS= read -r line; do
      cnt=$(echo "$line" | grep -oiE "FEAT-[A-Z]+-[0-9]+" | sort -u | wc -l)
      if [ "$cnt" -gt 1 ]; then echo "$line"; fi
    done || true)
if [ -n "$AP1_HITS" ]; then
  warn "Found commits bundling multiple features:"
  echo "$AP1_HITS" | sed 's/^/    /'
  AP_COUNT=$((AP_COUNT + 1))
else
  info "  None detected"
fi
echo ""

# AP4: E2E Skip — COMPLETE without SMOKE in between
info "AP4: E2E Skip (COMPLETE without prior SMOKE)"
if [ -f "$PROGRESS_FILE" ]; then
  AP4_HITS=$(awk '
    /START/ { feat=$0; smoke=0 }
    /SMOKE/ { smoke=1 }
    /COMPLETE/ { if (!smoke && feat) print "  " $0; feat=""; smoke=0 }
  ' "$PROGRESS_FILE" 2>/dev/null || true)
  if [ -n "$AP4_HITS" ]; then
    warn "Features completed without smoke test:"
    echo "$AP4_HITS" | sed 's/^/    /'
    AP_COUNT=$((AP_COUNT + 1))
  else
    info "  None detected"
  fi
else
  info "  (progress.txt not found — skipped)"
fi
echo ""

# AP9: Config Hardcoding — magic numbers/strings in src (not in system_settings)
info "AP9: Config Hardcoding (hardcoded values in src/)"
if [ -d "$V5_DIR/src" ]; then
  AP9_HITS=$(grep -rnE "(localhost:[0-9]+|127\.0\.0\.1|hardcode|TODO.*config)" "$V5_DIR/src/" 2>/dev/null \
    | grep -v node_modules | grep -v ".test." | head -10 || true)
  if [ -n "$AP9_HITS" ]; then
    warn "Potential hardcoded config found:"
    echo "$AP9_HITS" | sed 's/^/    /'
    AP_COUNT=$((AP_COUNT + 1))
  else
    info "  None detected"
  fi
else
  info "  (src/ directory not found — skipped)"
fi
echo ""

# AP10: Type Bypass — usage of 'any' type in TypeScript
info "AP10: Type Bypass (any type usage)"
if [ -d "$V5_DIR/src" ]; then
  AP10_COUNT=$(grep -rnE ": any\b|as any\b|<any>" "$V5_DIR/src/" 2>/dev/null \
    | grep -v node_modules | grep -v ".test." | wc -l || echo "0")
  if [ "$AP10_COUNT" -gt 0 ]; then
    warn "Found $AP10_COUNT instances of 'any' type:"
    grep -rnE ": any\b|as any\b|<any>" "$V5_DIR/src/" 2>/dev/null \
      | grep -v node_modules | grep -v ".test." | head -10 | sed 's/^/    /'
    AP_COUNT=$((AP_COUNT + 1))
  else
    info "  None detected"
  fi
else
  info "  (src/ directory not found — skipped)"
fi
echo ""

info "Anti-pattern total: $AP_COUNT issue(s) found"

# ----------------------------------------------------------
# 4. Git Statistics
# ----------------------------------------------------------
section "4. Git Statistics"

COMMIT_COUNT=$(git -C "$PROJECT_DIR" log --since="$YESTERDAY" --oneline 2>/dev/null | wc -l || echo "0")
info "Commits since $YESTERDAY: $COMMIT_COUNT"
echo ""

if [ "$COMMIT_COUNT" -gt 0 ]; then
  info "By author:"
  git -C "$PROJECT_DIR" log --since="$YESTERDAY" --format="%an" 2>/dev/null \
    | sort | uniq -c | sort -rn | sed 's/^/    /'
  echo ""

  info "Recent commits:"
  git -C "$PROJECT_DIR" log --since="$YESTERDAY" --oneline 2>/dev/null \
    | head -20 | sed 's/^/    /'
fi

# ----------------------------------------------------------
# 5. Code Quality
# ----------------------------------------------------------
section "5. Code Quality"

# Lint errors (if eslint config exists)
if [ -f "$V5_DIR/package.json" ] && [ -d "$V5_DIR/node_modules/.bin" ]; then
  if [ -x "$V5_DIR/node_modules/.bin/eslint" ] && [ -d "$V5_DIR/src" ]; then
    LINT_COUNT=$("$V5_DIR/node_modules/.bin/eslint" "$V5_DIR/src/" --format compact 2>/dev/null | grep -c "Error\|Warning" || echo "0")
    info "Lint issues: $LINT_COUNT"
  else
    info "Lint: eslint not available or no src/ yet"
  fi
else
  info "Lint: node_modules not installed yet — skipped"
fi

# TypeScript errors
if [ -f "$V5_DIR/tsconfig.json" ] && [ -d "$V5_DIR/node_modules/.bin" ]; then
  if [ -x "$V5_DIR/node_modules/.bin/tsc" ]; then
    TSC_COUNT=$("$V5_DIR/node_modules/.bin/tsc" --noEmit --project "$V5_DIR/tsconfig.json" 2>&1 | grep -c "error TS" || echo "0")
    info "TypeScript errors: $TSC_COUNT"
  else
    info "TypeScript: tsc not available yet"
  fi
else
  info "TypeScript: not configured yet — skipped"
fi

# Test count
if [ -f "$V5_DIR/package.json" ] && [ -d "$V5_DIR/node_modules/.bin" ]; then
  info "Test suite: (run manually with 'npm test' in v5/)"
else
  info "Tests: node_modules not installed yet — skipped"
fi

# ----------------------------------------------------------
# 6. Environment Health Check
# ----------------------------------------------------------
section "6. Environment Health Check"

# Docker containers
if command -v docker &>/dev/null; then
  RUNNING=$(docker ps --filter "name=v5" --format "{{.Names}}: {{.Status}}" 2>/dev/null || true)
  if [ -n "$RUNNING" ]; then
    info "Docker containers:"
    echo "$RUNNING" | sed 's/^/    /'
  else
    info "Docker: no v5 containers running"
  fi
else
  info "Docker: not installed"
fi

# DB connection
if command -v psql &>/dev/null; then
  if psql -h localhost -U postgres -d ai_influencer_v5 -c "SELECT 1" &>/dev/null; then
    TABLE_COUNT=$(psql -h localhost -U postgres -d ai_influencer_v5 -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "?")
    info "Database: connected ($TABLE_COUNT tables)"
  else
    info "Database: not reachable (expected before infra setup)"
  fi
else
  info "Database: psql not installed"
fi

# Disk usage
DISK_USAGE=$(du -sh "$V5_DIR" 2>/dev/null | cut -f1 || echo "?")
info "v5/ disk usage: $DISK_USAGE"

DISK_FREE=$(df -h "$V5_DIR" 2>/dev/null | awk 'NR==2{print $4}' || echo "?")
info "Disk free: $DISK_FREE"

echo ""
echo "=========================================="
echo " End of Report"
echo "=========================================="

}

# ============================================================
# Main: generate, save, commit, push
# ============================================================

mkdir -p "$V5_DIR/logs"

# Generate report to both terminal and file
generate_report 2>&1 | tee "$LOG_FILE"

echo ""
echo "[log] Saved to $LOG_FILE"

# Auto-commit and push
cd "$PROJECT_DIR"
git add "v5/logs/daily-report-${TODAY}.txt"
git commit -m "daily-report: $TODAY

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" 2>/dev/null || echo "[log] Nothing new to commit"
git push 2>/dev/null || echo "[log] Push failed (will retry next run)"
