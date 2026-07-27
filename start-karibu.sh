#!/usr/bin/env bash
# Karibu Credit -- Multi-Server Launcher (Linux port of start_all.ps1)
set -uo pipefail

PROJECT_ROOT="/home/cantroll/karibuinc"
cd "$PROJECT_ROOT" || { echo "ERROR: Can't find $PROJECT_ROOT"; exit 1; }

# -- EDIT THESE IF WRONG ------------------------------------------------
VENV_DIR="venv"              # or ".api-venv" -- swap if venv/ is the stale one
UVICORN_APP="app.main:app"   # confirm this matches your FastAPI app object
BACKEND_PORT=8000
FRONTEND_PORT=3000
TUNNEL_TARGET_PORT="$BACKEND_PORT"   # tunnel the backend (SMS OTP webhooks need public reach)
# ------------------------------------------------------------------------

mkdir -p logs
LOG_DIR="$PROJECT_ROOT/logs"
PID_FILE="$PROJECT_ROOT/.karibu_pids"
> "$PID_FILE"

echo ""
echo "=============================================="
echo "   Karibu Credit -- Multi-Server Launcher"
echo "=============================================="
echo ""

# -- 1. Docker services (Postgres + Redis) ------------------------------
echo "[1/5] Starting Docker services (PostgreSQL + Redis)..."
docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d
if [ $? -ne 0 ]; then
    echo "  WARNING: Docker Compose failed. Is the Docker daemon running? (sudo systemctl start docker)"
    exit 1
fi

echo "  Waiting for Postgres + Redis healthchecks..."
for i in $(seq 1 15); do
    PG_OK=$(docker inspect --format='{{.State.Health.Status}}' karibu_db 2>/dev/null)
    RD_OK=$(docker inspect --format='{{.State.Health.Status}}' karibu_redis 2>/dev/null)
    if [ "$PG_OK" == "healthy" ] && [ "$RD_OK" == "healthy" ]; then
        echo "  [OK] Postgres and Redis are healthy"
        break
    fi
    sleep 1
done

# -- 2. Activate venv ---------------------------------------------------
echo "[2/5] Activating Python venv ($VENV_DIR)..."
if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
    echo "  [OK] venv activated: $(which python)"
else
    echo "  [FAIL] $VENV_DIR/bin/activate not found -- check VENV_DIR at top of script"
    exit 1
fi

# -- 3. Celery worker ---------------------------------------------------
echo "[3/5] Starting Celery worker (karibu_worker)..."
nohup celery -A app.celery_app.celery_app worker --loglevel=info \
    > "$LOG_DIR/celery.log" 2>&1 &
echo $! >> "$PID_FILE"
echo "  [OK] Celery worker started (PID $!) -- logs: logs/celery.log"

# -- 4. FastAPI backend --------------------------------------------------
echo "[4/5] Starting FastAPI backend on :$BACKEND_PORT..."
nohup uvicorn "$UVICORN_APP" --reload --host 0.0.0.0 --port "$BACKEND_PORT" \
    > "$LOG_DIR/backend.log" 2>&1 &
echo $! >> "$PID_FILE"
echo "  [OK] Backend started (PID $!) -- logs: logs/backend.log"

# -- 5. Next.js frontend (web-admin) ------------------------------------
echo "[5/5] Starting Next.js frontend on :$FRONTEND_PORT..."
( cd web-admin && nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 & echo $! >> "$PID_FILE" )
sleep 1
echo "  [OK] Frontend starting -- logs: logs/frontend.log"

# -- 6. Verify Caddy + Funnel (system service) --------------------------
echo ""
echo "[6/6] Checking Caddy + Tailscale Funnel (system-managed, not launched here)..."
if systemctl is-active --quiet caddy; then
    echo "  [OK] Caddy is running -- reverse-proxying /api/* -> :8000, / -> :3000"
else
    echo "  [WARN] Caddy is not running. Start it with: sudo systemctl start caddy"
fi

FUNNEL_URL=$(tailscale serve status 2>/dev/null | grep -oE 'https://[a-zA-Z0-9.-]+\.ts\.net' | head -1)
if [ -n "$FUNNEL_URL" ]; then
    echo "  [OK] Public URL live: $FUNNEL_URL"
    echo "     Login page: $FUNNEL_URL/login"
else
    echo "  [WARN] No active Funnel found. Check with: tailscale serve status"
fi

echo ""
echo "All services launched. PIDs saved to .karibu_pids"
echo "Tail everything:   tail -f logs/*.log"
echo "Stop everything:   kill \$(cat .karibu_pids) && docker compose down"
