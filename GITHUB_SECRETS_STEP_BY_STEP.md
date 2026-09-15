# GitHub Secrets Setup - Step-by-Step with Screenshots

## 🔗 Direct Link
👉 **https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions**

---

## Where to Find It (If Link Doesn't Work)

1. Go to: https://github.com/LearnPythonsuren/gdf-ticker
2. Click **Settings** (top right, gray button)
3. Left sidebar → **Secrets and variables**
4. Click **Actions** (under "Secrets and variables")

---

## Add the 4 Secrets

### Secret 1: DEPLOY_HOST

**Step 1:** Click **"New repository secret"** (green button, top right)

**Step 2:** Enter:
```
Name:  DEPLOY_HOST
Value: localhost
```

**Step 3:** Click **"Add secret"** (green button)

---

### Secret 2: DEPLOY_USER

**Step 1:** Click **"New repository secret"** again

**Step 2:** Enter:
```
Name:  DEPLOY_USER
Value: deploy
```

**Step 3:** Click **"Add secret"**

---

### Secret 3: DEPLOY_PORT

**Step 1:** Click **"New repository secret"** again

**Step 2:** Enter:
```
Name:  DEPLOY_PORT
Value: 2222
```

**Step 3:** Click **"Add secret"**

---

### Secret 4: DEPLOY_KEY (The Private SSH Key)

This is the most important one. You need to copy your entire private key.

**Get your private key:**

Open this file: `ssh-keys/id_ed25519`

Copy **EVERYTHING** from:
```
-----BEGIN OPENSSH PRIVATE KEY-----
```
to:
```
-----END OPENSSH PRIVATE KEY-----
```

Including the BEGIN and END lines.

**Add to GitHub:**

**Step 1:** Click **"New repository secret"** one more time

**Step 2:** Enter:
```
Name:  DEPLOY_KEY
Value: [PASTE THE ENTIRE PRIVATE KEY]
```

**Step 3:** Click **"Add secret"**

---

## ✅ You Should Now See All 4

On the **Actions secrets** page, you should see:

```
DEPLOY_HOST   Updated 1 minute ago
DEPLOY_PORT   Updated 1 minute ago
DEPLOY_USER   Updated 1 minute ago
DEPLOY_KEY    Updated 1 minute ago
```

All showing as hidden `***` (for security).

---

## 🧪 Test the Setup

Now that secrets are saved, test deployment:

```bash
cd D:\Surendran_projects\gdf-ticker-v1\gdf-ticker
docker compose -f docker-compose.ssh.yml up -d
git tag -a v1.0.3 -m "Test SSH deploy"
git push origin v1.0.3
```

Watch it deploy: https://github.com/LearnPythonsuren/gdf-ticker/actions

---

## 🔒 Security Reminders

- **Don't share your private key** with anyone
- **GitHub encrypts all secrets** — only visible to Actions
- **Each secret is masked** in logs (shows as `***`)
- **Secrets expire** if you rotate your SSH key

---

## Stuck?

1. **Can't find the page?** Use direct link:
   https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions

2. **Private key not working?**
   - Verify it starts with `-----BEGIN OPENSSH PRIVATE KEY-----`
   - Verify it ends with `-----END OPENSSH PRIVATE KEY-----`
   - Copy the entire content, no extra spaces

3. **Still not working?**
   - Delete all 4 secrets and start over
   - Check that SSH server is running: `docker compose -f docker-compose.ssh.yml ps`
   - Check logs: https://github.com/LearnPythonsuren/gdf-ticker/actions

---

**Done!** Your GitHub SSH deployment is now ready. Next: push a version tag to test!
