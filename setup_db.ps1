# This script initializes our local database, starts the server, and creates 'karibu_db'
# You can run it once Scoop finishes extracting PostgreSQL!

$dbPath = "$env:USERPROFILE\scoop\apps\postgresql\current\data"

if (-Not (Test-Path $dbPath)) {
    Write-Host "Initializing PostgreSQL database..."
    
    # We are generating a temporary text file with the password we set in config (password)
    $pwFile = "$env:TEMP\pgpw.txt"
    "password" | Out-File -FilePath $pwFile -Encoding ascii
    
    # Initialize the cluster using postgres as the super user
    initdb.exe -D $dbPath -U postgres --pwfile=$pwFile
    
    Remove-Item $pwFile
    Write-Host "Database Cluster initialized successfully!"
}

Write-Host "Starting the PostgreSQL Server..."
pg_ctl.exe -D $dbPath -l logfile start
Start-Sleep -Seconds 3

Write-Host "Attempting to create 'karibu_db'..."
# 42P04 indicates the database already exists, so we suppress errors gracefully if it's rerun
createdb.exe -U postgres -h localhost -p 5432 karibu_db 2>$null

Write-Host "Bootstrapping tables and the first SUPER_ADMIN..."
& .\venv\Scripts\Activate.ps1
python scripts/init_db.py

Write-Host "All set! The Database is running and seeded."
