#!/bin/bash
# ============================================================================
# Domestic Connects — Oracle Cloud Always Free ARM Deployment Script
#
# Run this on a fresh Oracle Cloud ARM A1 Flex instance (Ubuntu 22.04/24.04)
# with 4 OCPU + 24GB RAM + 200GB boot volume.
#
# Usage:
#   chmod +x deploy-oracle.sh
#   ./deploy-oracle.sh
# ============================================================================

set -euo pipefail

echo "============================================"
echo "  Domestic Connects — Oracle Cloud Deploy"
echo "============================================"

# ---------- 1. System Updates & Docker ----------
echo ""
echo "[1/6] Updating system and installing Docker..."
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y docker.io docker-compose-plugin git curl

# Enable Docker without requiring sudo
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

echo "✅ Docker installed: $(docker --version)"
echo "✅ Docker Compose: $(docker compose version)"

# Install OpenSSL for SSL certificate generation
sudo apt-get install -y openssl

# ---------- 2. Firewall Rules ----------
echo ""
echo "[2/6] Configuring firewall rules..."

# Oracle Cloud uses iptables. Open required ports.
# 8080 = API Gateway (main entry point)
# 3306 = MySQL (for external DB tools, optional)
# 22   = SSH (already open)

sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3306 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Persist iptables rules
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

echo "✅ Firewall configured (ports 8080, 3306, 80, 443 open)"

# ---------- 3. Setup SSL (Self-Signed for testing) ----------
echo ""
echo "[3/7] Setting up SSL certificates..."
SSL_DIR="/opt/domestic-connects/docker/nginx/ssl"
mkdir -p "$SSL_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/self-signed.key" \
    -out "$SSL_DIR/self-signed.crt" \
    -subj "/C=US/ST=Local/L=Local/O=DomesticConnects/CN=localhost"

echo "✅ Self-signed SSL certificate generated"

# ---------- 4. Clone Repository ----------
echo ""
echo "[4/7] Cloning repository..."
cd /opt
if [ -d "domestic-connects" ]; then
    cd domestic-connects
    git pull origin main
else
    git clone https://github.com/nameiscz/domestic-connects.git
    cd domestic-connects
fi

echo "✅ Repository ready at /opt/domestic-connects"

# ---------- 5. Build Docker Images ----------
echo ""
echo "[5/7] Building Docker images (this takes 10-15 minutes)..."
docker compose build --parallel

echo "✅ All Docker images built"

# ---------- 6. Start Services ----------
echo ""
echo "[6/7] Starting all services with Nginx..."
# Start with nginx reverse proxy
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d

echo "✅ Services starting..."

# ---------- 7. Health Check ----------
echo ""
echo "[7/7] Waiting for services to be healthy..."
echo "This may take 2-3 minutes for all Java services to start..."
echo ""

# Wait for Eureka
echo -n "Waiting for Eureka Server..."
for i in {1..60}; do
    if curl -s http://localhost:8761/actuator/health >/dev/null 2>&1; then
        echo " ✅"
        break
    fi
    echo -n "."
    sleep 5
done

# Wait for Config Server
echo -n "Waiting for Config Server..."
for i in {1..60}; do
    if curl -s http://localhost:8888/actuator/health >/dev/null 2>&1; then
        echo " ✅"
        break
    fi
    echo -n "."
    sleep 5
done

# Wait for API Gateway
echo -n "Waiting for API Gateway..."
for i in {1..60}; do
    if curl -s http://localhost:8080/actuator/health >/dev/null 2>&1; then
        echo " ✅"
        break
    fi
    echo -n "."
    sleep 5
done

# ---------- Wait for Nginx ----------
echo -n "Waiting for Nginx..."
for i in {1..30}; do
    if curl -sk https://localhost/health >/dev/null 2>&1; then
        echo " ✅"
        break
    fi
    echo -n "."
    sleep 5
done

# ---------- Summary ----------
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || curl -s https://api.ipify.org)

echo ""
echo "============================================"
echo "  ✅ Deployment Complete!"
echo "============================================"
echo ""
echo "  API (via Nginx):  https://${PUBLIC_IP}"
echo "  API (direct):     http://${PUBLIC_IP}:8080"
echo "  Eureka:           http://${PUBLIC_IP}:8761"
echo "  Config:           http://${PUBLIC_IP}:8888"
echo ""
echo "  Frontend (Vercel): Set VITE_API_BASE_URL=https://${PUBLIC_IP}"
echo ""
echo "  Health check: curl -k https://${PUBLIC_IP}/health"
echo ""
echo "  ⚠️  Using self-signed cert. Browser will show warning."
echo "  To get real SSL: sudo certbot --nginx -d your-domain.com"
echo ""
echo "  View logs:    docker compose logs -f"
echo "  Stop:         docker compose down"
echo "  Restart:      docker compose restart"
echo "============================================"
