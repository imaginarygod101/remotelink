#!/usr/bin/env bash
# End-to-end loopback test: server + host + viewer Electron instances on one Xvfb display.
set -u; cd "$(dirname "$0")/.."; OUT=tests/results; mkdir -p $OUT; rm -f $OUT/*.log
export DISPLAY=:99; Xvfb :99 -screen 0 1280x800x24 >/dev/null 2>&1 & XV=$!; sleep 1
# SERVER=wss://... runs host+viewer through a public signaling URL instead of a local server.
if [ -n "${SERVER:-}" ]; then SRV=$SERVER; SV=; else PORT=18443 node server/server.js > $OUT/server.log 2>&1 & SV=$!; SRV=ws://127.0.0.1:18443; sleep 0.5; fi
echo "signaling: $SRV"
EL=desktop/node_modules/.bin/electron; FL="--no-sandbox --disable-gpu"
RL_E2E=1 RL_ROLE=host RL_SERVER=$SRV $EL $FL desktop > $OUT/host.log 2>&1 & HO=$!
for i in $(seq 100); do CODE=$(grep -o 'CODE=[0-9]*' $OUT/host.log | cut -d= -f2); [ -n "$CODE" ] && break; sleep 0.2; done
echo "session code: $CODE"
RL_E2E=1 RL_ROLE=viewer RL_CODE=$CODE RL_SERVER=$SRV $EL $FL desktop > $OUT/viewer.log 2>&1 & VI=$!
for i in $(seq 120); do grep -q RESULT= $OUT/viewer.log && break; sleep 0.5; done; sleep 3
POS=$(xdotool getmouselocation)
kill $HO $VI $SV 2>/dev/null; sleep 0.5; kill $XV 2>/dev/null
pass=0; fail=0; chk(){ if eval "$2"; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1"; fail=$((fail+1)); fi; }
chk "signaling: session code issued" '[ -n "$CODE" ]'
chk "consent: host approved" 'grep -q "Session active" $OUT/host.log'
chk "webrtc: peer connected" 'grep -q "PC connected" $OUT/viewer.log'
chk "frames received (fps>5)" 'grep -o "RESULT=.*" $OUT/viewer.log | grep -qE "\"fps\":([6-9]|[1-9][0-9])"'
chk "input: 3 moves injected" '[ $(grep -c "INJECTED move" $OUT/host.log) -ge 3 ]'
chk "input: OS cursor at last injected point (960,480)" 'echo "$POS" | grep -q "x:960 y:480"'
chk "session ended cleanly" 'grep -q "Session ended" $OUT/host.log'
echo; grep -o 'RESULT=.*' $OUT/viewer.log; grep INJECTED $OUT/host.log; grep -o 'PC [a-z]*' $OUT/viewer.log | sort | uniq -c; echo "cursor: $POS"
echo "$pass passed, $fail failed"; [ $fail -eq 0 ]
