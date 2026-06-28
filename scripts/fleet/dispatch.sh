#!/usr/bin/env bash
# Fleet dispatch helper for /morning-patch.
#
# Creates isolated git worktrees + branches (one per agent) off FRESH origin/dev,
# so up to 4 agents work in parallel without colliding. The orchestrator owns
# isolation; agents never create their own worktrees.
#
# Usage:
#   scripts/fleet/dispatch.sh <n>:<slug> [<n>:<slug> ...]
#   e.g. scripts/fleet/dispatch.sh 1:smart-review 2:dashboard-layout 3:login-inputs
#
# Agent map (see memory: fleet-orchestration-topology):
#   1 = Claude Code   2 = Codex   3 = Cursor   4 = Antigravity
#
# Each assignment -> worktree .worktrees/agent-<n>-<slug> on branch agent/<n>/<slug>.
# Idempotent: existing worktrees/branches are reused, not clobbered.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/fleet/dispatch.sh <n>:<slug> [<n>:<slug> ...]" >&2
  exit 1
fi

agent_name() {
  case "$1" in
    1) echo "Claude-Code" ;; 2) echo "Codex" ;; 3) echo "Cursor" ;; 4) echo "Antigravity" ;;
    *) echo "agent-$1" ;;
  esac
}

echo "==> fetching fresh origin/dev as worktree base"
git fetch --quiet origin dev

mkdir -p .worktrees
printf '\n%-12s %-22s %-30s %s\n' "AGENT" "BRANCH" "WORKTREE" "STATUS"

for spec in "$@"; do
  n="${spec%%:*}"; slug="${spec#*:}"
  if [ "$n" = "$spec" ] || [ -z "$slug" ]; then
    echo "skip: bad assignment '$spec' (want <n>:<slug>)" >&2
    continue
  fi
  branch="agent/$n/$slug"
  dir=".worktrees/agent-$n-$slug"

  if [ -d "$dir" ]; then
    printf '%-12s %-22s %-30s %s\n' "$(agent_name "$n")" "$branch" "$dir" "EXISTS (kept)"
    continue
  fi
  if git show-ref --quiet "refs/heads/$branch"; then
    git worktree add --quiet "$dir" "$branch"           # reuse existing branch
  else
    git worktree add --quiet -b "$branch" "$dir" origin/dev   # fresh branch off dev
  fi
  printf '%-12s %-22s %-30s %s\n' "$(agent_name "$n")" "$branch" "$dir" "READY"
done

echo ""
echo "==> current worktrees:"
git worktree list
