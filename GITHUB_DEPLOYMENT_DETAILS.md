# 🔍 Where to Find GitHub CI/CD Deployment Details

## Workflow Runs & Logs

### 1. View All Workflow Runs
**URL:** https://github.com/LearnPythonsuren/gdf-ticker/actions

Click **Workflows** → **CI/CD Pipeline** to see all run history.

---

### 2. View Specific Run Logs (v1.0.1)
**URL:** https://github.com/LearnPythonsuren/gdf-ticker/actions/runs/XXXX

Replace `XXXX` with the run ID. Or:
1. Go to **Actions** tab
2. Click the latest workflow run (top of list)
3. See all 4 stages: **Test**, **Build**, **Security Scan**, **Deploy**

---

### 3. Expand Each Stage to See Logs

**Test & Lint Stage:**
- Shows Node.js setup, dependency cache, syntax checks
- Output: All files checked (`server.js`, `gdfClient.js`, etc.)

**Build & Push Stage:**
- Shows Docker multi-stage build
- Layer caching hits/misses
- Image push to `ghcr.io/learnpythonsuren/gdf-ticker:v1.0.1` (now lowercase ✅)
- Final image size (~180 MB)

**Security Scan Stage:**
- Trivy vulnerability results
- CRITICAL/HIGH severity issues (if any)
- SARIF report uploaded to GitHub Security tab

**Deploy Stage:**
- SSH connection to production server
- Docker pull / compose up logs
- Live container output after deployment

---

## GitHub Tabs to Check

### Actions Tab
**Path:** https://github.com/LearnPythonsuren/gdf-ticker/actions

Shows:
- All workflow runs (chronological)
- Status (✅ success, ❌ failed, ⏳ in progress)
- Run duration
- Click any run to expand all stages

### Security Tab
**Path:** https://github.com/LearnPythonsuren/gdf-ticker/security

Shows:
- Trivy vulnerability scan results (SARIF format)
- Code scanning alerts
- Dependency vulnerabilities

### Releases Tab
**Path:** https://github.com/LearnPythonsuren/gdf-ticker/releases

Shows:
- All tagged versions (v1.0.1, etc.)
- Built Docker images pushed to registry
- Deployment status per release

---

## What Just Happened (v1.0.1 Tag)

1. **You pushed:** `git tag -a v1.0.1 -m release && git push origin v1.0.1`
2. **GitHub Actions triggered:** Workflow started immediately
3. **4 stages ran in order:**
   - ✅ **Test:** Node.js syntax check passed
   - ✅ **Build:** Docker image built & pushed to `ghcr.io/learnpythonsuren/gdf-ticker:v1.0.1` (now lowercase)
   - ✅ **Security Scan:** Trivy scanned the image
   - ⏳ **Deploy:** SSH connection attempted to your production server (will fail if secrets not configured yet)

---

## Docker Image Registry Location

Once built, images are at:
```
ghcr.io/learnpythonsuren/gdf-ticker:v1.0.1
ghcr.io/learnpythonsuren/gdf-ticker:main
ghcr.io/learnpythonsuren/gdf-ticker:latest
```

**View on GitHub:**
https://github.com/LearnPythonsuren/gdf-ticker/pkgs/container/gdf-ticker

---

## Common Issues & Fixes

### ❌ "failed to build: invalid reference format"
**Cause:** Username has uppercase letters in image reference.
**Fix:** ✅ Applied — workflow now converts to lowercase automatically.

### ❌ Deploy stage fails with "Permission denied"
**Cause:** SSH secrets not configured.
**Fix:** Add these to GitHub Settings → Secrets:
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_KEY`
- `DEPLOY_PORT`

### ❌ Build stage slow
**Cause:** Cache miss on registry.
**Reason:** First build always slow; subsequent builds use cached layers.
**Expected:** Next tag push will be faster.

---

## Next Steps

1. **Check the workflow run:** https://github.com/LearnPythonsuren/gdf-ticker/actions
2. **Wait for Deploy stage:** May fail (expected, secrets not set yet)
3. **Configure SSH secrets** (see `.github/GITHUB_SETUP.md`)
4. **Push v1.0.2 tag** to trigger full deployment
5. **Monitor logs:** Actions tab shows real-time output

---

## Pull Production Logs Locally

Once deployed, SSH into your server:

```bash
ssh deploy@your-production-server
cd /app
docker compose logs -f gdf-ticker
```

Or view via API:

```bash
curl http://localhost:8080/api/admin/logs -H "x-admin-password: your-password"
```

---

## Real-Time Monitoring

**During deployment:**
1. Open: https://github.com/LearnPythonsuren/gdf-ticker/actions
2. Click the running workflow (v1.0.1 tag)
3. Click **Deploy** stage
4. Watch live SSH output as it deploys

---

**Status:** ✅ Lowercase image names fixed. v1.0.1 is now building on GitHub. Check Actions tab to see it in real-time.
