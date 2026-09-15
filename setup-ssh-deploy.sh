#!/bin/bash
# Simple SSH server setup for GitHub Actions deployment testing
# Run this on your local machine or production server

set -e

echo "=== GitHub SSH Deployment Setup ==="
echo ""

# Check if ssh-keygen exists
if ! command -v ssh-keygen &> /dev/null; then
    echo "ERROR: ssh-keygen not found. Install OpenSSH."
    exit 1
fi

# Setup SSH directories
echo "[1/5] Setting up SSH directories..."
mkdir -p ~/.ssh ssh-keys/authorized
chmod 700 ~/.ssh

# Generate SSH key if not exists
echo "[2/5] Generating SSH key for GitHub..."
if [ ! -f ssh-keys/id_ed25519 ]; then
    ssh-keygen -t ed25519 -f ssh-keys/id_ed25519 -N "" -C "github-actions"
    chmod 600 ssh-keys/id_ed25519
    chmod 644 ssh-keys/id_ed25519.pub
    echo "✓ SSH key generated"
else
    echo "✓ SSH key already exists"
fi

# Add public key to authorized_keys
echo "[3/5] Adding public key to authorized_keys..."
mkdir -p ssh-keys/authorized
cat ssh-keys/id_ed25519.pub > ssh-keys/authorized/authorized_keys
chmod 600 ssh-keys/authorized/authorized_keys

# Create docker-compose for SSH server
echo "[4/5] Creating Docker SSH server compose file..."
cat > docker-compose.ssh.yml <<'EOF'
services:
  gdf-ssh-server:
    image: alpine:3.19
    container_name: gdf-ssh-server
    ports:
      - "2222:22"
    volumes:
      - ./ssh-keys/authorized:/home/deploy/.ssh
      - /var/run/docker.sock:/var/run/docker.sock
    entrypoint: /bin/sh
    command:
      - -c
      - |
        apk add --no-cache openssh-server openssh-keygen sudo
        adduser -D -s /bin/bash deploy
        mkdir -p /home/deploy/.ssh
        chmod 700 /home/deploy/.ssh
        chown deploy:deploy /home/deploy/.ssh
        ssh-keygen -A
        echo 'deploy ALL=(ALL) NOPASSWD: /usr/bin/docker' > /etc/sudoers.d/docker-deploy
        chmod 440 /etc/sudoers.d/docker-deploy
        /usr/sbin/sshd -D
    restart: unless-stopped
EOF

echo "✓ docker-compose.ssh.yml created"

# Instructions
echo ""
echo "[5/5] Setup complete!"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Start SSH server:"
echo "   docker compose -f docker-compose.ssh.yml up -d"
echo ""
echo "2. Test SSH locally:"
echo "   ssh -i ssh-keys/id_ed25519 -p 2222 deploy@localhost"
echo ""
echo "3. Add GitHub Secrets:"
echo "   https://github.com/LearnPythonsuren/gdf-ticker/settings/secrets/actions"
echo ""
echo "   Create 4 secrets:"
echo "   - DEPLOY_HOST: localhost"
echo "   - DEPLOY_USER: deploy"
echo "   - DEPLOY_PORT: 2222"
echo "   - DEPLOY_KEY: [copy entire content of ssh-keys/id_ed25519 below]"
echo ""
echo "=== Your Private SSH Key ==="
cat ssh-keys/id_ed25519
echo ""
echo "=== End of Private Key ==="
echo ""
echo "4. Push a test tag to trigger deployment:"
echo "   git tag -a v1.0.2 -m test"
echo "   git push origin v1.0.2"
echo ""
echo "5. Watch deployment:"
echo "   https://github.com/LearnPythonsuren/gdf-ticker/actions"
