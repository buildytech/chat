#!/usr/bin/env bash
# M7: real HTTP Session E2E (not sidecar). Preserves demo DB; acceptance sessions for writes.
set -euo pipefail
OUT="${M7_OUT:-/workspace/var/phpingineer/logs/m7-e2e}"
mkdir -p "$OUT"
: > "$OUT/e2e.log"
SESSION_URL="${SESSION_API_URL:-http://127.0.0.1:18090}"
HOST_HDR="127.0.0.1:${SESSION_URL##*:}"
PRESERVED_SESS="${M7_SESSION_ID:-sess-dcfe3398319aee1e}"
PRESERVED_PAGE="${M7_PAGE_ID:-page-5975af4003592b2c}"
AUTH_USER="${BUILDY_BASIC_AUTH_USER:-}"
AUTH_PASS="${BUILDY_BASIC_AUTH_PASS:-}"
AUTH_ARGS=()
if [[ -n "$AUTH_USER" && -n "$AUTH_PASS" ]]; then
  AUTH_ARGS=(-u "$AUTH_USER:$AUTH_PASS")
fi

pass=0
fail=0
step() {
  local name="$1" ok="$2" detail="${3:-}"
  if [[ "$ok" == "1" ]]; then
    echo "PASS $name $detail" | tee -a "$OUT/e2e.log"
    pass=$((pass + 1))
  else
    echo "FAIL $name $detail" | tee -a "$OUT/e2e.log"
    fail=$((fail + 1))
  fi
}

curl_json() {
  local method="$1" path="$2"
  shift 2
  curl -sS -H "Host: $HOST_HDR" -H "Content-Type: application/json" -H "Accept: application/json" \
    "${AUTH_ARGS[@]}" -X "$method" "$SESSION_URL$path" "$@"
}

CAP=$(curl_json GET /v1/capabilities)
echo "$CAP" > "$OUT/capabilities.json"
if echo "$CAP" | rg -q '"sessions":true'; then step capabilities 1; else step capabilities 0 "$CAP"; fi

SESS=$(curl_json GET "/v1/sessions/$PRESERVED_SESS")
echo "$SESS" > "$OUT/preserved-session.json"
if echo "$SESS" | rg -q "$PRESERVED_PAGE"; then step reload_preserved 1; else step reload_preserved 0; fi

SLUG="m7e2e-$(date +%s | tail -c 5)"
CREATE=$(curl_json POST /v1/sessions -d "{\"slugIntent\":\"$SLUG\",\"title\":\"M7 E2E\"}")
echo "$CREATE" > "$OUT/accept-session.json"
SID=$(echo "$CREATE" | python3 -c 'import sys,json; print(json.load(sys.stdin)["session"]["id"])')
MSG=$(curl_json POST "/v1/sessions/$SID/messages" -H "Idempotency-Key: m7e2e-chat-$SID" -d '{"content":"hello chat only"}')
echo "$MSG" > "$OUT/accept-message.json"
AFTER=$(curl_json GET "/v1/sessions/$SID")
echo "$AFTER" > "$OUT/accept-after-chat.json"
if python3 -c 'import json; a=json.load(open("'"$OUT"'/accept-after-chat.json")); raise SystemExit(0 if not a.get("session",{}).get("pageBound") else 1)'; then
  step conversation_no_page 1 "pageBound=false"
else
  step conversation_no_page 0
fi

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $HOST_HDR" -H "Content-Type: application/json" \
  "${AUTH_ARGS[@]}" -X POST "$SESSION_URL/v1/sessions/$SID/messages" \
  -H "Idempotency-Key: m7e2e-chat-$SID" -d '{"content":"hello chat only"}')
if [[ "$CODE" == "200" || "$CODE" == "201" ]]; then step idempotent_retry 1 "http=$CODE"; else step idempotent_retry 0 "http=$CODE"; fi

PAGE_A="page-m7ea$(date +%s | tail -c 4)"
PAGE_B="page-m7eb$(date +%s | tail -c 4)"
export SESSION_URL HOST_HDR PRESERVED_PAGE OUT PAGE_A PAGE_B
if python3 - <<'PY'
import json, os, urllib.request, urllib.error
base = os.environ["SESSION_URL"]
host = os.environ["HOST_HDR"]
page = json.load(open(os.environ["OUT"] + "/preserved-session.json")).get("page", {}).get("page")
if not page:
    req = urllib.request.Request(
        f"{base}/v1/pages/{os.environ['PRESERVED_PAGE']}",
        headers={"Host": host, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        page = json.loads(r.read())["page"]
slug = "m7-harbor-" + str(os.getpid())

def create(pid: str) -> int:
    doc = dict(page)
    doc["id"] = pid
    doc["slug"] = slug
    doc["status"] = "draft"
    req = urllib.request.Request(
        f"{base}/v1/pages",
        data=json.dumps({"page": doc}).encode(),
        headers={"Host": host, "Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code

c1 = create(os.environ["PAGE_A"])
c2 = create(os.environ["PAGE_B"])
open(os.environ["OUT"] + "/slug-collision.json", "w").write(
    json.dumps({"slug": slug, "c1": c1, "c2": c2}, indent=2) + "\n"
)
raise SystemExit(0 if c1 == 201 and c2 == 409 else 1)
PY
then
  step slug_collision 1 "$(cat "$OUT/slug-collision.json")"
else
  step slug_collision 0 "$(cat "$OUT/slug-collision.json" 2>/dev/null || true)"
fi

PAGE=$(curl_json GET "/v1/pages/$PRESERVED_PAGE")
echo "$PAGE" > "$OUT/preserved-page.json"
if echo "$PAGE" | rg -q '"status":"draft"'; then step restart_durability_read 1; else step restart_durability_read 0; fi

REPO="$(cd "$(dirname "$0")/.." && pwd)"
AUTH_DB="$OUT/auth-e2e.sqlite"
rm -f "$AUTH_DB" "$AUTH_DB"-*
AUTH_BIN="$OUT/buildy-session-serve-m7"
( cd "$REPO/services/context-serve" && CGO_ENABLED=1 go build -o "$AUTH_BIN" . )
BUILDY_BASIC_AUTH_USER=m7dev BUILDY_BASIC_AUTH_PASS=m7secret \
  CONTEXT_SERVE_ADDR=127.0.0.1:18091 PAGE_STORE_PATH="$AUTH_DB" \
  BUILDY_LIVE_MODEL=0 \
  "$AUTH_BIN" >"$OUT/auth-serve.log" 2>&1 &
AUTH_PID=$!
echo "$AUTH_PID" > "$OUT/auth-serve.pid"
cleanup() { kill "$AUTH_PID" 2>/dev/null || true; }
trap cleanup EXIT
for _ in $(seq 1 100); do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: 127.0.0.1:18091' http://127.0.0.1:18091/v1/capabilities || echo 000)
  if [[ "$code" == "401" || "$code" == "200" ]]; then break; fi
  sleep 0.1
done
UNAUTH=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: 127.0.0.1:18091' http://127.0.0.1:18091/v1/capabilities || echo 000)
AUTHED=$(curl -sS -o /dev/null -w '%{http_code}' -u m7dev:m7secret -H 'Host: 127.0.0.1:18091' http://127.0.0.1:18091/v1/capabilities || echo 000)
if [[ "$UNAUTH" == "401" && "$AUTHED" == "200" ]]; then
  step basicauth_gate 1 "unauth=$UNAUTH auth=$AUTHED"
else
  step basicauth_gate 0 "unauth=$UNAUTH auth=$AUTHED log=$(tail -5 "$OUT/auth-serve.log" | tr '\n' ';')"
fi

python3 - <<PY
import json
summary = {"pass": $pass, "fail": $fail, "ok": $fail == 0, "out": "$OUT"}
open("$OUT/m7-http-e2e-summary.json", "w").write(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary))
raise SystemExit(0 if $fail == 0 else 1)
PY
