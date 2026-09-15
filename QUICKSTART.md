# Quick Start for GitHub & Deployment

## 1. Initialize & Push to GitHub

```bash
# From your project root
git init
git add .
git commit -m "Initial commit: GDF Ticker with Docker & CI/CD"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/gdf-ticker.git
git branch -M main
git push -u origin main
```

---

## 2. Generate SSH Key on Production Server

```bash
ssh user@your-production-server

# Run setup script (or do manually)
curl -o setup-production.sh https://raw.githubusercontent.com/YOUR_USERNAME/gdf-ticker/main/scripts/setup-production.sh
chmod +x setup-production.sh
sudo bash ./setup-production.sh deploy
```

This generates an SSH key. **Copy the PRIVATE KEY output.**

---

## 3. Add GitHub Secrets

1. Go to your repo → **Settings → Secrets and variables → Actions**
2. Add these secrets:
   - `DEPLOY_HOST`: Your server IP/hostname
   - `DEPLOY_USER`: `deploy` (or your user)
   - `DEPLOY_KEY`: Paste the **PRIVATE KEY** from step 2
   - `DEPLOY_PORT`: `22` (or your SSH port)

---

## 4. Create First Release

```bash
git tag -a v1.0.0 -m "First release"
git push origin v1.0.0
```

Watch GitHub Actions → **Actions** tab for the workflow to run.

---

## 5. Verify on Production

```bash
ssh deploy@your-production-server
cd /app
docker compose ps
docker compose logs gdf-ticker
```

---

## Workflow Triggers

| Event | Stages |
|-------|--------|
| Push to `main` or `develop` | Test + Build |
| Create version tag (`v1.0.0`) | Test + Build + Security Scan + **Deploy** |
| Pull request | Test only |

---

## Troubleshooting

**SSH fails?**
```bash
# Test manually from GitHub runner
ssh -i ~/.ssh/github_deploy deploy@your-host "docker --version"
```

**Docker pull fails?**
- Ensure `deploy` user is in `docker` group: `groups deploy`
- Test: `docker login ghcr.io -u your-github-username`

**Container won't start?**
```bash
docker compose logs gdf-ticker
docker compose ps
```

See `.github/GITHUB_SETUP.md` for full guide.
