# GDF Ticker — CI/CD & Deployment

## GitHub Actions Pipeline

**Stages:**

1. **Test & Lint** (on every push + PR)
   - Node.js setup + dependency cache
   - Basic syntax check on all backend files
   - Lint hook (if defined in package.json)

2. **Build & Push** (on every push to `main`/`develop` + tags)
   - Multi-stage Docker build via Buildx
   - Push to GitHub Container Registry (GHCR)
   - Registry-layer build cache for faster rebuilds
   - Auto-tag: `latest` on default branch, semver on tags, commit SHA

3. **Security Scan** (after build, prod only)
   - Trivy vulnerability scanner
   - Reports to GitHub Security tab (SARIF upload)
   - Fails on CRITICAL/HIGH

4. **Deploy** (on version tags only)
   - Placeholder for SSH deployment to production
   - Uncomment and configure with your host + SSH key

---

## Setup

### 1. GitHub Secrets (if deploying via SSH)

Add to your repo Settings → Secrets and variables:

- `DEPLOY_KEY` — private SSH key to your production host
- Or use GitHub Environments + Deployment protection rules

### 2. Docker image naming

The workflow pushes to:
```
ghcr.io/your-github-username/gdf-ticker:latest
ghcr.io/your-github-username/gdf-ticker:v1.2.3 (on tags)
```

Pull it locally:
```bash
docker login ghcr.io -u your-github-username
docker pull ghcr.io/your-github-username/gdf-ticker:latest
```

### 3. Customize deployment step

Edit `.github/workflows/ci-cd.yml`, **Deploy** job:

```bash
ssh -i ${{ secrets.DEPLOY_KEY }} user@host \
  "cd /app && docker compose pull && docker compose up -d"
```

Or use a third-party action (e.g., `appleboy/ssh-action`).

---

## Local Build & Test

```bash
# Build locally
docker compose build

# Run with hot-reload
docker compose up

# Run in background
docker compose up -d

# Inspect logs
docker compose logs -f gdf-ticker

# Stop & clean
docker compose down -v
```

---

## Multi-stage Dockerfile Optimizations

- **Stage 1 (builder):** `npm ci` installs deps, layer is discarded
- **Stage 2 (production):** copies only `node_modules` + source, ~180 MB image
- **Healthcheck:** polls `/api/stats` endpoint, auto-restarts unhealthy containers
- **Alpine base:** ~40 MB, vs ~900 MB for full Debian

---

## Image Layering & Cache

```
Layer 1: node:20-alpine base (~150 MB)
Layer 2: COPY package*.json → npm ci (~20 MB prod deps, ~30 MB build deps discarded)
Layer 3: COPY backend + frontend (~10 MB)
Layer 4: EXPOSE + ENV + HEALTHCHECK (~0 MB)
```

Changes to backend code re-use layers 1–2 (cache hit), rebuild layer 3 only.

---

## GitHub Container Registry Access

**Public images** — no auth needed:
```bash
docker pull ghcr.io/your-username/gdf-ticker:latest
```

**Private images** — use GitHub Personal Access Token (PAT):
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u your-username --password-stdin
```

---

## Monitoring & Rollback

Once deployed, watch logs:
```bash
docker compose logs -f gdf-ticker
```

Rollback to previous version:
```bash
docker compose down
docker pull ghcr.io/your-username/gdf-ticker:v1.0.0
# Update docker-compose.yml image tag, then:
docker compose up -d
```
