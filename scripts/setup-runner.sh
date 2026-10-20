#!/usr/bin/env bash
# =============================================================================
# GitHub Actions Self-Hosted Runner — Full Setup & Hardening
# =============================================================================
# Idempotent: safe to re-run. Handles install, reconfigure, and upgrade.
#
# Usage (run as the user who will own the runner — NOT root):
#
#   # Backend VPS (100.92.38.119):
#   bash setup-runner.sh \
#     --name     backend-runner \
#     --labels   "self-hosted,linux,ARM64,backend-runner" \
#     --token    <registration-token>
#
#   # Frontend VPS (100.99.241.23):
#   bash setup-runner.sh \
#     --name     frontend-runner \
#     --labels   "self-hosted,linux,ARM64,frontend-runner" \
#     --token    <registration-token>
#
# Get a fresh token (valid 1 hour) with:
#   gh api -X POST repos/organicnz/indivisiblefairoaks/actions/runners/registration-token --jq '.token'
# =============================================================================
set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/organicnz/indivisiblefairoaks"
RUNNER_VERSION="2.321.0"
RUNNER_DIR="$HOME/actions-runner"
RUNNER_WORK="$RUNNER_DIR/_work"
RUNNER_NAME=""
RUNNER_LABELS=""
REG_TOKEN=""
SWAP_SIZE_GB=8
MEMORY_HIGH="3G"
MEMORY_MAX="4G"
MEMORY_SWAP_MAX="6G"
HEALTH_PORT=9100

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)    RUNNER_NAME="$2";   shift 2 ;;
    --labels)  RUNNER_LABELS="$2"; shift 2 ;;
    --token)   REG_TOKEN="$2";     shift 2 ;;
    --swap)    SWAP_SIZE_GB="$2";  shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

[[ -z "$RUNNER_NAME"   ]] && { echo "ERROR: --name is required";  exit 1; }
[[ -z "$RUNNER_LABELS" ]] && { echo "ERROR: --labels is required"; exit 1; }
[[ -z "$REG_TOKEN"     ]] && { echo "ERROR: --token is required";  exit 1; }

RUNNER_ARCH="arm64"
TARBALL="actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# =============================================================================
# STEP 1 — Swap
# =============================================================================
log "── Step 1: Swap (${SWAP_SIZE_GB}GB) ──────────────────────────────────────"

if swapon --show | grep -q /swapfile; then
  log "  swapfile already active — skipping"
else
  if [[ ! -f /swapfile ]]; then
    log "  Creating /swapfile (${SWAP_SIZE_GB}GB)…"
    sudo fallocate -l "${SWAP_SIZE_GB}G" /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
  fi
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  log "  Swap active: $(free -h | grep Swap)"
fi

# Kernel tuning (idempotent — grep before append)
for line in "vm.swappiness=10" "vm.vfs_cache_pressure=50" \
            "net.ipv4.tcp_keepalive_time=60" \
            "net.ipv4.tcp_keepalive_intvl=10" \
            "net.ipv4.tcp_keepalive_probes=6" \
            "fs.file-max=200000"; do
  key="${line%%=*}"
  grep -q "^${key}" /etc/sysctl.conf 2>/dev/null || echo "$line" | sudo tee -a /etc/sysctl.conf
done
sudo sysctl -p --quiet 2>/dev/null || true

# Open file descriptor limits (idempotent)
for entry in "* soft nofile 65536" "* hard nofile 65536"; do
  grep -qF "$entry" /etc/security/limits.conf 2>/dev/null || echo "$entry" | sudo tee -a /etc/security/limits.conf
done

# =============================================================================
# STEP 2 — Dependencies
# =============================================================================
log "── Step 2: Dependencies ──────────────────────────────────────────────────"

export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq \
  curl git jq unzip tar gzip \
  netcat-openbsd \
  build-essential \
  ca-certificates \
  libicu-dev \
  2>/dev/null

# Bun (runner's build tool)
if ! command -v bun &>/dev/null; then
  log "  Installing Bun…"
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
else
  log "  Bun $(bun --version) already installed"
fi

# Node.js is deliberately NOT installed.
#
# This host used to carry Node 20 "as a fallback for some tools". Nothing
# needed it, and keeping it installed a second runtime next to Bun is how a
# project ends up running under Node in production after a job quietly falls
# back to it. The project has no Node engine, no `setup-node` step, and every
# JS tool it invokes is run explicitly on Bun (`bun <file>`).
#
# The one Node on this host that stays is the GitHub Actions runner's OWN
# bundled runtime, which is what executes Node-based actions such as
# `actions/checkout` and `actions/cache`. That copy lives inside the runner
# package (`externals/node20`), is versioned with the runner, and is
# independent of the system Node this block used to install. Removing system
# Node therefore does not affect actions — it removes the runtime a *project*
# command could accidentally pick up.

# Supabase CLI
if ! command -v supabase &>/dev/null; then
  log "  Installing Supabase CLI…"
  curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_arm64.tar.gz \
    | sudo tar -xz -C /usr/local/bin supabase
else
  log "  Supabase CLI $(supabase --version 2>&1 | head -1) already installed"
fi

# =============================================================================
# STEP 3 — Stop and remove any existing runner registration
# =============================================================================
log "── Step 3: Deregister existing runner (if any) ───────────────────────────"

EXISTING_SERVICE=$(sudo systemctl list-units --type=service 2>/dev/null \
  | grep -o "actions\.runner\.[^ ]*\.service" | head -1 || true)

if [[ -n "$EXISTING_SERVICE" ]]; then
  log "  Stopping $EXISTING_SERVICE…"
  sudo systemctl stop "$EXISTING_SERVICE" 2>/dev/null || true
  (cd "$RUNNER_DIR" && sudo ./svc.sh uninstall 2>/dev/null) || true
fi

if [[ -f "$RUNNER_DIR/.runner" ]]; then
  log "  Removing existing configuration…"
  (cd "$RUNNER_DIR" && ./config.sh remove --token "$REG_TOKEN" 2>/dev/null) || true
fi

# =============================================================================
# STEP 4 — Download and extract runner binary
# =============================================================================
log "── Step 4: Runner binary ─────────────────────────────────────────────────"

mkdir -p "$RUNNER_DIR"

CURRENT_VER=""
[[ -f "$RUNNER_DIR/bin/Runner.Listener" ]] && \
  CURRENT_VER=$("$RUNNER_DIR/bin/Runner.Listener" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)

if [[ "$CURRENT_VER" == "$RUNNER_VERSION" ]]; then
  log "  Runner $RUNNER_VERSION already present — skipping download"
else
  log "  Downloading runner $RUNNER_VERSION…"
  curl -fsSL "$DOWNLOAD_URL" | tar -xz -C "$RUNNER_DIR"
  log "  Extracted to $RUNNER_DIR"
fi

# =============================================================================
# STEP 5 — Configure runner
# =============================================================================
log "── Step 5: Configure runner ──────────────────────────────────────────────"

mkdir -p "$RUNNER_WORK"

cd "$RUNNER_DIR"
./config.sh \
  --url        "$REPO_URL" \
  --token      "$REG_TOKEN" \
  --name       "$RUNNER_NAME" \
  --labels     "$RUNNER_LABELS" \
  --runnergroup "Default" \
  --work       "_work" \
  --replace \
  --unattended

log "  Runner configured: $RUNNER_NAME  labels: $RUNNER_LABELS"

# =============================================================================
# STEP 6 — Install systemd service with hardened overrides
# =============================================================================
log "── Step 6: Systemd service ───────────────────────────────────────────────"

cd "$RUNNER_DIR"
sudo ./svc.sh install

SERVICE=$(sudo systemctl list-units --type=service 2>/dev/null \
  | grep -o "actions\.runner\.[^ ]*\.service" | head -1)
log "  Service name: $SERVICE"

# Drop-in override for resilience
OVERRIDE_DIR="/etc/systemd/system/${SERVICE}.d"
sudo mkdir -p "$OVERRIDE_DIR"

sudo tee "$OVERRIDE_DIR/hardening.conf" > /dev/null << UNIT
[Service]
# ── Restart policy ────────────────────────────────────────────────────────────
# Restart on ANY exit — OOM kill, crash, network drop, anything.
Restart=always
RestartSec=15

# If it fails 5 times in 2 min, wait 60 s before trying again (prevents
# spin-loop when GitHub is down or the token is invalid).
StartLimitBurst=5
StartLimitIntervalSec=120s

# ── Memory limits ─────────────────────────────────────────────────────────────
# MemoryHigh: soft ceiling — kernel starts reclaiming/swapping above this.
# MemoryMax:  hard ceiling — processes inside get SIGKILL if they exceed it.
# MemorySwapMax: how much of the swap the service can use.
MemoryHigh=${MEMORY_HIGH}
MemoryMax=${MEMORY_MAX}
MemorySwapMax=${MEMORY_SWAP_MAX}

# ── OOM priority ──────────────────────────────────────────────────────────────
# Negative = kernel kills OTHER processes before killing the runner.
# Range: -1000 (never kill) to 1000 (kill first). -500 is very protective.
OOMScoreAdjust=-500

# ── Graceful shutdown ─────────────────────────────────────────────────────────
# Give running jobs up to 60 s to finish before force-killing.
TimeoutStopSec=60

# ── Logging ───────────────────────────────────────────────────────────────────
StandardOutput=journal
StandardError=journal
SyslogIdentifier=github-runner-${RUNNER_NAME}
UNIT

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE"
sudo systemctl start "$SERVICE"

sleep 3
STATUS=$(sudo systemctl is-active "$SERVICE")
log "  Service status: $STATUS"
[[ "$STATUS" == "active" ]] || { sudo systemctl status "$SERVICE" --no-pager; exit 1; }

# =============================================================================
# STEP 7 — Disk cleanup cron (weekly)
# =============================================================================
log "── Step 7: Disk cleanup cron ─────────────────────────────────────────────"

sudo tee /etc/cron.weekly/runner-disk-cleanup > /dev/null << CRON
#!/bin/bash
# GitHub Actions runner — weekly disk cleanup
WORK="${RUNNER_WORK}"
LOG="\$HOME/runner-cleanup.log"
echo "=== \$(date) ===" >> "\$LOG"
echo "Disk before: \$(df -h / | tail -1)" >> "\$LOG"

# Next.js build output — largest artifact, safe to delete (rebuilt each CI run)
find "\$WORK" -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true

# node_modules — reinstalled fresh by bun install --frozen-lockfile
find "\$WORK" -name "node_modules" -maxdepth 7 -type d -exec rm -rf {} + 2>/dev/null || true

# Bun cache
rm -rf "\$HOME/.bun/install/cache" 2>/dev/null || true

# Playwright browsers older than 30 days
find "\$WORK" -name "ms-playwright" -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true

# Old work directories (completed jobs leave _work/<repo>/<workflow>)
find "\$WORK" -mindepth 2 -maxdepth 2 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true

echo "Disk after:  \$(df -h / | tail -1)" >> "\$LOG"
CRON

sudo chmod +x /etc/cron.weekly/runner-disk-cleanup
log "  Disk cleanup cron installed"

# =============================================================================
# STEP 8 — Watchdog cron (every 2 minutes)
# =============================================================================
log "── Step 8: Watchdog cron ─────────────────────────────────────────────────"

WATCHDOG=/usr/local/bin/runner-watchdog.sh
sudo tee "$WATCHDOG" > /dev/null << WATCHDOG
#!/bin/bash
# Restarts the GitHub Actions runner if systemd reports it as not active.
# Catches the edge case where OOM kills the process but systemd stays confused.
SVC=\$(systemctl list-units --type=service 2>/dev/null \
  | grep -o "actions\.runner\.[^ ]*\.service" | head -1)
[ -z "\$SVC" ] && exit 0
STATE=\$(systemctl is-active "\$SVC" 2>/dev/null)
if [ "\$STATE" != "active" ]; then
  echo "\$(date): runner not active (state=\$STATE) — restarting" \
    >> /var/log/runner-watchdog.log
  systemctl restart "\$SVC"
fi
WATCHDOG

sudo chmod +x "$WATCHDOG"

# Remove old entry if present, then add fresh one
( sudo crontab -l 2>/dev/null | grep -v runner-watchdog ) | sudo crontab -
( sudo crontab -l 2>/dev/null; echo "*/2 * * * * $WATCHDOG" ) | sudo crontab -
log "  Watchdog cron installed (runs every 2 minutes)"

# =============================================================================
# STEP 9 — Health HTTP server (port 9100)
# =============================================================================
log "── Step 9: Health server (port $HEALTH_PORT) ─────────────────────────────"

sudo tee /usr/local/bin/runner-health.sh > /dev/null << 'HEALTH'
#!/bin/bash
# Tiny HTTP responder: 200 = runner active, 503 = runner down
while true; do
  SVC=$(systemctl list-units --type=service 2>/dev/null \
    | grep -o "actions\.runner\.[^ ]*\.service" | head -1)
  STATE=$(systemctl is-active "$SVC" 2>/dev/null)
  MEM=$(free -m | awk '/Mem:/{printf "ram=%dMB/%dMB", $3, $2}')
  DISK=$(df -h / | awk 'NR==2{printf "disk=%s/%s", $3, $2}')
  if [ "$STATE" = "active" ]; then
    BODY="ok runner=active $MEM $DISK service=$SVC"
    STATUS="200 OK"
  else
    BODY="error runner=$STATE $MEM $DISK service=${SVC:-none}"
    STATUS="503 Service Unavailable"
  fi
  RESP="HTTP/1.1 $STATUS\r\nContent-Length: ${#BODY}\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n$BODY"
  printf "$RESP" | nc -l -p 9100 -q 1 2>/dev/null || sleep 1
done
HEALTH

sudo chmod +x /usr/local/bin/runner-health.sh

sudo tee /etc/systemd/system/runner-health.service > /dev/null << SVCUNIT
[Unit]
Description=GitHub Runner Health Check (port ${HEALTH_PORT})
After=network.target

[Service]
ExecStart=/usr/local/bin/runner-health.sh
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCUNIT

sudo systemctl daemon-reload
sudo systemctl enable runner-health
sudo systemctl start runner-health
log "  Health server active — probe: curl http://\$(hostname -I | awk '{print \$1}'):${HEALTH_PORT}"

# =============================================================================
# STEP 10 — Auto-update check service (nightly)
# =============================================================================
log "── Step 10: Auto-update service ──────────────────────────────────────────"

sudo tee /etc/systemd/system/runner-autoupdate.service > /dev/null << 'AUTOSVC'
[Unit]
Description=GitHub Actions Runner auto-update check
After=network-online.target

[Service]
Type=oneshot
User=%i
ExecStart=/bin/bash -c '\
  SVC=$(systemctl list-units --type=service 2>/dev/null | grep -o "actions.runner.[^ ]*.service" | head -1); \
  [ -z "$SVC" ] && exit 0; \
  systemctl is-active "$SVC" || systemctl restart "$SVC"; \
  echo "$(date): auto-update check complete" >> $HOME/runner-update.log'
AUTOSVC

sudo tee /etc/systemd/system/runner-autoupdate.timer > /dev/null << 'TIMER'
[Unit]
Description=Run GitHub Actions runner update check nightly

[Timer]
OnCalendar=*-*-* 03:00:00
RandomizedDelaySec=1800
Persistent=true

[Install]
WantedBy=timers.target
TIMER

sudo systemctl daemon-reload
sudo systemctl enable runner-autoupdate.timer
sudo systemctl start runner-autoupdate.timer
log "  Auto-update timer enabled (nightly 03:00)"

# =============================================================================
# Final verification
# =============================================================================
log ""
log "═══════════════════════════════════════════════════════════════"
log "  Setup complete for: $RUNNER_NAME"
log "═══════════════════════════════════════════════════════════════"
log ""
log "  Swap:        $(free -h | awk '/Swap/{print $2}')"
log "  Disk free:   $(df -h / | awk 'NR==2{print $4}')"
log "  Runner:      $(sudo systemctl is-active "$SERVICE")"
log "  Watchdog:    every 2 min via cron"
log "  Health:      http://$(hostname -I | awk '{print $1}'):${HEALTH_PORT}"
log ""
log "  Verify registration:"
log "  gh api repos/organicnz/indivisiblefairoaks/actions/runners --jq '.runners[] | {name,status}'"
log ""
