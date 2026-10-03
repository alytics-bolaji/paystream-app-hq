#!/usr/bin/env bash
# deploy-backend-remote.sh -- runs ON the EC2 box, called by the GitHub Actions
# deploy-backend workflow. Drops the new release, flips the 'current' symlink,
# restarts the service, and rolls back if the health check fails.
set -euo pipefail

RELEASE="${1:?usage: deploy-backend-remote.sh <release-id>}"
APP=/opt/paystream/backend
DEST="$APP/releases/$RELEASE"

echo "==> Unpacking release $RELEASE"
mkdir -p "$DEST"
unzip -oq /tmp/backend.zip -d "$DEST"

echo "==> Pointing 'current' at the new release"
ln -sfn "$DEST" "$APP/current"

echo "==> Restarting the service"
sudo systemctl restart paystream-api
sleep 2

echo "==> Health check"
if curl -fs http://localhost:3000/health >/dev/null; then
  echo "    OK - $RELEASE is live"
else
  echo "    FAILED - rolling back" >&2
  PREV=$(ls -1dt "$APP"/releases/*/ | sed -n '2p' || true)
  if [ -n "${PREV:-}" ]; then
    ln -sfn "${PREV%/}" "$APP/current"
    sudo systemctl restart paystream-api
    echo "    rolled back to $(basename "${PREV%/}")" >&2
  fi
  exit 1
fi

echo "==> Pruning old releases (keeping the 5 newest)"
ls -1dt "$APP"/releases/*/ | tail -n +6 | xargs -r rm -rf
rm -f /tmp/backend.zip
echo "Done."
