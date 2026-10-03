#!/usr/bin/env bash
# deploy-backend-remote.sh -- runs ON the EC2 box, called by the GitHub Actions
# deploy-backend workflow. Drops the new release, flips the 'current' symlink,
# restarts the service, and rolls back if the health check fails.
set -euo pipefail

# Run as root so we can write under /opt and manage systemd. This works whether
# the script is piped in as `sudo bash -s` (already root) or run from a file by
# a normal user (we re-exec under sudo). When piped via stdin $0 is "bash" and
# there is no file to re-exec, but in that case we are already root, so fine.
if [ "$(id -u)" -ne 0 ] && [ -f "$0" ]; then exec sudo -E bash "$0" "$@"; fi

# A release id can be passed as $1; if not, we mint a timestamped one ourselves.
RELEASE="${1:-$(date +%Y%m%d-%H%M%S)}"
APP=/opt/paystream/backend
DEST="$APP/releases/$RELEASE"

echo "==> Unpacking release $RELEASE"
mkdir -p "$DEST"
unzip -oq /tmp/backend.zip -d "$DEST"
chown -R paystream:paystream "$DEST"

echo "==> Pointing 'current' at the new release"
ln -sfn "$DEST" "$APP/current"
chown -h paystream:paystream "$APP/current"

echo "==> Restarting the service"
systemctl restart paystream-api
sleep 2

echo "==> Health check"
if curl -fs http://localhost:3000/health >/dev/null; then
  echo "    OK - $RELEASE is live"
else
  echo "    FAILED - rolling back" >&2
  PREV=$(ls -1dt "$APP"/releases/*/ | sed -n '2p' || true)
  if [ -n "${PREV:-}" ]; then
    ln -sfn "${PREV%/}" "$APP/current"
    systemctl restart paystream-api
    echo "    rolled back to $(basename "${PREV%/}")" >&2
  fi
  exit 1
fi

echo "==> Pruning old releases (keeping the 5 newest)"
ls -1dt "$APP"/releases/*/ | tail -n +6 | xargs -r rm -rf
rm -f /tmp/backend.zip
echo "Done."
