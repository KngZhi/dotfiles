# dotfiles

一台 Mac 上的开发环境配置：zsh、git、nvim、emacs、Claude Code、Codex，以及三者共用的 skills 和 agent 指令。
`link.sh` 把这个仓库软链接进 `$HOME`，可以反复运行；`git pull` 之后再跑一次即可。

## 目录

| 目录 | 内容 | 接入方式 |
|---|---|---|
| `zsh/` | `.zshenv` `.zprofile` `.zshrc` | 软链接 |
| `git/` | `gitconfig` `gitignore_global` `templates/`（全局 pre-commit） | 软链接 |
| `nvim/` `emacs/` | 编辑器配置 | 软链接到 `~/.config/nvim`、`~/.emacs.d` |
| `claude/` | agents、hooks、commands、statusline、ast-grep 规则、`CLAUDE.md` | 软链接；`settings.json` 只在缺失时复制一份 |
| `codex/` | `rules/`、Codex 专属 skills | 软链接；`config.toml` 只在缺失时复制一份 |
| `shared/` | 两边共用的 skills、`agent-instructions.md`、第三方 skill 包清单 | `shared/build.sh` 生成并链接 |
| `bin/` `agent-secrets/` | `refresh-agent-secrets` 和它渲染的 `op://` 模板（只有引用，没有秘密） | 软链接到 `~/.local/bin`、`~/.config/agent-secrets` |
| `Brewfile` | Homebrew formula、cask、VS Code 扩展、npm/uv 全局包 | `brew bundle` |

`claude/settings.json` 和 `codex/config.toml` 不做软链接：前者 Claude Code 会自己改写，后者在本机版本里含 MCP 服务的 API key。仓库里的副本只是起点。

## 新机器（主力开发机）

按顺序执行，整个过程约一小时，大部分时间在 `brew bundle`。

1. **装 Homebrew，登录 1Password 和 GitHub**

   ```sh
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   eval "$(/opt/homebrew/bin/brew shellenv)"
   brew install git gh 1password-cli
   gh auth login
   ```

   1Password 桌面版从 App Store 装，登录后在设置里打开 CLI 集成。

2. **从旧机拷 SSH 密钥**（不走 git）

   ```sh
   # 在旧机上执行，<new> 换成新机的主机名或 IP
   scp -r ~/.ssh <new>:~/
   ```

   然后在新机 `chmod 700 ~/.ssh && chmod 600 ~/.ssh/id_ed25519`。

3. **clone 并链接**

   ```sh
   sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
   mkdir -p ~/repo && git clone git@github.com:KngZhi/dotfiles.git ~/repo/dotfiles
   ~/repo/dotfiles/link.sh
   brew bundle --file ~/repo/dotfiles/Brewfile
   exec zsh -l
   ```

   oh-my-zsh 装在 `link.sh` 之前，它的安装器会覆盖 `.zshrc`。
   `link.sh` 把已有的真实文件移到 `*.pre-dotfiles`，确认无误后删掉。

4. **从旧机拷不入库的文件**

   | 文件 | 为什么不入库 |
   |---|---|
   | `~/.codex/config.toml`、`~/.codex/auth.json` | 含 API key 和登录态 |
   | `~/.claude/settings.json`、`settings.local.json` | 本机权限列表，Claude 自己改写 |
   | `~/.claude/projects/` | 各项目的会话和记忆（约 2 GB，可只拷 `*/memory/`） |
   | `~/.saoko-sync.env` | Shopify 同步凭据 |
   | `~/.config/gh/hosts.yml` | 可以不拷，`gh auth login` 重新生成 |

5. **恢复 agent 密钥**

   ```sh
   refresh-agent-secrets   # link.sh 已装好；弹 Touch ID，渲染 ~/.config/agent-secrets/agent-secrets.env
   ```

   Claude Code 用的只读 1Password service account token 要单独放进钥匙串：
   在 1Password 里找到该 token，然后

   ```sh
   security add-generic-password -U -s op-service-account -a "$USER" -w   # 交互式粘贴
   ```

6. **只 clone 真正开发的仓库**。旧机 `~/repo` 里一大半是 agent 的工作副本
   （`*-worktrees/`、`<repo>.trigger-dev-*`、`chile-mono-*` 分支目录），属于服务器角色，不要整目录 rsync。

## 日常

- 改了配置：在仓库里改，`git commit && git push`，另一台机器 `git pull && ./link.sh`。
- 新装了软件：`brew bundle dump --file ~/repo/dotfiles/Brewfile --force`，提交。
- 添加第三方 skill 包：`shared/build.sh --add <repo-url>`；每周自动更新由 `shared/install-automation.sh` 装的 LaunchAgent 负责。
