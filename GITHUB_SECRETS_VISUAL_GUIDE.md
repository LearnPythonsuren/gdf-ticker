# GitHub Secrets Setup - Visual Guide

## Quick Link
👉 **https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions**

---

## How to Add Secrets (Click-by-Click)

### Go to Settings
1. Open your repo: https://github.com/LearnPythonsuren/gdf-ticker
2. Click **Settings** tab (top right)
3. Left sidebar → **Secrets and variables**
4. Click **Actions** (if not already selected)

### Click "New repository secret"
- Green button, top right of the page

### Add Secret #1: DEPLOY_HOST
```
Name:  DEPLOY_HOST
Value: localhost
```
- Paste value
- Click **Add secret**

### Add Secret #2: DEPLOY_USER
```
Name:  DEPLOY_USER
Value: deploy
```
- Paste value
- Click **Add secret**

### Add Secret #3: DEPLOY_PORT
```
Name:  DEPLOY_PORT
Value: 2222
```
- Paste value
- Click **Add secret**

### Add Secret #4: DEPLOY_KEY
```
Name:  DEPLOY_KEY
Value: [PASTE ENTIRE PRIVATE KEY BELOW]
```

**Copy the entire private key (all lines including BEGIN/END):**

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUtbm9uZQAAAAgAAAAAEAEAAQ4AAAANZWNkc2Etc2hh
... (many lines) ...
-----END OPENSSH PRIVATE KEY-----
```

- Click **Add secret**

---

## ✅ Verify Secrets Added

After adding all 4, you should see:
```
DEPLOY_HOST
DEPLOY_PORT
DEPLOY_USER
DEPLOY_KEY
```

All showing as `***(hidden)***` (for security).

---

## 🚀 Test Deployment

Once secrets are saved, push a test tag:

```bash
cd D:\Surendran_projects\gdf-ticker-v1\gdf-ticker
git tag -a v1.0.2 -m test
git push origin v1.0.2
```

### Watch the Workflow
1. Go to **Actions** tab: https://github.com/LearnPythonsuren/gdf-ticker/actions
2. Click the **v1.0.2** workflow (top)
3. Wait for stages: Test → Build → Security Scan → Deploy
4. Click **Deploy** stage to see SSH output

---

## 📞 Need Help?

If deployment fails:
1. Check **Deploy** stage logs for error message
2. Common issues:
   - SSH server not running (start with docker run command)
   - Port 2222 not exposed
   - SSH key permissions wrong
3. See `SSH_DEPLOYMENT_SETUP.md` for troubleshooting

---

**All set!** Your secrets are now stored securely on GitHub. Each tag push will automatically deploy.
