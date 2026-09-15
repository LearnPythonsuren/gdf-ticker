# ✅ GitHub SSH Deployment - Complete Setup

## 🎯 What's Ready

✅ SSH key pair generated
✅ Docker SSH server config created  
✅ GitHub Actions workflow configured for SSH deployment
✅ All files pushed to GitHub

---

## 📋 Your Deployment Credentials

**Generated SSH Key:**
- Private: `ssh-keys/id_ed25519`
- Public: `ssh-keys/id_ed25519.pub`

**For GitHub Secrets:**
```
DEPLOY_HOST: localhost
DEPLOY_USER: deploy
DEPLOY_PORT: 2222
DEPLOY_KEY: [your private key - see SSH_DEPLOYMENT_SETUP.md]
```

---

## 🚀 3-Step Setup (10 Minutes)

### Step 1: Start SSH Server Locally (5 min)

Run this command in your project directory:

```bash
docker compose -f docker-compose.ssh.yml up -d
```

Verify it's running:
```bash
docker compose -f docker-compose.ssh.yml ps
```

Test SSH access:
```bash
ssh -i ssh-keys/id_ed25519 -p 2222 deploy@localhost
```

You should see: `deploy@gdf-ssh-server:~$`

Exit with: `exit`

---

### Step 2: Add 4 GitHub Secrets (3 min)

1. Open: **https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions**

2. Click **"New repository secret"** (green button)

3. Add these **4 secrets** one by one:

| # | Name | Value |
|---|------|-------|
| 1 | `DEPLOY_HOST` | `localhost` |
| 2 | `DEPLOY_USER` | `deploy` |
| 3 | `DEPLOY_PORT` | `2222` |
| 4 | `DEPLOY_KEY` | [See below] |

**For DEPLOY_KEY, copy your entire private key:**

```
-----BEGIN OPENSSH PRIVATE KEY-----
[... paste entire key content ...]
-----END OPENSSH PRIVATE KEY-----
```

See `SSH_DEPLOYMENT_SETUP.md` to view your full private key.

---

### Step 3: Test Deployment (2 min)

1. Create and push a new version tag:

```bash
cd D:\Surendran_projects\gdf-ticker-v1\gdf-ticker
git tag -a v1.0.3 -m "SSH deployment test"
git push origin v1.0.3
```

2. Watch the workflow:
   - Go to: **https://github.com/LearnPythonsuren/gdf-ticker/actions**
   - Click the **v1.0.3** workflow (top)
   - Wait for stages: Test → Build → Scan → **Deploy**
   - Click **Deploy** to see SSH output

3. Expected output in Deploy stage:
   ```
   [Step 1/1] Deploy via SSH
   docker pull ghcr.io/learnpythonsuren/gdf-ticker:v1.0.3
   docker compose pull
   docker compose up -d
   ```

---

## ✨ Deployment Success Indicators

✅ **Test stage:** Node.js syntax checks pass
✅ **Build stage:** Image pushed to `ghcr.io/learnpythonsuren/gdf-ticker:v1.0.3`
✅ **Scan stage:** Trivy scan completes
✅ **Deploy stage:** SSH connects, pulls image, runs `docker compose up -d`

If all 4 turn green → **Deployment succeeded!**

---

## 🔍 Monitor Deployed Container

After successful deployment, check what's running on your SSH server:

```bash
ssh -i ssh-keys/id_ed25519 -p 2222 deploy@localhost

# On the server:
docker compose ps
docker compose logs -f gdf-ticker
```

---

## 📍 Files Reference

| File | Purpose |
|------|---------|
| `.github/workflows/ci-cd.yml` | GitHub Actions pipeline (test, build, scan, deploy) |
| `docker-compose.ssh.yml` | Local SSH server for testing |
| `docker-compose.yml` | Production app deploy config |
| `Dockerfile` | Multi-stage GDF Ticker image |
| `SSH_DEPLOYMENT_SETUP.md` | Detailed SSH setup guide |
| `ssh-keys/id_ed25519` | Private SSH key (keep secret!) |
| `ssh-keys/id_ed25519.pub` | Public SSH key |

---

## ⚡ Workflow Trigger Rules

| Event | Stages | Deploy? |
|-------|--------|---------|
| `git push` to main | Test + Build | ❌ No |
| `git tag && git push` | Test + Build + Scan + **Deploy SSH** | ✅ **Yes** |
| Pull Request | Test only | ❌ No |

---

## 🔐 Security Notes

1. **Private key is secret** — Never commit to public repos (it's in `.gitignore` for production)
2. **GitHub Secrets are encrypted** — Only visible to GitHub Actions
3. **SSH key is ED25519** — Modern, secure
4. **Deploy user has no password** — Only SSH key authentication
5. **Sudo access restricted** — Deploy user can only run Docker commands

---

## 🧪 Troubleshooting

### Deploy stage fails: "Permission denied (publickey)"

**Problem:** SSH cannot authenticate
**Solution:**
```bash
# Verify key permissions
chmod 700 ssh-keys
chmod 600 ssh-keys/id_ed25519

# Test manually
ssh -i ssh-keys/id_ed25519 -p 2222 deploy@localhost
```

### Deploy stage fails: "Connection refused"

**Problem:** SSH server not running
**Solution:**
```bash
docker compose -f docker-compose.ssh.yml up -d
docker compose -f docker-compose.ssh.yml logs
```

### Docker image not pulling

**Problem:** GHCR authentication or image not found
**Solution:**
```bash
docker login ghcr.io -u LearnPythonsuren --password-stdin
# Paste your GitHub Personal Access Token (with read:packages)

docker pull ghcr.io/learnpythonsuren/gdf-ticker:v1.0.3
```

---

## 🎉 Next Steps

1. **✓ SSH Key Generated** ← You are here
2. **→ Start SSH Server:** `docker compose -f docker-compose.ssh.yml up -d`
3. **→ Add GitHub Secrets:** https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions
4. **→ Test:** `git tag -a v1.0.3 && git push origin v1.0.3`
5. **→ Monitor:** https://github.com/LearnPythonsuren/gdf-ticker/actions

---

**Status:** ✅ Ready for deployment. Start with Step 1 above!
