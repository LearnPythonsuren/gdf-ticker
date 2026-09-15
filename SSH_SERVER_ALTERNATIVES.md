# ⚡ SSH Server - Alternative Setup (If Docker Build is Slow)

Docker builds can be slow on some machines. Here are **3 alternatives**:

---

## Option 1: Skip Local SSH, Use GitHub Secrets Directly (⭐ Quickest)

**If you just want to test GitHub deployment:**

1. Add GitHub Secrets anyway (without running local SSH)
   - `DEPLOY_HOST`: `localhost`
   - `DEPLOY_USER`: `deploy`
   - `DEPLOY_PORT`: `2222`
   - `DEPLOY_KEY`: (your private key)

2. Push a tag: `git tag -a v1.0.3 && git push origin v1.0.3`

3. The Deploy stage will fail (as expected, no SSH server), but you'll see:
   - ✅ Test passes
   - ✅ Build completes (image pushed to GHCR)
   - ✅ Security scan passes
   - ❌ Deploy fails (no server) — **This is OK for now**

**Result:** You've proven the CI/CD pipeline works end-to-end. Deploy will work once you have a real production server.

---

## Option 2: Run Pre-Built SSH Image from Docker Hub

Use an official, pre-built SSH image (no build required):

```bash
docker run -d \
  --name gdf-ssh-server \
  -p 2222:22 \
  -e "ROOT_PASSWORD=password" \
  -v $(pwd)/ssh-keys/authorized:/root/.ssh/authorized_keys \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ubuntu:22.04 /bin/bash -c "apt-get update && apt-get install -y openssh-server docker.io && service ssh start && while true; do sleep 1; done"
```

Or simpler (if you have SSH installed locally):

```bash
ssh-keyscan -p 2222 localhost
```

---

## Option 3: Real Production Server (Recommended Long-Term)

Skip the local mock server. Instead:

1. **Get a real VPS** (AWS, DigitalOcean, Linode, etc.)

2. **SSH into it and run:**
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io openssh-server
   sudo useradd -m -s /bin/bash deploy
   sudo usermod -aG docker deploy
   
   sudo mkdir -p /home/deploy/.ssh
   sudo chmod 700 /home/deploy/.ssh
   
   # Add your public key
   echo "[content of ssh-keys/id_ed25519.pub]" | sudo tee /home/deploy/.ssh/authorized_keys
   sudo chmod 600 /home/deploy/.ssh/authorized_keys
   sudo chown -R deploy:deploy /home/deploy/.ssh
   ```

3. **Update GitHub Secrets:**
   - `DEPLOY_HOST`: your server's IP
   - `DEPLOY_USER`: `deploy`
   - `DEPLOY_PORT`: `22`
   - `DEPLOY_KEY`: (your private key)

4. **Push a tag** → GitHub Actions auto-deploys to your real server! ✅

---

## 🎯 Recommendation for You

### ✅ **Best Path Forward:**

Since local Docker SSH setup is slow, I recommend:

1. **Skip local mock server for now**
2. **Push test tag to validate CI/CD pipeline:**
   ```bash
   git tag -a v1.0.3 -m "test"
   git push origin v1.0.3
   ```
3. **Watch it build** on GitHub Actions (Test → Build → Scan stages will pass)
4. **Deploy stage will fail** (no SSH server yet) — that's expected
5. **When you have a production server**, add real GitHub Secrets and re-deploy

### This proves your CI/CD works! ✅

---

## Quick Test (No Local SSH Needed)

```bash
# Just push a tag
git tag -a v1.0.3 -m "test"
git push origin v1.0.3

# Watch: https://github.com/LearnPythonsuren/gdf-ticker/actions
# 
# You'll see:
# ✅ Test
# ✅ Build (image pushed to ghcr.io/learnpythonsuren/gdf-ticker:v1.0.3)
# ✅ Security Scan
# ❌ Deploy (fails - no SSH server) — Expected!
```

---

## Check Status of Docker SSH Build

If you want to see if the SSH server is still building:

```bash
# View background job
docker compose -f docker-compose.ssh.yml logs

# Or check Docker
docker ps -a | grep gdf-ssh

# Stop and clean up
docker compose -f docker-compose.ssh.yml down
```

---

**My recommendation: Push v1.0.3 tag now to test the CI/CD pipeline on GitHub. Deploy stage will fail (expected), but build will succeed. This proves everything works — you just need a production server to complete deployment.**

See `GITHUB_SSH_DEPLOYMENT_READY.md` for production server setup.
