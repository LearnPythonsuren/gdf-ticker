# ⚡ GitHub SSH Deployment - Quick Command Reference

## Start SSH Server
```cmd
docker compose -f docker-compose.ssh.yml up -d
```

## Test SSH Locally
```cmd
ssh -i ssh-keys/id_ed25519 -p 2222 deploy@localhost
```

## Push a Deployment Tag
```cmd
git tag -a v1.0.3 -m "Test"
git push origin v1.0.3
```

## Check Workflow Status
**URL:** https://github.com/LearnPythonsuren/gdf-ticker/actions

## Add GitHub Secrets
**URL:** https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions

**Secrets to add:**
```
DEPLOY_HOST = localhost
DEPLOY_USER = deploy
DEPLOY_PORT = 2222
DEPLOY_KEY = [content of ssh-keys/id_ed25519]
```

## View SSH Server Logs
```cmd
docker compose -f docker-compose.ssh.yml logs -f gdf-ssh-server
```

## Stop SSH Server
```cmd
docker compose -f docker-compose.ssh.yml down
```

## SSH Into Server & Check Docker
```cmd
ssh -i ssh-keys/id_ed25519 -p 2222 deploy@localhost
docker compose ps
docker compose logs -f gdf-ticker
exit
```

## View Private Key (for DEPLOY_KEY secret)
```cmd
type ssh-keys/id_ed25519
```

## View Public Key
```cmd
type ssh-keys/id_ed25519.pub
```

## Regenerate SSH Keys (if needed)
```cmd
ssh-keygen -t ed25519 -f ssh-keys/id_ed25519-new -N "" -C "github-actions"
```

## Delete All Tags (start fresh)
```cmd
git tag -d v1.0.1 v1.0.2 v1.0.3
git push origin --delete v1.0.1 v1.0.2 v1.0.3
```

---

## Full Deployment Checklist

- [ ] SSH server running: `docker compose -f docker-compose.ssh.yml ps`
- [ ] SSH test works: `ssh -i ssh-keys/id_ed25519 -p 2222 deploy@localhost`
- [ ] 4 GitHub Secrets added: https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions
- [ ] New tag pushed: `git push origin v1.0.3`
- [ ] Workflow running: https://github.com/LearnPythonsuren/gdf-ticker/actions
- [ ] All 4 stages green (Test, Build, Scan, Deploy)
- [ ] Container running on SSH server

---

## Redeployment (Repeat Steps)

After initial setup, deployment is just:

```cmd
# Make code changes, commit, tag, and push
git add .
git commit -m "New feature"
git tag -a v1.0.4 -m "New feature"
git push origin v1.0.4

# GitHub Actions auto-deploys! Watch at: https://github.com/LearnPythonsuren/gdf-ticker/actions
```

---

## Key URLs

| Purpose | URL |
|---------|-----|
| GitHub Repo | https://github.com/LearnPythonsuren/gdf-ticker |
| Actions/Workflows | https://github.com/LearnPythonsuren/gdf-ticker/actions |
| GitHub Secrets | https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions |
| Docker Images | https://github.com/LearnPythonsuren/gdf-ticker/pkgs/container/gdf-ticker |
| Security Scans | https://github.com/LearnPythonsuren/gdf-ticker/security |
| Releases | https://github.com/LearnPythonsuren/gdf-ticker/releases |

---

**Bookmark this file for quick reference!**
