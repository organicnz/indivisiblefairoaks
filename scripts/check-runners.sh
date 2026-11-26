#!/usr/bin/env bash
# =============================================================================
# Runner health check — run from your Mac to inspect the current pool hosts
# =============================================================================
# Usage: bash scripts/check-runners.sh
# =============================================================================
set -euo pipefail

BACKEND_IP="100.92.38.119"
FRONTEND_IP="100.111.249.64" # ghrunner-1
HEALTH_PORT=9100

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  GitHub Actions Runner Health Check"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── GitHub API — registered runners ──────────────────────────────────────────
echo "▸ Registered runners (GitHub API):"
TOTAL=$(gh api repos/organicnz/indivisiblefairoaks/actions/runners \
  --jq '.total_count' 2>/dev/null || true)
if [[ -z "$TOTAL" ]]; then
  echo "  (GitHub API error)"
elif [[ "$TOTAL" == "0" ]]; then
  echo "  0 registered — expected while every ephemeral pool slot is idle."
  echo "  A queued self-hosted job starts a runner on demand; check the pool host timers if it stays 0 under load."
else
  gh api repos/organicnz/indivisiblefairoaks/actions/runners \
    --jq '.runners[] | "  \(.name)  status=\(.status)  labels=[\(.labels | map(.name) | join(","))]"' \
    2>/dev/null || echo "  (runner list unavailable)"
fi
echo ""

# ── VPS health endpoints ──────────────────────────────────────────────────────
for entry in "backend:$BACKEND_IP" "ghrunner-1:$FRONTEND_IP"; do
  NAME="${entry%%:*}"
  IP="${entry##*:}"
  echo "▸ ${NAME}  ($IP:$HEALTH_PORT):"
  RESPONSE=$(curl -sf --max-time 5 "http://${IP}:${HEALTH_PORT}" 2>/dev/null || echo "UNREACHABLE")
  echo "  $RESPONSE"
  echo ""
done

# ── Queued jobs ───────────────────────────────────────────────────────────────
echo "▸ Recent CI runs:"
gh run list --repo organicnz/indivisiblefairoaks --limit 5 \
  --json status,conclusion,name,createdAt,headBranch \
  --jq '.[] | "  [\(.status)/\(.conclusion // "pending")] \(.name) @ \(.headBranch) \(.createdAt)"' \
  2>/dev/null || echo "  (gh CLI error)"
echo ""
