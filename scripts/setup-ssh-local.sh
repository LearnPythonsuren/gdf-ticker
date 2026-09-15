#!/bin/bash
set -e

KEYS_DIR="./ssh-keys"
mkdir -p "$KEYS_DIR"

# Generate SSH key pair for GitHub Actions
if [ ! -f "$KEYS_DIR/id_ed25519" ]; then
    echo "Generating SSH key pair..."
    ssh-keygen -t ed25519 -f "$KEYS_DIR/id_ed25519" -N "" -C "github-actions"
    chmod 600 "$KEYS_DIR/id_ed25519"
    chmod 644 "$KEYS_DIR/id_ed25519.pub"
    echo "✓ SSH keys generated:"
    echo "  Private: $KEYS_DIR/id_ed25519"
    echo "  Public:  $KEYS_DIR/id_ed25519.pub"
else
    echo "✓ SSH keys already exist"
fi

# Build SSH server image
echo ""
echo "Building SSH server Docker image..."
docker build -f docker/Dockerfile.ssh-server -t gdf-ssh-server:latest .

# Create authorized_keys
mkdir -p ssh-keys/authorized
cp "$KEYS_DIR/id_ed25519.pub" ssh-keys/authorized/authorized_keys

echo ""
echo "✓ SSH server image built: gdf-ssh-server:latest"
echo ""
echo "To start the SSH server (mock production):"
echo "  docker run -d --name gdf-ssh-server -p 2222:22 -v ssh-keys/authorized:/home/deploy/.ssh gdf-ssh-server"
echo ""
echo "To add GitHub Secrets, copy the PRIVATE KEY below:"
echo "=================================================="
cat "$KEYS_DIR/id_ed25519"
echo "=================================================="
echo ""
echo "GitHub Secret values:"
echo "  DEPLOY_HOST: localhost"
echo "  DEPLOY_USER: deploy"
echo "  DEPLOY_PORT: 2222"
echo "  DEPLOY_KEY: [paste the private key above]"
