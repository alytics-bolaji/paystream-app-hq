#!/usr/bin/env bash
# bootstrap-ec2.sh -- ONE-TIME setup of a fresh Ubuntu EC2 instance.
#
# The DATA tier (PostgreSQL + Redis) runs as Docker containers.
# The APP tier (backend API + frontend) runs NATIVELY (systemd + Nginx) --
# those get containerised later, in the Docker week.
#
# Run it once, from a checkout of this repo on the box:
#   git clone <your-repo> paystream && cd paystream
#   bash deploy/bootstrap-ec2.sh
#
# After this, the GitHub Actions workflows deploy new app versions on every push.
set -euo pipefail

DB_PASSWORD="${DB_PASSWORD:-change-me-in-prod}"   # override: DB_PASSWORD=... bash bootstrap-ec2.sh

echo "==> 1/6 Installing Node 20, Docker and Nginx"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get update
sudo apt-get install -y nodejs docker.io nginx unzip
sudo systemctl enable --now docker nginx

echo "==> 2/6 Creating the 'paystream' service user"
sudo useradd --system --no-create-home --shell /usr/sbin/nologin paystream || true

echo "==> 3/6 Starting the PostgreSQL and Redis containers"
sudo DB_PASSWORD="${DB_PASSWORD}" bash deploy/data-stores-up.sh
echo "    waiting for PostgreSQL to accept connections..."
until sudo docker exec paystream-postgres pg_isready -U paystream >/dev/null 2>&1; do sleep 1; done

echo "==> 4/6 Loading the schema and seed into the database"
sudo docker exec -i paystream-postgres psql -U paystream -d paystream < db/schema.sql
sudo docker exec -i paystream-postgres psql -U paystream -d paystream < db/seed.sql

echo "==> 5/6 App directories, env file, and the systemd service"
sudo mkdir -p /opt/paystream/backend/releases /opt/paystream/backend/shared /var/www/paystream
sudo tee /opt/paystream/backend/shared/.env >/dev/null <<EOF
PORT=3000
DATABASE_URL=postgres://paystream:${DB_PASSWORD}@localhost:5432/paystream
REDIS_URL=redis://localhost:6379
CACHE_TTL=60
CORS_ORIGIN=*
EOF
sudo chown -R paystream:paystream /opt/paystream
sudo chmod -R 775 /opt/paystream/backend/releases
sudo cp deploy/paystream-api.service /etc/systemd/system/paystream-api.service
sudo systemctl daemon-reload
sudo systemctl enable paystream-api   # it starts for real once a release is deployed

echo "==> 6/6 Configuring Nginx"
sudo cp deploy/nginx-paystream.conf /etc/nginx/sites-available/paystream
sudo ln -sfn /etc/nginx/sites-available/paystream /etc/nginx/sites-enabled/paystream
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "Bootstrap complete."
echo "  data tier : postgres + redis  (Docker containers)"
echo "  app tier  : backend + frontend (native: systemd + Nginx)"
echo "Now push to main (or run the deploy workflows) to ship the app."
echo "The site will be at  http://<this-instance-public-ip>/"
