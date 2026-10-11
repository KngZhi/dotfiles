# infra — one place that says what each Mac runs

Layer 1 of the four-layer plan (Ansible configures machines; GitHub Actions + each repo's
deploy.sh releases apps; launchd supervises; Uptime Kuma watches). Control node is the Pro.

- `inventory.yml`: the three machines, addresses and architecture only.
- `group_vars/all.yml`: pinned versions (mise, runtimes, 1Password CLI).
- `group_vars/home_server.yml`: the service catalog for the Intel, in migration order.
- `host_vars/mbp-intel.yml`: what is specific to that box. Replace the box, edit this, re-run.
- `roles/base`: dirs, dotfiles + link.sh, 1Password CLI (pkg payload, no root), mise with
  `compile=false` (Homebrew on Intel is Tier 3 and builds from source), tailscaled, power.

```sh
cd ~/repo/dotfiles/infra
ansible-galaxy collection install -r requirements.yml
ansible-playbook provision.yml -l mbp-intel                    # no password needed
ansible-playbook provision.yml -l mbp-intel -K --tags sudo      # pmset, tailscaled daemon
```

Once by hand on the server (needs the amd password, do it in a herdr pane):

```sh
sudo sysadminctl -autologin set -userName amd -password -      # GUI session for Chrome/Docker
sudo tailscale up --operator=amd --hostname=mbp-intel          # prints the login URL
```
