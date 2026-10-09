# Homebrew prefix differs by CPU: /opt/homebrew on Apple Silicon, /usr/local on Intel.
for brew in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  [ -x "$brew" ] && eval "$("$brew" shellenv)" && break
done

# Created by `pipx` on 2025-07-20 16:23:19
export PATH="$HOME/.local/bin:$PATH"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
