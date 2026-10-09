# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:$HOME/.local/bin:/usr/local/bin:$PATH

# Path to your Oh My Zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time Oh My Zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
ZSH_THEME="robbyrussell"

# Set list of themes to pick from when loading at random
# Setting this variable when ZSH_THEME=random will cause zsh to load
# a theme from this variable instead of looking in $ZSH/themes/
# If set to an empty array, this variable will have no effect.
# ZSH_THEME_RANDOM_CANDIDATES=( "robbyrussell" "agnoster" )

# Uncomment the following line to use case-sensitive completion.
# CASE_SENSITIVE="true"

# Uncomment the following line to use hyphen-insensitive completion.
# Case-sensitive completion must be off. _ and - will be interchangeable.
# HYPHEN_INSENSITIVE="true"

# Uncomment one of the following lines to change the auto-update behavior
zstyle ':omz:update' mode disabled  # disable automatic updates (手动运行 omz update)
# zstyle ':omz:update' mode auto      # update automatically without asking
# zstyle ':omz:update' mode reminder  # just remind me to update when it's time

# Uncomment the following line to change how often to auto-update (in days).
# zstyle ':omz:update' frequency 13

# Uncomment the following line if pasting URLs and other text is messed up.
# DISABLE_MAGIC_FUNCTIONS="true"

# Uncomment the following line to disable colors in ls.
# DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
# ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# You can also set it to another string to have that shown instead of the default red dots.
# e.g. COMPLETION_WAITING_DOTS="%F{yellow}waiting...%f"
# Caution: this setting can cause issues with multiline prompts in zsh < 5.7.1 (see #5765)
# COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.
# You can set one of the optional three formats:
# "mm/dd/yyyy"|"dd.mm.yyyy"|"yyyy-mm-dd"
# or set a custom format using the strftime function format specifications,
# see 'man strftime' for details.
# HIST_STAMPS="mm/dd/yyyy"

# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git)

source $ZSH/oh-my-zsh.sh

# User configuration

# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
# export LANG=en_US.UTF-8

# Preferred editor for local and remote sessions
# if [[ -n $SSH_CONNECTION ]]; then
#   export EDITOR='vim'
# else
#   export EDITOR='nvim'
# fi

# Compilation flags
# export ARCHFLAGS="-arch $(uname -m)"

# Set personal aliases, overriding those provided by Oh My Zsh libs,
# plugins, and themes. Aliases can be placed here, though Oh My Zsh
# users are encouraged to define aliases within a top-level file in
# the $ZSH_CUSTOM folder, with .zsh extension. Examples:
# - $ZSH_CUSTOM/aliases.zsh
# - $ZSH_CUSTOM/macos.zsh
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"
export CN_PREFIX="$HOME/repo/claude-cn"

# bun completions (懒加载 - 输入 bun 后按 tab 时才加载)
_bun_lazy_load() {
  unfunction bun 2>/dev/null
  [ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"
}
compdef _bun_lazy_load bun 2>/dev/null

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export CC=/opt/homebrew/bin/gcc-15
export CXX=/opt/homebrew/bin/g++-15
alias ccn-yolo="ccn --dangerously-skip-permissions"
alias ccn-add-mcp="ccn mcp add-from-claude-desktop"

alias cc="claude"
# alias ccy="claude --dangerously-skip-permissions"
alias cc-add-mcp="claude mcp add-from-claude-desktop"
alias cc-yolo="claude --dangerously-skip-permissions"
alias ccy="claude --dangerously-skip-permissions --teammate-mode in-process"
alias ccn='npx --registry=https://registry.npmmirror.com https://gaccode.com/claudecode/install'

# Created by `pipx` on 2025-07-20 16:23:19
export PATH="$HOME/.local/bin:$PATH"
alias cc-mcp="$HOME/Library/Application\ Support/Claude/claude_desktop_config.json$HOME/Library/Application\ Support/Claude/claude_desktop_config.json"
alias cx='codex --config model_reasoning_effort="high"'

# omnara
export OMNARA_INSTALL="$HOME/.omnara"
export PATH="$OMNARA_INSTALL/bin:$PATH"

# 懒加载 OPENROUTER_API_KEY (首次使用时才获取，避免启动延迟)
get_openrouter_key() {
  if [[ -z "$OPENROUTER_API_KEY" ]]; then
    export OPENROUTER_API_KEY=$(security find-generic-password -s "openrouter" -a "$USER" -w 2>/dev/null)
  fi
  echo "$OPENROUTER_API_KEY"
}


# Editor for Claude Code (Ctrl+G)
export EDITOR="nvim"
export VISUAL="nvim"

# Amp CLI
export PATH="$HOME/.amp/bin:$PATH"

# opencode
export PATH=$HOME/.opencode/bin:$PATH
export ENABLE_LSP_TOOL=1
alias cm="$HOME/repo/cass_memory_system/dist/cass-memory"
alias cx="codex --full-auto -a never"

# OpenClaw Completion
[ -f "$HOME/.openclaw/completions/openclaw.zsh" ] && source "$HOME/.openclaw/completions/openclaw.zsh"

# Wenyi: securely save the MinerU key without exposing it in shell history.
wenyi-set-mineru-key() {
  local mineru_key
  read -r -s "mineru_key?Paste MINERU_API_KEY (input hidden): "
  echo

  if [[ -z "$mineru_key" ]]; then
    echo "MINERU_API_KEY was empty; nothing was saved." >&2
    return 1
  fi

  security add-generic-password \
    -U \
    -s "MINERU_API_KEY" \
    -a "$USER" \
    -w "$mineru_key"
  local save_status=$?
  unset mineru_key

  if (( save_status == 0 )); then
    echo "MINERU_API_KEY saved to macOS Keychain."
  fi
  return $save_status
}

# Wenyi: load the local CLIProxy key plus MinerU from macOS Keychain.
wenyi() {
  local cliproxy_config cliproxy_key deepseek_key mineru_key arg
  cliproxy_config="/opt/homebrew/etc/cliproxyapi.conf"
  [[ -r "$cliproxy_config" ]] || {
    echo "CLIProxy config is not readable: $cliproxy_config" >&2
    return 1
  }
  cliproxy_key="$(
    awk '
      /^api-keys:[[:space:]]*$/ { in_keys = 1; next }
      in_keys && /^[[:space:]]*-[[:space:]]*/ {
        sub(/^[[:space:]]*-[[:space:]]*/, "")
        gsub(/^["\047]|["\047]$/, "")
        print
        exit
      }
      in_keys && /^[^[:space:]]/ { exit }
    ' "$cliproxy_config"
  )"
  [[ -n "$cliproxy_key" ]] || {
    echo "No API key found under api-keys in $cliproxy_config" >&2
    return 1
  }

  deepseek_key="$(
    security find-generic-password \
      -s "DEEPSEEK_API_KEY" \
      -a "$USER" \
      -w 2>/dev/null
  )" || deepseek_key=""

  mineru_key="$(
    security find-generic-password \
      -s "MINERU_API_KEY" \
      -a "$USER" \
      -w 2>/dev/null
  )" || mineru_key=""

  if [[ -z "$mineru_key" ]]; then
    for arg in "$@"; do
      if [[ "${arg:l}" == *.pdf ]]; then
        echo "MINERU_API_KEY is missing from macOS Keychain." >&2
        echo "Run: wenyi-set-mineru-key" >&2
        return 1
      fi
    done
  fi

  CLIPROXY_API_KEY="$cliproxy_key" DEEPSEEK_API_KEY="$deepseek_key" \
    MINERU_API_KEY="$mineru_key" \
    uv --directory "$HOME/repo/wenyi" run trans-novel "$@"
}
