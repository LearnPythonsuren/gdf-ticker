$ErrorActionPreference = "Stop"

$KEYS_DIR = ".\ssh-keys"
if (-not (Test-Path $KEYS_DIR)) {
    New-Item -ItemType Directory -Path $KEYS_DIR -Force | Out-Null
}

# Generate SSH key pair
if (-not (Test-Path "$KEYS_DIR\id_ed25519")) {
    Write-Host "Generating SSH key pair..." -ForegroundColor Cyan
    ssh-keygen -t ed25519 -f "$KEYS_DIR\id_ed25519" -N "" -C "github-actions"
    Write-Host "✓ SSH keys generated" -ForegroundColor Green
} else {
    Write-Host "✓ SSH keys already exist" -ForegroundColor Green
}

# Build SSH server image
Write-Host "`nBuilding SSH server Docker image..." -ForegroundColor Cyan
docker build -f docker/Dockerfile.ssh-server -t gdf-ssh-server:latest .

# Create authorized_keys directory
$AUTH_DIR = ".\ssh-keys\authorized"
if (-not (Test-Path $AUTH_DIR)) {
    New-Item -ItemType Directory -Path $AUTH_DIR -Force | Out-Null
}
Copy-Item "$KEYS_DIR\id_ed25519.pub" "$AUTH_DIR\authorized_keys" -Force

Write-Host "`n✓ SSH server image built: gdf-ssh-server:latest" -ForegroundColor Green
Write-Host "`nTo start the SSH server (mock production):" -ForegroundColor Yellow
Write-Host "  docker run -d --name gdf-ssh-server -p 2222:22 -v `"$(pwd)\ssh-keys\authorized`":/home/deploy/.ssh gdf-ssh-server" -ForegroundColor Cyan

Write-Host "`nPrivate SSH Key (for GitHub Secrets):" -ForegroundColor Yellow
Write-Host "=================================================="
Get-Content "$KEYS_DIR\id_ed25519"
Write-Host "=================================================="

Write-Host "`nGitHub Secret Values:" -ForegroundColor Yellow
Write-Host "  DEPLOY_HOST: localhost" -ForegroundColor Cyan
Write-Host "  DEPLOY_USER: deploy" -ForegroundColor Cyan
Write-Host "  DEPLOY_PORT: 2222" -ForegroundColor Cyan
Write-Host "  DEPLOY_KEY: [paste the private key above]" -ForegroundColor Cyan
