---
description: Morning fleet dispatch — turn top GitHub issues into per-agent worktrees + paste-ready prompts
argument-hint: "[count, default 4] [--priority P0,P1]"
---

You are the **cloud orchestrator** for the AutoCoach agent fleet. Run the morning dispatch.
**Do NOT implement any issue yourself** — your only job is to decompose, isolate, and dispatch.

**Fleet** (see memory `fleet-orchestration-topology`): max 4 agents, each on its own terminal + worktree.
`1 = Claude Code` (top priority / hardest) · `2 = Codex` · `3 = Cursor` · `4 = Antigravity` (small things).

Arguments: `$ARGUMENTS` (optional issue count, default 4; optional `--priority` filter).

Execute in order:

1. **Pull the queue.** `gh issue list --state open --label P0` then `P1`, then `P2`, sorted by priority. Respect any count/priority in `$ARGUMENTS` (default: top 4 unblocked issues by priority). Print the candidate list (number, title, labels).

2. **Cluster + collision-guard.** For each candidate, infer its likely file-set from the issue body's `file:line` refs and its `area:` label. Group assignments so **no two agents touch the same files**. If two issues overlap a file, assign them to the **same** agent to run **sequentially** — never split overlapping files across parallel agents. Prefer one issue per agent on the first run. State the file-set per assignment so the guard is auditable.

3. **Assign by tier.** Hardest / P0 / backend-core → agent 1 (Claude Code). Then 2, 3, 4 by descending difficulty. Antigravity (4) gets the smallest/mechanical work. Cap at 4 agents.

4. **Write briefs.** For each assignment write `tasks/briefs/<issue#>-<slug>.md` containing: **problem**, **in-scope files** (explicit allow-list), **out-of-scope** (files another agent owns — name them), **acceptance criteria**, **test/verify plan**. Keep each brief tight.

5. **Scaffold worktrees.** Run `scripts/fleet/dispatch.sh <n>:<slug> ...` with every assignment. It creates each isolated worktree + `agent/<n>/<slug>` branch off **fresh origin/dev**.

6. **Emit prompts.** Output one fenced ``` block per agent, ready for the human to paste into that agent's terminal. Each block MUST include:
   - the issue ref + GitHub link, and the brief path
   - the worktree path + branch (`cd` there first)
   - **scope guardrails**: "only modify the files in your allow-list; another agent owns the rest — do not touch them"
   - acceptance criteria + how to self-verify (run the relevant CI checks locally)
   - the rule: **"commit on your branch only. Do NOT push to dev or merge. When done, tell the human 'agent <n> done'."**

**Stop after emitting the prompts.** Do not start work. When the human returns and says the agents are done, they run `/morning-patch-merge`.
