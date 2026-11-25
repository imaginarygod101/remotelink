#!/usr/bin/env bash
# Download a RemoteLink build through a size-capped tunnel in 8 MB Range chunks, then verify SHA-256.
# usage: chunked-download.sh <url> <outfile> [expected_sha256]
set -euo pipefail; URL=$1; OUT=$2; EXP=${3:-}; CH=$((8*1024*1024))
SIZE=$(curl -sfI "$URL" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-length"{print $2}' | tail -1)
: > "$OUT"; off=0
while [ $off -lt $SIZE ]; do end=$((off+CH-1)); [ $end -ge $SIZE ] && end=$((SIZE-1))
  ok=0; for try in $(seq 10); do curl -sf -m 120 -H "Range: bytes=$off-$end" "$URL" -o /tmp/.rlchunk && [ $(stat -c%s /tmp/.rlchunk) -eq $((end-off+1)) ] && { ok=1; break; }; sleep 5; done
  [ $ok = 1 ] || { echo "FAILED at byte $off"; exit 1; }
  cat /tmp/.rlchunk >> "$OUT"; off=$((end+1)); sleep ${CHUNK_PAUSE:-0}; done
GOT=$(sha256sum "$OUT" | cut -d' ' -f1); echo "size=$SIZE sha256=$GOT"
[ -z "$EXP" ] || { [ "$GOT" = "$EXP" ] && echo "HASH OK" || { echo "HASH MISMATCH (expected $EXP)"; exit 1; }; }
