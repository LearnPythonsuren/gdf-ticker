# GDF Ticker CI/CD Setup Instructions

Your project is ready for GitHub deployment. Follow these steps:

## 1️⃣ Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: GDF Ticker with Docker & CI/CD"
git remote add origin git@github.com:LearnPythonsuren/gdf-ticker.git
git branch -M main
git push -u origin main
```

## 2️⃣ Generate SSH Credentials on Production Server

SSH into your production server and run:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/gdf-ticker/main/scripts/setup-production.sh | bash -s deploy
```

**Or manually:**

```bash
ssh user@your-production-server
bash scripts/setup-production.sh deploy
```

The script will output a **PRIVATE KEY** — copy this.

## 3️⃣ Configure GitHub Secrets

1. Go to your repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret** and add:

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | Your server's IP or hostname |
| `DEPLOY_USER` | `deploy` (or the user from step 2) |
| `DEPLOY_KEY` | The PRIVATE KEY output from step 2 |
| `DEPLOY_PORT` | `22` (or your custom SSH port) |

## 4️⃣ Trigger Deployment

Create a release tag:

```bash
git tag -a v1.0.0 -m "First release"
git push origin v1.0.0
```

Watch it deploy: Go to **Actions** tab in your repo.

---

## 📋 Files Created

- **`.github/workflows/ci-cd.yml`** — GitHub Actions pipeline (test → build → deploy)
- **`.github/GITHUB_SETUP.md`** — Full setup & troubleshooting guide
- **`QUICKSTART.md`** — Quick reference
- **`DEPLOYMENT.md`** — Deployment strategies
- **`scripts/setup-production.sh`** — Production server setup script
- **`Dockerfile`** — Multi-stage, optimized build
- **`.dockerignore`** — Excludes unnecessary files
- **`docker-compose.yml`** — Production-ready compose file

---

## 🔄 Workflow Stages

| Trigger | Stages | Deploys? |
|---------|--------|----------|
| Push to `main`/`develop` | Test → Build & Push | ❌ No |
| Create version tag | Test → Build & Push → Security Scan → Deploy SSH | ✅ **Yes** |
| Pull Request | Test only | ❌ No |

---

## 🚀 Next Steps

1. **Complete step 2** (run `setup-production.sh` on your server)
2. **Complete step 3** (add GitHub secrets)
3. **Complete step 4** (create and push a version tag)
4. **Monitor** the workflow in Actions tab
5. **Verify** on production: `docker compose ps`

See `QUICKSTART.md` or `.github/GITHUB_SETUP.md` for detailed troubleshooting.
