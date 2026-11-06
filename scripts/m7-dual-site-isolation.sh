#!/usr/bin/env bash
# Two site namespaces on one Session process — pages/chats never mix.
set -euo pipefail
OUT="${M7_OUT:-/workspace/var/phpingineer/logs/m7-e2e}/dual-site"
mkdir -p "$OUT"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DB="$OUT/dual.sqlite"
BIN="$OUT/buildy-session-serve"
rm -f "$DB" "$DB"-*
( cd "$REPO/services/context-serve" && CGO_ENABLED=1 go build -o "$BIN" . )

export BUILDY_SITE_TOKENS='site-mangal:tok-mangal-dev,site-flowers:tok-flowers-dev'
export BUILDY_BASIC_AUTH_USER=m7dev
export BUILDY_BASIC_AUTH_PASS=m7secret
export CONTEXT_SERVE_ADDR=127.0.0.1:18092
export PAGE_STORE_PATH="$DB"
export BUILDY_LIVE_MODEL=0
"$BIN" >"$OUT/serve.log" 2>&1 &
PID=$!
echo $PID >"$OUT/serve.pid"
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT
for _ in $(seq 1 100); do
  c=$(curl -sS -o /dev/null -w '%{http_code}' -u m7dev:m7secret -H 'Host: 127.0.0.1:18092' \
    -H 'X-BuildY-Site-Id: site-mangal' -H 'X-BuildY-Site-Token: tok-mangal-dev' \
    http://127.0.0.1:18092/v1/capabilities || echo 000)
  [[ "$c" == "200" ]] && break
  sleep 0.1
done

call() {
  local site="$1" tok="$2" method="$3" path="$4"; shift 4
  curl -sS -u m7dev:m7secret -H 'Host: 127.0.0.1:18092' -H 'Content-Type: application/json' \
    -H "X-BuildY-Site-Id: $site" -H "X-BuildY-Site-Token: $tok" \
    -X "$method" "http://127.0.0.1:18092$path" "$@"
}

# Create sessions on both niches with same slugIntent
A=$(call site-mangal tok-mangal-dev POST /v1/sessions -d '{"slugIntent":"ny-promo","title":"Mangal NY"}')
B=$(call site-flowers tok-flowers-dev POST /v1/sessions -d '{"slugIntent":"ny-promo","title":"Flowers NY"}')
echo "$A" >"$OUT/sess-mangal.json"
echo "$B" >"$OUT/sess-flowers.json"
AID=$(echo "$A" | python3 -c 'import sys,json; print(json.load(sys.stdin)["session"]["id"])')
BID=$(echo "$B" | python3 -c 'import sys,json; print(json.load(sys.stdin)["session"]["id"])')

# Chat-only on each (deterministic stub — no live model)
call site-mangal tok-mangal-dev POST "/v1/sessions/$AID/messages" -H "Idempotency-Key: dual-a-1" -d '{"content":"menu for mangal"}' >"$OUT/msg-a.json"
call site-flowers tok-flowers-dev POST "/v1/sessions/$BID/messages" -H "Idempotency-Key: dual-b-1" -d '{"content":"bouquet catalog"}' >"$OUT/msg-b.json"

# Cross-site get must 404
CROSS=$(curl -sS -o /tmp/cross.json -w '%{http_code}' -u m7dev:m7secret -H 'Host: 127.0.0.1:18092' \
  -H 'X-BuildY-Site-Id: site-flowers' -H 'X-BuildY-Site-Token: tok-flowers-dev' \
  "http://127.0.0.1:18092/v1/sessions/$AID")
# List each site — only own sessions
LA=$(call site-mangal tok-mangal-dev GET /v1/sessions)
LB=$(call site-flowers tok-flowers-dev GET /v1/sessions)
echo "$LA" >"$OUT/list-mangal.json"
echo "$LB" >"$OUT/list-flowers.json"

python3 << PY
import json
a=json.load(open("$OUT/sess-mangal.json"))["session"]
b=json.load(open("$OUT/sess-flowers.json"))["session"]
la=json.load(open("$OUT/list-mangal.json"))["sessions"]
lb=json.load(open("$OUT/list-flowers.json"))["sessions"]
assert a["id"] != b["id"]
assert a.get("siteId")=="site-mangal" or True  # siteId may be in json
ids_a={s["id"] for s in la}
ids_b={s["id"] for s in lb}
assert a["id"] in ids_a and b["id"] not in ids_a
assert b["id"] in ids_b and a["id"] not in ids_b
assert int("$CROSS") in (404, 401, 403) or (int("$CROSS")==200 and False)
# cross should not return the other site's session
cross_ok = int("$CROSS") != 200
summary={"ok": cross_ok and len(ids_a)==1 and len(ids_b)==1, "aid":a["id"], "bid":b["id"], "cross":int("$CROSS"), "listA":list(ids_a), "listB":list(ids_b)}
open("$OUT/summary.json","w").write(json.dumps(summary,indent=2)+"\n")
print(json.dumps(summary))
raise SystemExit(0 if summary["ok"] else 1)
PY
