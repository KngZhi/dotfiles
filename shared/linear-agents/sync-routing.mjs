#!/usr/bin/env node
// Project → repository routing for the Cyrus instances, generated from Linear.
//
// Cyrus routes an issue by its project's *name* (`projectKeys`), so a hand-kept
// table breaks on every rename and every new project. Here the source of truth
// is the project itself: an engineering project carries a link to its GitHub
// repository (Project → Resources), and this script rebuilds the routing table
// from the current names on every run. Fallback for unlinked projects: a name
// that is a directory under ~/repo. Anything else is unroutable, and the bridge
// says so on the issue instead of letting the delegation vanish.
//
//   sync-routing.mjs            fetch projects from Linear, clone missing repos, write configs
//   sync-routing.mjs --no-fetch write configs from the last generated file (no Linear access)
//
// Runs from deploy.sh and from the bridge on every Project webhook. Cyrus watches
// config.json and reloads repositories without a restart.
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";

const here = new URL(".", import.meta.url);
const HOME = process.env.HOME;
const ROOT = `${HOME}/.local/share/linear-local-agents`;
const GENERATED = `${ROOT}/routing.generated.json`;
const INSTANCES = ["codex", "claude"];
const log = (...a) => console.log("sync-routing:", ...a);

const template = JSON.parse(readFileSync(new URL("config.template.json", here), "utf8").replaceAll("{{HOME}}", HOME));
const bridge = JSON.parse(readFileSync(new URL("bridge/bridge.json", here), "utf8"));
const defaults = template.engineeringDefaults;

function apiKey() {
  const env = `${ROOT}/bridge/.env`;
  for (const line of existsSync(env) ? readFileSync(env, "utf8").split("\n") : []) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return process.env.LINEAR_BRIDGE_API_KEY;
}

async function gql(query, variables) {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey() },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// Which repository a project maps to, cloning it when the link names one we lack.
function resolve(project) {
  const link = project.externalLinks.nodes
    .map((l) => /github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?]|$)/.exec(l.url))
    .find(Boolean);
  let name, slug;
  if (link) { slug = `${link[1]}/${link[2]}`; name = link[2]; }
  else if (existsSync(`${HOME}/repo/${project.name}/.git`)) name = project.name;
  else return null;
  const repositoryPath = `${HOME}/repo/${name}`;
  if (!existsSync(repositoryPath)) { log(`cloning ${slug} → ${repositoryPath}`); sh("gh", ["repo", "clone", slug, repositoryPath]); }
  // The remote's default branch, never whatever happens to be checked out locally.
  let baseBranch = "main";
  try { baseBranch = sh("git", ["-C", repositoryPath, "symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).replace(/^origin\//, ""); }
  catch {
    try { baseBranch = /ref: refs\/heads\/(\S+)\tHEAD/.exec(sh("git", ["-C", repositoryPath, "ls-remote", "--symref", "origin", "HEAD"]))[1]; }
    catch { if (slug) try { baseBranch = sh("gh", ["repo", "view", slug, "--json", "defaultBranchRef", "-q", ".defaultBranchRef.name"]); } catch {} }
  }
  return { name, repositoryPath, baseBranch, linearWorkspaceId: defaults.linearWorkspaceId,
    projectKeys: [project.name], labelPrompts: defaults.labelPrompts, isActive: true };
}

async function generate() {
  // Team by team, id first: Linear's complexity budget rejects the nested collection query.
  const projects = [];
  for (const key of bridge.teams) {
    const { teams } = await gql(`query($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id } } }`, { key });
    for (const { id } of teams.nodes) {
      const { team } = await gql(`query($id: String!) { team(id: $id) { projects(first: 50) { nodes { id name externalLinks(first: 5) { nodes { url } } } } } }`, { id });
      projects.push(...team.projects.nodes);
    }
  }
  const generated = { generatedAt: new Date().toISOString(), projects: [], unroutable: [] };
  for (const p of projects) {
    const repository = resolve(p);
    if (repository) generated.projects.push({ projectId: p.id, projectName: p.name, repository });
    else generated.unroutable.push(p.name);
  }
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(GENERATED, JSON.stringify(generated, null, 2) + "\n");
  log(`${generated.projects.length} routable project(s): ${generated.projects.map((p) => `${p.projectName} → ${p.repository.name}`).join("; ") || "-"}`);
  if (generated.unroutable.length) log(`no repository link: ${generated.unroutable.join("; ")}`);
  return generated;
}

// config.json = template keys + generated repositories; Cyrus's own token store in it is kept.
function render(generated) {
  const { engineeringDefaults, ...tpl } = template;
  const repositories = [...tpl.repositories, ...generated.projects.map((p) => p.repository)];
  for (const repo of repositories) if (!existsSync(repo.repositoryPath)) console.error(`sync-routing: warning: ${repo.repositoryPath} not cloned yet`);
  for (const name of INSTANCES) {
    const dir = `${ROOT}/${name}`;
    mkdirSync(`${dir}/workspaces`, { recursive: true }); chmodSync(dir, 0o700);
    const target = `${dir}/config.json`;
    const current = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : {};
    Object.assign(current, tpl, {
      repositories: repositories.map((r) => ({ ...r, id: `${r.name}-${name}`, workspaceBaseDir: `${dir}/workspaces` })),
      defaultRunner: name,
    });
    writeFileSync(`${target}.tmp`, JSON.stringify(current, null, 2) + "\n", { mode: 0o600 });
    renameSync(`${target}.tmp`, target);
    log(`${name}: config.json written (${repositories.length} repositories)`);
  }
}

if (process.argv.includes("--no-fetch")) {
  render(existsSync(GENERATED) ? JSON.parse(readFileSync(GENERATED, "utf8")) : { projects: [], unroutable: [] });
} else if (!apiKey()) {
  console.error("sync-routing: LINEAR_BRIDGE_API_KEY missing (bridge/.env); run with --no-fetch");
  process.exit(78);
} else {
  render(await generate());
}
