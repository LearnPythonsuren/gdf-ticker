@echo off
REM Simple SSH server setup for GitHub Actions deployment testing (Windows/CMD)

setlocal enabledelayedexpansion

echo === GitHub SSH Deployment Setup ===
echo.

REM Check if ssh-keygen exists
where ssh-keygen >nul 2>nul
if errorlevel 1 (
    echo ERROR: ssh-keygen not found. Install OpenSSH.
    exit /b 1
)

REM Setup directories
echo [1/5] Setting up SSH directories...
if not exist "ssh-keys" mkdir ssh-keys
if not exist "ssh-keys\authorized" mkdir ssh-keys\authorized

echo [2/5] Generating SSH key...
if not exist "ssh-keys\id_ed25519" (
    ssh-keygen -t ed25519 -f ssh-keys\id_ed25519 -N "" -C "github-actions"
    echo OK: SSH key generated
) else (
    echo OK: SSH key already exists
)

echo [3/5] Adding public key to authorized_keys...
type ssh-keys\id_ed25519.pub > ssh-keys\authorized\authorized_keys

echo [4/5] Creating docker-compose.ssh.yml...
(
echo services:
echo   gdf-ssh-server:
echo     image: alpine:3.19
echo     container_name: gdf-ssh-server
echo     ports:
echo       - "2222:22"
echo     volumes:
echo       - ./ssh-keys/authorized:/home/deploy/.ssh
echo       - /var/run/docker.sock:/var/run/docker.sock
echo     entrypoint: /bin/sh
echo     command:
echo       - -c
echo       - ^|
echo         apk add --no-cache openssh-server openssh-keygen sudo
echo         adduser -D -s /bin/bash deploy
echo         mkdir -p /home/deploy/.ssh
echo         chmod 700 /home/deploy/.ssh
echo         chown deploy:deploy /home/deploy/.ssh
echo         ssh-keygen -A
echo         echo 'deploy ALL=(ALL) NOPASSWD: /usr/bin/docker' ^> /etc/sudoers.d/docker-deploy
echo         chmod 440 /etc/sudoers.d/docker-deploy
echo         /usr/sbin/sshd -D
echo     restart: unless-stopped
) > docker-compose.ssh.yml

echo OK: docker-compose.ssh.yml created
echo.
echo [5/5] Setup complete!
echo.
echo === Next Steps ===
echo.
echo 1. Start SSH server:
echo    docker compose -f docker-compose.ssh.yml up -d
echo.
echo 2. Test SSH locally:
echo    ssh -i ssh-keys\id_ed25519 -p 2222 deploy@localhost
echo.
echo 3. Add GitHub Secrets:
echo    https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions
echo.
echo    Create 4 secrets:
echo    - DEPLOY_HOST: localhost
echo    - DEPLOY_USER: deploy
echo    - DEPLOY_PORT: 2222
echo    - DEPLOY_KEY: [copy entire content of ssh-keys\id_ed25519]
echo.
echo === Your Private SSH Key ===
type ssh-keys\id_ed25519
echo.
echo === End of Private Key ===
echo.
echo 4. Push a test tag:
echo    git tag -a v1.0.2 -m test
echo    git push origin v1.0.2
echo.
echo 5. Watch deployment:
echo    https://github.com/LearnPythonsuren/gdf-ticker/actions
