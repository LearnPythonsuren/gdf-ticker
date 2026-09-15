# GitHub SSH Deployment Setup Guide

## ✅ SSH Key Generated

I've generated an ED25519 SSH key pair for you:
- **Private key:** `ssh-keys/id_ed25519`
- **Public key:** `ssh-keys/id_ed25519.pub`

---

## 🔧 Add GitHub Secrets (3 Steps)

### Step 1: Open GitHub Secrets Page
Go to: **https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions**

Or manually:
1. Go to your repo → **Settings** (top right)
2. Left sidebar → **Secrets and variables** → **Actions**

### Step 2: Create Secrets

Click **"New repository secret"** and add these **4 secrets:**

#### Secret 1: `DEPLOY_HOST`
- **Name:** `DEPLOY_HOST`
- **Value:** `localhost`
- Click **Add secret**

#### Secret 2: `DEPLOY_USER`
- **Name:** `DEPLOY_USER`
- **Value:** `deploy`
- Click **Add secret**

#### Secret 3: `DEPLOY_PORT`
- **Name:** `DEPLOY_PORT`
- **Value:** `2222`
- Click **Add secret**

#### Secret 4: `DEPLOY_KEY`
- **Name:** `DEPLOY_KEY`
- **Value:** Copy the entire content of `ssh-keys/id_ed25519` (below)
- Click **Add secret**

---

## 🔑 Your Private SSH Key (for DEPLOY_KEY Secret)

Copy everything between the lines below and paste into GitHub:

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUtbm9uZS1ub25lAAAAAEeAAAAC2VjZHNhLXNoYTIt
bmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBG3xHXRfU3pJSSkVJZvBXGVLNW9nQU5/HU+4Iyag
ZKCeN5PQ40T6AkADmk2UO4DgSkkEaOW/2R1EoI7RdJhQMAAAAAhjLWFjdGlvbnMBAgMEBQYH
-----END OPENSSH PRIVATE KEY-----
```

---

## 🚀 Deploy with SSH (Two Options)

### Option A: Local Mock SSH Server (Recommended for Testing)

**1. Start mock SSH server in Docker:**

```bash
mkdir ssh-keys/authorized
cp ssh-keys/id_ed25519.pub ssh-keys/authorized/authorized_keys

docker run -d \
  --name gdf-ssh-server \
  -p 2222:22 \
  -v $(pwd)/ssh-keys/authorized:/home/deploy/.ssh \
  -e AUTHORIZED_KEYS="$(cat ssh-keys/id_ed25519.pub)" \
  alpine:latest sh -c '
    apk add openssh-server sudo
    adduser -D -s /bin/bash deploy
    mkdir -p /home/deploy/.ssh
    echo "$(cat ssh-keys/id_ed25519.pub)" > /home/deploy/.ssh/authorized_keys
    chmod 700 /home/deploy/.ssh
    chmod 600 /home/deploy/.ssh/authorized_keys
    chown -R deploy:deploy /home/deploy/.ssh
    echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/docker" >> /etc/sudoers.d/docker-deploy
    ssh-keygen -A
    /usr/sbin/sshd -D
  '
```

**2. Add GitHub Secrets (see Step 2 above)**

**3. Push a new tag:**

```bash
git tag -a v1.0.2 -m "Test SSH deployment"
git push origin v1.0.2
```

**4. Watch deployment:**
- Go to https://github.com/LearnPythonsuren/gdf-ticker/actions
- Click the v1.0.2 workflow run
- Watch the **Deploy** stage live

---

### Option B: Real Production Server

**On your production server:**

```bash
# As root or with sudo

# 1. Create deploy user
useradd -m -s /bin/bash deploy

# 2. Add public key
mkdir -p /home/deploy/.ssh
echo "$(cat ssh-keys/id_ed25519.pub)" > /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# 3. Allow deploy to run docker
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/docker" >> /etc/sudoers.d/docker-deploy

# 4. Ensure SSH key-auth is enabled
sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl restart ssh
```

**Then add GitHub Secrets:**
- `DEPLOY_HOST`: your server's IP or hostname
- `DEPLOY_USER`: `deploy`
- `DEPLOY_PORT`: `22` (or custom)
- `DEPLOY_KEY`: paste the private key

---

## 📋 Checklist

- [ ] Generate SSH key ✅ (done)
- [ ] Open GitHub Secrets page
- [ ] Add 4 secrets: DEPLOY_HOST, DEPLOY_USER, DEPLOY_PORT, DEPLOY_KEY
- [ ] Start mock SSH server (Option A) OR set up production server (Option B)
- [ ] Push a test tag: `git tag -a v1.0.2 && git push origin v1.0.2`
- [ ] Monitor: https://github.com/LearnPythonsuren/gdf-ticker/actions

---

## 🔍 Verify SSH Works Locally

Before committing to GitHub, test SSH locally:

```bash
ssh -i ssh-keys/id_ed25519 -p 2222 deploy@localhost

# Should show:
# deploy@gdf-ssh-server:~$
```

If successful, the deployment will work.

---

## ❌ Troubleshooting

### "Permission denied (publickey)"
- Verify SSH key is in `authorized_keys`
- Check permissions: `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`

### "Connection refused"
- Is SSH server running? `docker ps | grep gdf-ssh-server`
- Is port 2222 exposed? `docker port gdf-ssh-server`

### "docker: not found" in deploy
- SSH into production and install Docker: `sudo apt-get install docker.io`
- Add deploy user to docker group: `sudo usermod -aG docker deploy`

---

**Next:** Add the 4 GitHub Secrets above, then push v1.0.2 tag to test deployment!
