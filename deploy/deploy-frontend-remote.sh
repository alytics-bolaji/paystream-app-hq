#!/usr/bin/env bash
# deploy-frontend-remote.sh -- runs ON the EC2 box, called by the
# deploy-frontend workflow. Replaces the static files Nginx serves.
set -euo pipefail

WEB=/var/www/paystream

echo "==> Replacing the frontend in $WEB"
sudo rm -rf "${WEB:?}/"*
sudo unzip -oq /tmp/frontend.zip -d "$WEB"

echo "==> Reloading Nginx"
sudo nginx -t
sudo systemctl reload nginx

rm -f /tmp/frontend.zip
echo "Frontend deployed."
