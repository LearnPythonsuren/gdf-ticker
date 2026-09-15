#!/bin/bash
# Production deployment setup script
# Run this ONCE on your production server to prepare it for CI/CD

set -e

DEPLOY_USER="${1:-deploy}"
DEPLOY_HOME="/home/$DEPLOY_USER"
APP_DIR="/app"

echo "=== GDF Ticker Production Deployment Setup ==="
echo "Deploy user: $DEPLOY_USER"
echo "App directory: $APP_DIR"
echo ""

# 1. Create deploy user if it doesn't exist
if ! id "$DEPLOY_USER" &>/dev/null; then
  echo "[1/5] Creating deploy user..."
  sudo useradd -m -s /bin/bash "$DEPLOY_USER"
  echo "  ✓ User created: $DEPLOY_USER"
else
  echo "[1/5] Deploy user already exists: $DEPLOY_USER"
fi

# 2. Add sudo privileges for docker commands (optional)
echo "[2/5] Configuring sudo..."
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/docker" | sudo tee /etc/sudoers.d/docker-$DEPLOY_USER > /dev/null
echo "  ✓ Sudo configured"

# 3. Create app directory
echo "[3/5] Setting up application directory..."
sudo mkdir -p $APP_DIR/{data/logs,data/instruments}
sudo chown -R $DEPLOY_USER:$DEPLOY_USER $APP_DIR
chmod 755 $APP_DIR
chmod 755 $APP_DIR/data
echo "  ✓ Directory structure created"

# 4. Add deploy user to docker group
echo "[4/5] Adding $DEPLOY_USER to docker group..."
sudo usermod -aG docker "$DEPLOY_USER"
echo "  ✓ Docker group membership added"
echo "  Note: User may need to log out and back in for this to take effect"

# 5. Generate SSH key for GitHub Actions
echo "[5/5] Generating SSH key for GitHub Actions..."
SSH_DIR="$DEPLOY_HOME/.ssh"
SSH_KEY="$SSH_DIR/github-deploy"

if [ -f "$SSH_KEY" ]; then
  echo "  ! SSH key already exists: $SSH_KEY"
else
  sudo mkdir -p "$SSH_DIR"
  sudo ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$SSH_KEY" -N "" -q
  sudo chmod 600 "$SSH_KEY"
  sudo chmod 700 "$SSH_DIR"
  
  echo "  ✓ SSH key generated"
  echo ""
  echo "=== PRIVATE KEY (add this as DEPLOY_KEY GitHub secret) ==="
  sudo cat "$SSH_KEY"
  echo ""
  echo "=== PUBLIC KEY (already in authorized_keys) ==="
  sudo cat "$SSH_KEY.pub"
fi

# 6. Add public key to authorized_keys
echo ""
echo "[EXTRA] Adding SSH public key to authorized_keys..."
sudo bash -c "cat $SSH_KEY.pub >> $DEPLOY_HOME/.ssh/authorized_keys"
sudo chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys"
sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
echo "  ✓ Public key added to authorized_keys"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Copy the PRIVATE KEY above and add it as DEPLOY_KEY secret in GitHub"
echo "2. Configure these secrets in GitHub (Settings → Secrets):"
echo "   - DEPLOY_HOST: $(hostname -I | awk '{print $1}')"
echo "   - DEPLOY_USER: $DEPLOY_USER"
echo "   - DEPLOY_KEY: (the private key above)"
echo ""
echo "3. Clone the repo into $APP_DIR:"
echo "   sudo -u $DEPLOY_USER git clone <repo-url> $APP_DIR"
echo ""
echo "4. Or push files via SCP:"
echo "   scp docker-compose.yml .env $DEPLOY_USER@$(hostname -I | awk '{print $1}'):$APP_DIR/"
echo ""
