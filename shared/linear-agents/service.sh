#!/bin/bash
# launchd control for one Cyrus instance. Never restart while a session is running.
set -euo pipefail
action=${1:-}; name=${2:-}
case "$name" in codex|claude|bridge) ;; *) echo 'usage: service.sh start|stop|restart|status|log codex|claude|bridge' >&2; exit 2;; esac
label="com.junwei.linear-local-agents.$name"
domain="gui/$(id -u)"
plist="$HOME/Library/LaunchAgents/$label.plist"
case "$action" in
  start)   launchctl bootstrap "$domain" "$plist" ;;
  stop)    launchctl bootout "$domain/$label" ;;
  restart) launchctl kickstart -k "$domain/$label" ;;
  status)  launchctl print "$domain/$label" | grep -E "state|pid|last exit" ;;
  log)     tail -n 40 "$HOME/.local/share/linear-local-agents/$name/startup.log" ;;
  *) echo 'usage: service.sh start|stop|restart|status|log codex|claude' >&2; exit 2 ;;
esac
