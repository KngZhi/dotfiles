#!/usr/bin/env node
// Linear → Cyrus bridge. Linear opens an agent session only for actions a
// human takes (delegate, @mention); the same actions taken by an agent only
// notify. This service receives Linear's Issue webhooks and repeats the one
// missing human action as the workspace owner, so that:
//   1. adding a configured label delegates the issue to the mapped agent;
//   2. a sub-issue an agent created and delegated gets an @mention that
//      actually starts it (orchestrator hand-off).
// It keeps no state: idempotency is a marker comment on the issue itself,
// and a missed delivery is simply the human click it was replacing.
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = new URL(".", import.meta.url);
const root = `${process.env.HOME}/.local/share/linear-local-agents/bridge`;
const ROUTING = `${process.env.HOME}/.local/share/linear-local-agents/routing.generated.json`;
const SYNC = fileURLToPath(new URL("../sync-routing.mjs", here));
for (const line of existsSync(`${root}/.env`) ? readFileSync(`${root}/.env`, "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const CONFIG = JSON.parse(readFileSync(new URL("bridge.json", here), "utf8"));
const PORT = Number(process.env.BRIDGE_PORT || 3458);
const SECRET = process.env.LINEAR_BRIDGE_WEBHOOK_SECRET;
const API_KEY = process.env.LINEAR_BRIDGE_API_KEY;
if (!SECRET || !API_KEY) {
  console.error("bridge: LINEAR_BRIDGE_WEBHOOK_SECRET and LINEAR_BRIDGE_API_KEY are required (see README)");
  process.exit(78);
}
const log = (...args) => console.log(new Date().toISOString(), ...args);

async function gql(query, variables) {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: API_KEY },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const ISSUE = `query($id: String!) {
  issue(id: $id) {
    id identifier url
    team { key }
    state { type }
    labels { nodes { id name } }
    delegate { id }
    project { id name }
    comments(first: 100) { nodes { body } }
  }
}`;

// Project → repository routing is generated from Linear by sync-routing.mjs (a
// project's GitHub link); an issue outside a routable project cannot be worked
// on, so the bridge says so instead of delegating into the void.
function routable(issue) {
  if (!existsSync(ROUTING)) return true; // no table yet: let Cyrus decide
  const { projects } = JSON.parse(readFileSync(ROUTING, "utf8"));
  return Boolean(issue.project && projects.some((p) => p.projectId === issue.project.id));
}
let syncTimer;
function scheduleSync(reason) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    execFile(process.execPath, [SYNC], { env: process.env }, (err, stdout, stderr) => {
      for (const line of `${stdout}${stderr}`.trim().split("\n")) if (line) log(line);
      if (err) log(`sync-routing failed (${reason}): ${err.message}`);
    });
  }, 3000);
}

function verified(raw, signature) {
  if (!signature) return false;
  const expected = createHmac("sha256", SECRET).update(raw).digest("hex");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// Which rule, if any, this event asks for. Pure: decided from the payload only.
function decide(event) {
  const data = event.data ?? {};
  // A pull request got attached to an issue (Linear's GitHub integration): time for the review.
  if ((event.type === "Attachment" || event.type === "IssueAttachment") && event.action === "create" && CONFIG.review
      && /github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(data.url ?? "") && data.issueId) {
    return { rule: "review", issueId: data.issueId, prUrl: data.url };
  }
  // An agent's top-level comment that opens with @<other agent>: relay the mention as a human.
  if (event.type === "Comment" && event.action === "create" && CONFIG.relay && !data.parentId
      && data.userId in CONFIG.agents && data.issueId) {
    const m = /^@([A-Za-z0-9_.-]+)/.exec((data.body ?? "").trim());
    const target = m && Object.entries(CONFIG.agents).find(([, name]) => name === m[1]);
    if (target && target[0] !== data.userId) return { rule: "relay", issueId: data.issueId, mention: m[1], commentId: data.id };
  }
  // A project was created, renamed or had its links changed: rebuild the routing table.
  if (event.type === "Project" && (event.action === "create" || event.action === "update")) return { rule: "sync" };
  if (event.type !== "Issue") return null;
  if (event.action === "update" && Array.isArray(event.updatedFrom?.labelIds)) {
    const before = new Set(event.updatedFrom.labelIds);
    const added = (data.labelIds ?? []).filter((id) => !before.has(id));
    if (added.length) return { rule: "label", addedLabelIds: added };
  }
  if (event.action === "create" && CONFIG.childHandoff && data.delegateId && data.creatorId in CONFIG.agents) {
    return { rule: "handoff", agentId: data.delegateId };
  }
  // A human's new issue that lands in Triage gets a read-only intake triage.
  if (event.action === "create" && CONFIG.triage && !(data.creatorId in CONFIG.agents)) {
    return { rule: "triage" };
  }
  return null;
}

async function apply(decision, issueId) {
  if (decision.rule === "sync") return scheduleSync(decision.reason ?? "project changed");
  const { issue } = await gql(ISSUE, { id: issueId });
  if (!CONFIG.teams.includes(issue.team.key)) return log(`skip ${issue.identifier}: team ${issue.team.key}`);
  const marker = (rule) => `[bridge:${rule}]`;
  const seen = (rule) => issue.comments.nodes.some((c) => c.body.includes(marker(rule)));
  const comment = (body) => gql(`mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success } }`,
    { issueId: issue.id, body });
  // Rules that start an agent need a repository behind the issue's project.
  const unroutable = async (rule) => {
    if (routable(issue)) return false;
    if (!seen("noproject")) await comment(`这个 issue ${issue.project ? `所在的项目「${issue.project.name}」没有绑定仓库` : "没有挂项目"}，agent 无法定位仓库，未执行「${rule}」。请把它挂到一个在 Resources 里带 GitHub 仓库链接的项目，再重新操作。 ${marker("noproject")}`);
    log(`skip ${issue.identifier}: ${rule} but project ${issue.project?.name ?? "-"} is not routable`);
    return true;
  };

  if (decision.rule === "label") {
    const added = issue.labels.nodes.filter((l) => decision.addedLabelIds.includes(l.id)).map((l) => l.name);
    const label = added.find((name) => name in CONFIG.labelTriggers);
    if (!label) return log(`skip ${issue.identifier}: labels ${added.join(",") || "-"} not configured`);
    const rule = `label:${label}`;
    if (seen(rule)) return log(`skip ${issue.identifier}: ${rule} already applied`);
    if (await unroutable(rule)) return;
    const agent = CONFIG.labelTriggers[label];
    await gql(`mutation($id: String!, $delegateId: String!) { issueUpdate(id: $id, input: { delegateId: $delegateId }) { success } }`,
      { id: issue.id, delegateId: agent.id });
    await gql(`mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success } }`,
      { issueId: issue.id, body: `标签 \`${label}\` → 已委派给 ${agent.name}。 ${marker(rule)}` });
    return log(`${issue.identifier}: ${rule} → delegated to ${agent.name}`);
  }

  if (decision.rule === "triage") {
    const rule = "triage";
    if (issue.state.type !== "triage") return log(`skip ${issue.identifier}: state ${issue.state.type}, not triage`);
    if (seen(rule)) return log(`skip ${issue.identifier}: ${rule} already applied`);
    if (await unroutable(rule)) return;
    await gql(`mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success } }`,
      { issueId: issue.id, body: `@${CONFIG.triage.mention} ${CONFIG.triage.prompt} ${marker(rule)}` });
    return log(`${issue.identifier}: ${rule} → mentioned @${CONFIG.triage.mention}`);
  }

  if (decision.rule === "review") {
    const rule = `review:${decision.prUrl}`;
    if (!issue.labels.nodes.some((l) => l.name in CONFIG.labelTriggers)) return log(`skip ${issue.identifier}: PR attached but no trigger label`);
    if (seen(rule)) return log(`skip ${issue.identifier}: ${rule} already applied`);
    const body = `@${CONFIG.review.mention} ${CONFIG.review.prompt.replace("{pr}", decision.prUrl)} ${marker(rule)}`;
    await gql(`mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success } }`,
      { issueId: issue.id, body });
    return log(`${issue.identifier}: review → mentioned @${CONFIG.review.mention} for ${decision.prUrl}`);
  }

  if (decision.rule === "relay") {
    const rule = `relay:${decision.commentId}`;
    if (seen(rule)) return log(`skip ${issue.identifier}: ${rule} already applied`);
    await gql(`mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success } }`,
      { issueId: issue.id, body: `@${decision.mention} 请处理上一条评论（${issue.url}#comment-${decision.commentId}）里列出的阻塞项：逐条修复并推送到同一分支，回复说明每条的处理。 ${marker(rule)}` });
    return log(`${issue.identifier}: relay → mentioned @${decision.mention} (comment ${decision.commentId})`);
  }

  if (decision.rule === "handoff") {
    const rule = "handoff";
    if (seen(rule)) return log(`skip ${issue.identifier}: ${rule} already applied`);
    const mention = CONFIG.agents[decision.agentId];
    if (!mention) return log(`skip ${issue.identifier}: delegate ${decision.agentId} unknown`);
    await gql(`mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success } }`,
      { issueId: issue.id, body: `@${mention} 请按本 issue 的描述执行。 ${marker(rule)}` });
    return log(`${issue.identifier}: ${rule} → mentioned @${mention}`);
  }
}

createServer((req, res) => {
  if (req.method !== "POST") { res.writeHead(200).end("bridge ok\n"); return; }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(chunks);
    if (!verified(raw, req.headers["linear-signature"])) { res.writeHead(401).end(); return log("rejected: bad signature"); }
    let event;
    try { event = JSON.parse(raw.toString("utf8")); } catch { res.writeHead(400).end(); return; }
    if (Math.abs(Date.now() - Number(event.webhookTimestamp)) > 60_000) { res.writeHead(401).end(); return log("rejected: stale timestamp"); }
    res.writeHead(200).end(); // answer within Linear's 5 s budget, then act
    const decision = decide(event);
    log(`event ${event.type}.${event.action} ${event.data?.identifier ?? event.data?.id ?? ""} → ${decision?.rule ?? "ignore"}`);
    if (process.env.BRIDGE_DUMP === "1") log(JSON.stringify(event));
    if (decision) apply(decision, decision.issueId ?? event.data.id).catch((err) => log(`error ${event.data?.identifier ?? decision.issueId}: ${err.message}`));
  });
}).listen(PORT, "127.0.0.1", () => log(`bridge listening on http://127.0.0.1:${PORT}`));
