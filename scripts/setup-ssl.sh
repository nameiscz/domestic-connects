#!/bin/bash
# ============================================================================
# Domestic Connects — SSL Setup Script
#
# Generates self-signed cert for testing, then optionally replaces with
# Let's Encrypt (real) certificate.
#
# Usage:
#   chmod +x scripts/setup-ssl.sh
#   ./scripts/setup-ssl.sh self-signed     # Quick test with self-signed cert
#   ./scripts/setup-ssl.sh letsencrypt     # Real SSL with Let's Encrypt
# ============================================================================

set -euo pipefail

DOMAIN="${1:-self-signed}"
SSL_DIR="docker/nginx/ssl"

echo "============================================"
echo "  Domestic Connects — SSL Setup"
echo "============================================"

# ---------- Create SSL directory ----------
mkdir -p "$SSL_DIR"
mkdir -p docker/nginx/certbot
mkdir -p docker/nginx/logs

# ---------- Self-Signed Certificate ----------
setup_self_signed() {
    echo ""
    echo "[1/2] Generating self-signed certificate..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/self-signed.key" \
        -out "$SSL_DIR/self-signed.crt" \
        -subj "/C=US/ST=Local/L=Local/O=DomesticConnects/CN=localhost"
    
    echo "✅ Self-signed certificate created"
    echo "   Certificate: $SSL_DIR/self-signed.crt"
    echo "   Key:         $SSL_DIR/self-signed.key"
    echo ""
    echo "⚠️  Browser will show 'Not Secure' warning (expected for self-signed)"
}

# ---------- Let's Encrypt Certificate ----------
setup_letsencrypt() {
    echo ""
    echo "Before proceeding, ensure:"
    echo "  1. Your domain (e.g., api.yourdomain.com) points to this server's IP"
    echo "  2. Ports 80 and 443 are open in Oracle Cloud security list"
    echo ""
    read -p "Enter your domain name (e.g., api.yourdomain.com): " DOMAIN_NAME
    
    if [ -z "$DOMAIN_NAME" ]; then
        echo "❌ Domain name is required"
        exit 1
    fi
    
    echo ""
    echo "[1/3] Installing certbot..."
    sudo apt-get install -y certbot
    
    echo ""
    echo "[2/3] Obtaining certificate..."
    sudo certbot certonly --standalone \
        -d "$DOMAIN_NAME" \
        --email "admin@${DOMAIN_NAME}" \
        --agree-tos \
        --no-eff-email
    
    echo ""
    echo "[3/3] Copying certificates..."
    sudo cp "/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem" "$SSL_DIR/fullchain.pem"
    sudo cp "/etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem" "$SSL_DIR/privkey.pem"
    sudo chown $USER:$USER "$SSL_DIR"/*
    
    echo "✅ Let's Encrypt certificate obtained"
    echo "   Certificate: $SSL_DIR/fullchain.pem"
    echo "   Key:         $SSL_DIR/privkey.pem"
    
    # Update nginx config to use real domain
    sed -i "s/domestic-connects.com/${DOMAIN_NAME}/g" docker/nginx/nginx.conf
    echo "✅ Updated nginx.conf with domain: ${DOMAIN_NAME}"
}

# ---------- Main ----------
case "${DOMAIN}" in
    self-signed|test)
        setup_self_signed
        echo ""
        echo "Next steps:"
        echo "  1. Update docker-compose.yml to add nginx service (see below)"
        echo "  2. Run: docker compose up -d nginx"
        echo "  3. Test: curl -k https://localhost/api/actuator/health"
        ;;
    letsencrypt|production)
        setup_letsencrypt
        echo ""
        echo "Next steps:"
        echo "  1. Update docker-compose.yml to add nginx service (see below)"
        echo "  2. Run: docker compose up -d nginx"
        echo "  3. Test: curl https://your-domain.com/api/actuator/health"
        echo "  4. Setup auto-renewal: sudo crontab -e"
        echo "     Add: 0 0,12 * * * certbot renew --quiet"
        ;;
    *)
        echo "Usage: $0 [self-signed|letsencrypt]"
        echo ""
        echo "  self-signed   Generate self-signed cert (for testing)"
        echo "  letsencrypt   Get real SSL cert from Let's Encrypt"
        exit 1
        ;;
esac

echo ""
echo "============================================"
echo "  SSL Setup Complete!"
echo "============================================"
