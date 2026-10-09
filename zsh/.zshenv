[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

# Load SAOKO/Shopify sync credentials for all shells (file is chmod 600, gitignored)
[ -f ~/.saoko-sync.env ] && source ~/.saoko-sync.env

# Local agent secrets rendered from 1Password by refresh-agent-secrets (chmod 600, never committed)
[ -f ~/.config/agent-secrets/agent-secrets.env ] && source ~/.config/agent-secrets/agent-secrets.env

# Agent shells (Claude Code sets CLAUDECODE=1) read 1Password DEV via a read-only
# service account stored in the login keychain; interactive shells keep desktop-app auth.
if [ -n "$CLAUDECODE" ] && [ -z "$OP_SERVICE_ACCOUNT_TOKEN" ]; then
  OP_SERVICE_ACCOUNT_TOKEN=$(security find-generic-password -s op-service-account -w 2>/dev/null) && export OP_SERVICE_ACCOUNT_TOKEN
fi
