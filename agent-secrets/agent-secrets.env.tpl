# 本地 agent（Claude Code / Codex / Conductor 脚本 / 终端）共用的环境变量模板。
# 真相在 1Password；这个文件只放 1Password 秘密引用（vault/item/field），没有秘密，可以随便看。
# 渲染：refresh-agent-secrets  →  写出同目录的 agent-secrets.env（chmod 600），由 ~/.zshenv source。
# 轮换 token 后：改 1Password 里的值，再跑一次 refresh-agent-secrets。

# GitHub Packages 只读（@kngzhi/k2046-api-client）。仓库 .npmrc 读的就是它。
# 需要 classic PAT，scope 只勾 read:packages（GitHub Packages 不接受 fine-grained PAT）。
# 1Password 条目：DEV / 「github read:package」。条目名含冒号，秘密引用里不允许，所以用条目 ID。
export NODE_AUTH_TOKEN="op://DEV/gw2qnjcqfftpcvsx7nbkymyngq/credential"

# Type4Me -> Jev -> Linear 语音待办 watcher（~/repo/dotfiles/shared/type4me-agent/watcher.py）用。
# OpenRouter：Jev (typesafe/jev-1.13) 分类调用。1Password 条目：DEV / 「OPENROUTER-Translater」。
export OPENROUTER_API_KEY="op://DEV/OPENROUTER-Translater/credential"
# Linear：建 issue / 加评论。DEV 下有两个 Linear 条目，测过只有「Linear Cli SAOKO」所在 workspace
# 有 SAOKO(SAO) team；「Linear API」是另一个 workspace（LOOPX/S2A/WCH/JUN/CLA），没有 SAOKO。
export LINEAR_API_KEY="op://DEV/Linear Cli SAOKO/credential"
