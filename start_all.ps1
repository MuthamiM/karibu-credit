# ─── Karibu Credit — Multi-Server Launcher ────────────────────────────
# Starts all 4+ servers: Docker (Redis + PostgreSQL), FastAPI, Celery Worker,
# Celery Flower, and Next.js Frontend
# Usage: .\start_all.ps1
# ──────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Karibu Credit — Multi-Server Launcher         ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Docker Services (PostgreSQL + Redis) ─────────────────────────
Write-Host "[1/5] Starting Docker services (PostgreSQL + Redis)..." -ForegroundColor Yellow
docker compose -f "$ProjectRoot\docker-compose.yml" up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Docker Compose failed. Make sure Docker Desktop is running." -ForegroundColor Red
} else {
    Write-Host "   Docker services started (PostgreSQL :5432, Redis :6379)" -ForegroundColor Green
}

# Wait for Redis to be ready
Write-Host "  Waiting for Redis..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3
docker exec karibu_redis redis-cli ping 2>$null | Out-Null
Write-Host "  Redis is ready" -ForegroundColor Green

# ─── 2. Activate Python venv ─────────────────────────────────────────
$VenvActivate = "$ProjectRoot\venv\Scripts\Activate.ps1"
if (Test-Path $VenvActivate) {
    & $VenvActivate
    Write-Host "[ENV] Python venv activated" -ForegroundColor DarkGray
}

# ─── 3. FastAPI Backend ──────────────────────────────────────────────
Write-Host "[2/5] Starting FastAPI Backend (port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 127.0.0.1 --port 8000" -WindowStyle Normal
Write-Host "  FastAPI server starting at http://localhost:8000" -ForegroundColor Green

# ─── 4. Celery Worker ────────────────────────────────────────────────
Write-Host "[3/5] Starting Celery Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; .\venv\Scripts\Activate.ps1; celery -A app.celery_app worker --loglevel=info --pool=solo -Q celery,penalties,notifications,reports" -WindowStyle Normal
Write-Host "  Celery worker starting (queues: penalties, notifications, reports)" -ForegroundColor Green

# ─── 5. Celery Flower Monitor ────────────────────────────────────────
Write-Host "[4/5] Starting Celery Flower (port 5555)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; .\venv\Scripts\Activate.ps1; celery -A app.celery_app flower --port=5555" -WindowStyle Normal
Write-Host "   Flower dashboard starting at http://localhost:5555" -ForegroundColor Green

# ─── 6. Next.js Frontend ─────────────────────────────────────────────
Write-Host "[5/6] Starting Next.js Frontend (port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\web-admin'; npm run dev" -WindowStyle Normal
Write-Host "   Next.js dev server starting at http://localhost:3000" -ForegroundColor Green

# ─── 7. Ngrok Live Tunnel ───────────────────────────────────────────────
Write-Host "[6/6] Starting Ngrok Tunnel..." -ForegroundColor Yellow
if (Test-Path "$ProjectRoot\ngrok.exe") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; .\ngrok.exe http 8000" -WindowStyle Normal
    Write-Host "  Ngrok tunnel starting at https://excavate-undying-atom.ngrok-free.dev" -ForegroundColor Green
} else {
    Write-Host "   ngrok.exe not found in project root" -ForegroundColor Red
}

# ─── Summary ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   All servers launched! Open in browser:         ║" -ForegroundColor Green
Write-Host "║                                                  ║" -ForegroundColor Green
Write-Host "║   Frontend:    http://localhost:3000              ║" -ForegroundColor Green
Write-Host "║   API Docs:    http://localhost:8000/docs         ║" -ForegroundColor Green
Write-Host "║   Ngrok:       https://karibuinc.ngrok-free.app   ║" -ForegroundColor Green
Write-Host "║   Cache Stats: http://localhost:8000/cache/stats  ║" -ForegroundColor Green
Write-Host "║   Flower:      http://localhost:5555              ║" -ForegroundColor Green
Write-Host "║   Redis:       localhost:6379                     ║" -ForegroundColor Green
Write-Host "║   PostgreSQL:  localhost:5432                     ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

