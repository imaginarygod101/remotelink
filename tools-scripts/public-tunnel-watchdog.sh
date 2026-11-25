#!/usr/bin/env bash
# usage: public-tunnel-watchdog.sh <role: signal|download> <local port>
# Runs a RemoteLink server on 127.0.0.1:<port> and an anonymous workslocal tunnel to it, and keeps both alive.
#  - signal:   signaling only (no files), so download traffic can never take the signaling URL down.
#  - download: serves site/ (download page + builds).
# Anonymous workslocal tunnels expire after ~2 h and drop after a few hundred MB of transfer; the old name can't be
# reclaimed, so on failure we take a new random URL and publish it (run-logs/<role>-url.txt, site/signaling.json).
cd "$(dirname "$0")/.."; ROLE=$1; PORT=$2; LOG=run-logs/watchdog-$ROLE.log; WL=/workspace/tools/tunnels/node_modules/.bin/workslocal
srv() { curl -s -m 3 -o /dev/null http://127.0.0.1:$PORT/healthz && return
  echo "$(date '+%F %T %Z') starting local $ROLE server :$PORT" >> $LOG
  if [ $ROLE = download ]; then HOST=127.0.0.1 PORT=$PORT TRUST_PROXY=1 STATIC_DIR=site nohup node server/server.js >> run-logs/server-$ROLE.log 2>&1 &
  else HOST=127.0.0.1 PORT=$PORT TRUST_PROXY=1 nohup node server/server.js >> run-logs/server-$ROLE.log 2>&1 & fi
  echo $! > run-logs/server-$ROLE.pid; sleep 1; }
tun() { pkill -f "workslocal http $PORT" ; sleep 1; nohup $WL http $PORT > run-logs/workslocal-$ROLE.log 2>&1 & echo $! > run-logs/workslocal-$ROLE.pid
  for i in $(seq 40); do U=$(sed 's/\x1b\[[0-9;]*m//g' run-logs/workslocal-$ROLE.log | grep -o 'https://[a-z0-9]*\.workslocal\.exposed' | head -1); [ -n "$U" ] && break; sleep 1; done
  [ -z "$U" ] && { echo "$(date '+%F %T %Z') tunnel start failed" >> $LOG; return 1; }
  echo "$U" > run-logs/$ROLE-url.txt
  [ $ROLE = signal ] && echo "{\"url\":\"wss://${U#https://}\",\"since\":\"$(date -Iseconds)\"}" > site/signaling.json
  echo "$(date '+%F %T %Z') PUBLIC $ROLE URL $U" >> $LOG; sleep 3; }
up() { [ "$(curl -s -m 10 -o /dev/null -w '%{http_code}' $(cat run-logs/$ROLE-url.txt 2>/dev/null)/healthz)" = 200 ]; }
srv; up || tun; fails=0
while true; do sleep 20; srv
  if up; then fails=0; else fails=$((fails+1)); [ $fails -ge 2 ] && { echo "$(date '+%F %T %Z') $ROLE tunnel down" >> $LOG; tun; fails=0; }; fi
done
