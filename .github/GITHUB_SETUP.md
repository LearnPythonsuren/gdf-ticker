# GitHub Setup & Deployment Guide

## 1. Create & Configure Repository

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: GDF Ticker with CI/CD pipeline"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/gdf-ticker.git
git branch -M main
git push -u origin main
```

---

## 2. Configure GitHub Secrets for Deployment

Go to **Settings → Secrets and variables → Actions** and add these secrets:

### Required Secrets

| Secret | Value | Example |
|--------|-------|---------|
| `DEPLOY_HOST` | Your production server's IP or hostname | `192.168.1.100` or `prod.example.com` |
| `DEPLOY_USER` | SSH username | `deploy` or `ubuntu` |
| `DEPLOY_KEY` | Private SSH key (see below) | `-----BEGIN RSA PRIVATE KEY-----...` |
| `DEPLOY_PORT` | SSH port (optional, defaults to 22) | `2222` |

---

## 3. Generate SSH Key Pair

**On your production server:**

```bash
# Create a deploy user (optional but recommended)
sudo useradd -m -s /bin/bash deploy

# Switch to deploy user
sudo su - deploy

# Generate SSH key
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy -N ""

# Display the private key for GitHub secret
cat ~/.ssh/github_deploy
```

**Add public key to authorized_keys:**

```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

---

## 4. Set Up Production Server

```bash
# On production server, as deploy user
mkdir -p /app
cd /app

# Clone the repo OR just copy docker-compose.yml + related files
# (If using private repo, you'll need repo access token)
git clone https://github.com/YOUR_USERNAME/gdf-ticker.git .

# Create data volume directory
mkdir -p data/logs data/instruments

# Set permissions
chown -R deploy:deploy /app
chmod 755 /app/data
```

**Alternatively, use SSH to push files directly:**

```bash
# From your local machine
scp -r docker-compose.yml .env deploy@DEPLOY_HOST:/app/
```

---

## 5. Configure Environment (.env or docker-compose.yml)

On production server, create `/app/.env`:

```bash
GDF_WS_URL=wss://your-gdf-host:4576/
ADMIN_PASSWORD=YourStrongPassword123!
EXCHANGES=MCX
MAX_SUBSCRIPTIONS=15000
STALE_MS=3000
BROADCAST_INTERVAL_MS=500
LOG_TICKS=true
CACHE_DIR=/data/instruments
LOG_DIR=/data/logs
```

**Or** update `docker-compose.yml` with your production values.

---

## 6. Test Deployment Manually

Before relying on GitHub Actions, test the deployment script locally:

```bash
# From production server
cd /app

# Log in to GHCR
docker login ghcr.io -u YOUR_GITHUB_USERNAME

# Pull and run
docker compose pull
docker compose up -d

# Verify
docker compose ps
docker compose logs gdf-ticker
```

---

## 7. Create a Release/Tag to Trigger Deployment

```bash
# On your local machine
git tag -a v1.0.0 -m "First production release"
git push origin v1.0.0
```

**GitHub Actions will:**
1. Run tests
2. Build Docker image → `ghcr.io/YOUR_USERNAME/gdf-ticker:v1.0.0`
3. Push to GHCR
4. Scan for vulnerabilities
5. Deploy to production via SSH

---

## 8. Monitor Deployment

**View workflow status:** Go to your repo → **Actions** tab → click the latest workflow run

**SSH into production and check logs:**

```bash
ssh deploy@DEPLOY_HOST
cd /app
docker compose logs -f gdf-ticker
```

---

## 9. Rollback (If Needed)

```bash
# On production server
docker compose down
docker pull ghcr.io/YOUR_USERNAME/gdf-ticker:v1.0.0  # previous tag
docker compose pull
docker compose up -d
```

Or revert git tag and push a new one:

```bash
# Locally
git tag -d v1.0.0
git push origin :v1.0.0
git tag -a v1.0.1 -m "Rollback"
git push origin v1.0.1
```

---

## 10. Troubleshooting

### SSH Connection Fails

- Verify `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT` are correct
- Check SSH key permissions: `chmod 600 ~/.ssh/github_deploy`
- Test SSH manually from GitHub runner:
  ```bash
  ssh -i /path/to/key -v deploy@DEPLOY_HOST "docker --version"
  ```

### Docker Pull Fails (Private GHCR Image)

Ensure `GITHUB_TOKEN` is available in the deploy step. The workflow already passes `secrets.GITHUB_TOKEN`, but verify:
- The token is not expired (it auto-rotates)
- The repo is public or the deploy user has access

### Container Won't Start

```bash
docker compose logs gdf-ticker
docker compose ps
```

Check for config errors, missing volumes, or port conflicts.

---

## 11. Optional: Add Slack/Email Notifications

Add to `.github/workflows/ci-cd.yml`:

```yaml
  notify:
    name: Notify Deployment
    runs-on: ubuntu-latest
    needs: deploy
    if: always()
    steps:
      - name: Slack notification
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment ${{ job.status }}: ${{ github.ref }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Quick Reference

```bash
# Local workflow
git add .
git commit -m "your message"
git push origin main           # Pushes to main (builds & tests)
git tag -a v1.0.0 -m "Release"
git push origin v1.0.0         # Tags trigger deploy
```

```bash
# Production server checks
docker ps                      # Running containers
docker compose logs -f         # Live logs
docker system df               # Disk usage
docker stats                   # Resource usage
```
