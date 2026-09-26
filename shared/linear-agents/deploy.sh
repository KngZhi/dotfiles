#!/usr/bin/env bash
# Deploy the two local Linear agents (Cyrus): pinned runtime, routing config,
# launchd services. Re-runnable. Secrets never live in dotfiles: each
# instance's .env and the Linear token store inside its config.json are
# created once by hand (README.md) and preserved by every deploy.
#
#   deploy.sh            install/refresh; running services are not restarted
#   deploy.sh --restart  also restart both services (kills running sessions)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HOME/.local/share/linear-local-agents"
RUNTIME="$ROOT/runtime"
INSTANCES="codex claude"
RESTART=0
[ "${1:-}" = "--restart" ] && RESTART=1

# 1. Runtime, pinned by the checked-in lockfile; reinstalled only when it changes.
mkdir -p "$RUNTIME"
cp "$HERE/runtime/package.json" "$HERE/runtime/package-lock.json" "$RUNTIME/"
want="$(shasum -a 256 "$RUNTIME/package-lock.json" | cut -d' ' -f1)"
if [ ! -d "$RUNTIME/node_modules" ] || [ "$(cat "$RUNTIME/.lock-sha" 2>/dev/null)" != "$want" ]; then
  echo "runtime: npm ci"
  npm ci --prefix "$RUNTIME" --no-audit --no-fund
  echo "$want" > "$RUNTIME/.lock-sha"
else
  echo "runtime: up to date"
fi

# 2. Routing config: template keys replace, everything else in config.json
#    (Cyrus's own token store, refreshed at runtime) is kept. Cyrus watches
#    the file and reloads repositories without a restart.
for name in $INSTANCES; do
  mkdir -p "$ROOT/$name/workspaces"; chmod 700 "$ROOT/$name"
  python3 - "$HERE/config.template.json" "$ROOT/$name/config.json" "$name" <<'EOF'
import json, os, sys
tpl, target, name = sys.argv[1:4]
home = os.environ["HOME"]
text = open(tpl).read().replace("{{HOME}}", home)
new = json.loads(text)
for repo in new["repositories"]:
    repo["id"] = f'{repo["name"]}-{name}'
    repo["workspaceBaseDir"] = f"{home}/.local/share/linear-local-agents/{name}/workspaces"
    if not os.path.isdir(repo["repositoryPath"]):
        print(f'{name}: warning: {repo["repositoryPath"]} not cloned yet', file=sys.stderr)
current = json.load(open(target)) if os.path.exists(target) else {}
current.update(new)
current["defaultRunner"] = name
tmp = target + ".tmp"
with open(tmp, "w") as f:
    json.dump(current, f, ensure_ascii=False, indent=2); f.write("\n")
os.chmod(tmp, 0o600); os.replace(tmp, target)
print(f'{name}: config.json written ({len(new["repositories"])} repositories)')
EOF
  [ -f "$ROOT/$name/.env" ] || echo "$name: no .env yet — copy $HERE/env.template and authenticate (README.md)" >&2
done

# 2b. Role skills: every instance carries skills/* into its user-skills-plugin, which Cyrus
#     loads for Claude directly and symlinks into the worktree for Codex.
for name in $INSTANCES; do
  dest="$ROOT/$name/user-skills-plugin/skills"; mkdir -p "$dest"
  for skill in "$HERE"/skills/*/; do
    s="$(basename "$skill")"; rm -rf "$dest/$s"; cp -R "$skill" "$dest/$s"
  done
  echo "$name: skills $(ls "$HERE/skills" | tr '\n' ' ')"
done

# 3. launchd: plist regenerated from this checkout; (re)bootstrapped only when it changed.
#    The bridge (Linear webhooks → human-authored delegation/mention) is a third service.
mkdir -p "$ROOT/bridge"; chmod 700 "$ROOT/bridge"
[ -f "$ROOT/bridge/.env" ] || echo "bridge: no .env yet — copy $HERE/bridge/env.template (README.md)" >&2
for name in $INSTANCES bridge; do
  label="com.junwei.linear-local-agents.$name"
  plist="$HOME/Library/LaunchAgents/$label.plist"
  log="$ROOT/$name/startup.log"
  if [ "$name" = bridge ]; then
    program="<string>$(command -v node)</string><string>$HERE/bridge/bridge.mjs</string>"
  else
    program="<string>/bin/bash</string><string>$HERE/run.sh</string><string>$name</string>"
  fi
  tmp="$(mktemp)"
  cat > "$tmp" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>$program</array>
  <key>EnvironmentVariables</key>
  <dict><key>HOME</key><string>$HOME</string><key>PATH</key><string>$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>WorkingDirectory</key><string>$ROOT/$name</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$log</string>
  <key>StandardErrorPath</key><string>$log</string>
</dict>
</plist>
EOF
  if [ "$RESTART" = 1 ] || ! cmp -s "$tmp" "$plist"; then
    mkdir -p "$(dirname "$plist")"; mv "$tmp" "$plist"
    launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
    # bootout returns before teardown finishes; bootstrap during teardown fails with EIO.
    for _ in $(seq 1 30); do launchctl print "gui/$(id -u)/$label" >/dev/null 2>&1 || break; sleep 1; done
    launchctl bootstrap "gui/$(id -u)" "$plist"
    echo "$name: service (re)started"
  else
    rm -f "$tmp"; echo "$name: service unchanged"
  fi
done
