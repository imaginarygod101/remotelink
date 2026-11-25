#!/usr/bin/env bash
# Downloads every artifact in the public SHA256SUMS.txt (8 MB Range chunks) and checks each SHA-256.
# Re-reads run-logs/download-url.txt before each attempt, because the free tunnel can rotate to a new URL.
cd "$(dirname "$0")/.."; T=/tmp/rl-verify; rm -rf $T; mkdir -p $T; URLF=run-logs/download-url.txt
echo "Public download verification started $(date '+%F %H:%M %Z')"
curl -sf -m 20 $(cat $URLF)/downloads/SHA256SUMS.txt > $T/SUMS || { echo "could not fetch SHA256SUMS.txt"; exit 1; }
echo "SHA256SUMS.txt: $(wc -l < $T/SUMS) entries (from $(cat $URLF))"; pass=0; fail=0
while read h f; do ok=0
  for attempt in 1 2 3; do U=$(cat $URLF); s=$(date +%s)
    r=$(CHUNK_PAUSE=0.5 tools-scripts/chunked-download.sh "$U/downloads/$f" "$T/$f" "$h" 2>&1 | tail -1)
    echo "$f | $(stat -c%s "$T/$f" 2>/dev/null) bytes | $r | $(( $(date +%s) - s )) s | via $U"
    [ "$r" = "HASH OK" ] && { ok=1; break; }
    echo "  waiting for the watchdog to bring the tunnel back..."; for i in $(seq 24); do sleep 5; [ "$(curl -s -m 8 -o /dev/null -w '%{http_code}' $(cat $URLF)/healthz)" = 200 ] && break; done
  done; [ $ok = 1 ] && pass=$((pass+1)) || fail=$((fail+1)); sleep 5
done < $T/SUMS
echo "$pass OK, $fail failed. Finished $(date '+%F %H:%M %Z'). Current download URL: $(cat $URLF)"
