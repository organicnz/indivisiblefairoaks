#!/usr/bin/env bash
# =============================================================================
# Runner health check — run from your Mac to see the status of both VPS runners
# =============================================================================
# Usage: bash scripts/check-runners.sh
# =============================================================================
set -euo pipefail

BACKEND_IP="100.92.38.119"
FRONTEND_IP="100.99.241.23"
HEALTH_PORT=9100

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  GitHub Actions Runner Health Check"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── GitHub API — registered runners ──────────────────────────────────────────
echo "▸ Registered runners (GitHub API):"
gh api repos/organicnz/indivisiblefairoaks/actions/runners \
  --jq '.runners[] | "  \(.name)  status=\(.status)  labels=[\(.labels | map(.name) | join(","))]"' \
  2>/dev/null || echo "  (none registered or API error)"
echo ""

# ── VPS health endpoints ──────────────────────────────────────────────────────
for entry in "backend:$BACKEND_IP" "frontend:$FRONTEND_IP"; do
  NAME="${entry%%:*}"
  IP="${entry##*:}"
  echo "▸ ${NAME}-runner  ($IP:$HEALTH_PORT):"
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
