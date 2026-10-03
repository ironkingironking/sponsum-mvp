#!/usr/bin/env bash
# Deploy Sponsum desk + API onto suite.movena.ch
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_HOST="${DEPLOY_HOST:-alexadmin@78.46.219.23}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/docker/movena-sponsum}"
LOCK_APP="${LOCK_APP:-suite}"
APPLY=0
SKIP_LOCK="${SKIP_LOCK:-0}"
INSTALL_NGINX="${INSTALL_NGINX:-1}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --dry-run) APPLY=0; shift ;;
    *) echo "Usage: deploy-sponsum.sh [--dry-run|--apply]" >&2; exit 64 ;;
  esac
done

cd "$ROOT_DIR"
test -f apps/api/src/index.ts
test -f apps/api/public/sponsum/index.html
test -f deploy/nginx/movena-sponsum.conf
test -f deploy/systemd/movena-sponsum.service

if [[ "$APPLY" -ne 1 ]]; then
  echo "Dry-run OK. Pass --apply to deploy."
  exit 0
fi

STAMP="$(date +%Y%m%dT%H%M%SZ)"
REMOTE_RELEASE="${DEPLOY_PATH}/releases/release-${STAMP}"
REMOTE_STAGING="/tmp/movena-sponsum-${STAMP}"

ssh -o BatchMode=yes "$DEPLOY_HOST" "mkdir -p '${DEPLOY_PATH}/releases' '${REMOTE_STAGING}'"

if [[ "$SKIP_LOCK" != "1" ]]; then
  ssh -o BatchMode=yes "$DEPLOY_HOST" "/home/alexadmin/bin/codex-app-lock acquire '${LOCK_APP}' 'deploy movena-sponsum ${STAMP}'"
  cleanup_lock() {
    ssh -o BatchMode=yes "$DEPLOY_HOST" "/home/alexadmin/bin/codex-app-lock release '${LOCK_APP}'" || true
  }
  trap cleanup_lock EXIT
fi

SUITE_APPS="${SUITE_APPS:-/home/ironking/Documents/Movena Suite/apps.json}"
rsync -az --delete \
  --exclude node_modules \
  --exclude .env \
  --exclude apps/web \
  --exclude playwright-report \
  --exclude test-results \
  --exclude e2e \
  --exclude '**/*.log' \
  "$ROOT_DIR/" \
  "$DEPLOY_HOST:${REMOTE_STAGING}/"
if [[ -f "$SUITE_APPS" ]]; then
  scp -o BatchMode=yes "$SUITE_APPS" "$DEPLOY_HOST:/opt/docker/movena-suite/apps.json"
fi

ssh -o BatchMode=yes "$DEPLOY_HOST" bash -s <<EOF
set -euo pipefail
mkdir -p '${REMOTE_RELEASE}'
rsync -a --delete '${REMOTE_STAGING}/' '${REMOTE_RELEASE}/'
ln -sfn '${REMOTE_RELEASE}' '${DEPLOY_PATH}/current'
cd '${DEPLOY_PATH}/current'
python3 - <<'PY'
import json
from pathlib import Path
p = Path("package.json")
data = json.loads(p.read_text())
data["workspaces"] = ["apps/api", "packages/*"]
p.write_text(json.dumps(data, indent=2) + "\n")
PY
npm install --omit=dev --no-audit --no-fund

mkdir -p '${DEPLOY_PATH}/data'
if [[ ! -f '${DEPLOY_PATH}/.env' ]]; then
  cp '${REMOTE_RELEASE}/deploy/env.production.example' '${DEPLOY_PATH}/.env'
  SECRET=\$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(36))
PY
)
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\${SECRET}|" '${DEPLOY_PATH}/.env'
fi
if ! grep -q '^SPONSUM_STORE_PATH=' '${DEPLOY_PATH}/.env'; then
  echo 'SPONSUM_STORE_PATH=${DEPLOY_PATH}/data/store.json' >> '${DEPLOY_PATH}/.env'
fi
if ! grep -q '^MOVENA_ERPNEXT_URL=' '${DEPLOY_PATH}/.env'; then
  echo 'MOVENA_ERPNEXT_URL=http://127.0.0.1:8090' >> '${DEPLOY_PATH}/.env'
fi
if ! grep -q '^MOVENA_ERPNEXT_SITE=' '${DEPLOY_PATH}/.env'; then
  echo 'MOVENA_ERPNEXT_SITE=erp.movena.ch' >> '${DEPLOY_PATH}/.env'
fi
if ! grep -q '^SKRIBBLE_USERNAME=' '${DEPLOY_PATH}/.env' && [[ -f /opt/docker/movena-growth/.env ]]; then
  grep -E '^SKRIBBLE_(USERNAME|API_KEY|BASE_URL|QUALITY|LEGISLATION)=' /opt/docker/movena-growth/.env >> '${DEPLOY_PATH}/.env' || true
fi
if ! grep -q '^API_HOST=' '${DEPLOY_PATH}/.env'; then
  echo 'API_HOST=0.0.0.0' >> '${DEPLOY_PATH}/.env'
else
  sed -i 's/^API_HOST=.*/API_HOST=0.0.0.0/' '${DEPLOY_PATH}/.env'
fi
if ! grep -q '^OPENAI_RESPONSES_ENDPOINT=' '${DEPLOY_PATH}/.env'; then
  echo 'OPENAI_RESPONSES_ENDPOINT=https://api.openai.com/v1/responses' >> '${DEPLOY_PATH}/.env'
fi
if ! grep -q '^OPENAI_MODEL=' '${DEPLOY_PATH}/.env'; then
  echo 'OPENAI_MODEL=gpt-5.5' >> '${DEPLOY_PATH}/.env'
fi
if ! grep -q '^MOVENA_FULFILMENT_CASE_PATH=' '${DEPLOY_PATH}/.env'; then
  echo 'MOVENA_FULFILMENT_CASE_PATH=/opt/docker/movena-growth/data/fulfilment-cases.json' >> '${DEPLOY_PATH}/.env'
fi
python3 - '${DEPLOY_PATH}/.env' <<'PY'
from pathlib import Path
import re
import subprocess
import sys

env_path = Path(sys.argv[1])
text = env_path.read_text() if env_path.exists() else ""

def current(name: str) -> str:
    match = re.search(rf"^{re.escape(name)}=(.*)$", text, re.M)
    return (match.group(1) if match else "").strip().strip("'\"")

if current("OPENAI_API_KEY"):
    print("openai_env=present")
    raise SystemExit(0)

try:
    raw = subprocess.check_output(
        [
            "docker",
            "exec",
            "frappe_docker-backend-1",
            "bash",
            "-lc",
            "cd /home/frappe/frappe-bench && bench --site erp.movena.ch execute frappe.utils.password.get_decrypted_password --kwargs '{\"doctype\":\"Movena OCR Settings\",\"name\":\"Movena OCR Settings\",\"fieldname\":\"provider_api_key\",\"raise_exception\":false}'",
        ],
        text=True,
        timeout=40,
        stderr=subprocess.DEVNULL,
    )
    lines = [line.strip().strip("'\"") for line in raw.splitlines() if line.strip()]
    raw = lines[-1] if lines else ""
except Exception:
    raw = ""

if not raw:
    print("openai_env=missing")
    raise SystemExit(0)

if re.search(r"^OPENAI_API_KEY=", text, re.M):
    text = re.sub(r"^OPENAI_API_KEY=.*$", f"OPENAI_API_KEY={raw}", text, flags=re.M)
else:
    text = text.rstrip() + f"\nOPENAI_API_KEY={raw}\n"
env_path.write_text(text)
print("openai_env=imported")
PY

UNIT_DIR="\$HOME/.config/systemd/user"
mkdir -p "\$UNIT_DIR"
cp '${REMOTE_RELEASE}/deploy/systemd/movena-sponsum.service' "\$UNIT_DIR/movena-sponsum.service"
systemctl --user daemon-reload
systemctl --user enable movena-sponsum.service
systemctl --user restart movena-sponsum.service
sleep 2
curl -fsS http://127.0.0.1:3088/health
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3088/sponsum/

if [[ '${INSTALL_NGINX}' == '1' ]]; then
  SNIPPET_SRC='${REMOTE_RELEASE}/deploy/nginx/movena-sponsum.conf'
  SNIPPET_DST='/etc/nginx/snippets/movena-sponsum.conf'
  SITE='/etc/nginx/sites-available/suite.movena.ch'
  if sudo -n true 2>/dev/null; then
    sudo cp "\$SNIPPET_SRC" "\$SNIPPET_DST"
    if ! sudo grep -q 'movena-sponsum.conf' "\$SITE"; then
      sudo cp "\$SITE" "\${SITE}.bak-sponsum-${STAMP}"
      sudo sed -i '/movena-sales.conf/a\\    include /etc/nginx/snippets/movena-sponsum.conf;' "\$SITE"
    fi
    sudo nginx -t
    sudo systemctl reload nginx
  else
    echo "WARN: no passwordless sudo; install nginx snippet manually from \$SNIPPET_SRC"
  fi
fi
EOF
