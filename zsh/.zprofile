# Homebrew prefix differs by CPU: /opt/homebrew on Apple Silicon, /usr/local on Intel.
for brew in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  [ -x "$brew" ] && eval "$("$brew" shellenv)" && break
done
# /etc/paths.d/homebrew makes path_helper append the prefix at the end of PATH and
# shellenv then leaves it there; put it first so Homebrew's python3 and git win over /usr/bin.
[ -n "$HOMEBREW_PREFIX" ] && export PATH="$HOMEBREW_PREFIX/bin:$HOMEBREW_PREFIX/sbin:$PATH"

# Created by `pipx` on 2025-07-20 16:23:19
export PATH="$HOME/.local/bin:$PATH"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
