#!/usr/bin/env bash
# Printed at SessionStart so the orchestrator opens with the fleet queue + branch state.
# Must be fast and never block the session — single gh call, swallow all errors.
set -uo pipefail
command -v gh >/dev/null 2>&1 || exit 0

summary=$(gh issue list --state open --limit 200 --json labels 2>/dev/null | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
def has(it, n):
    return any(l.get("name") == n for l in it.get("labels", []))
p0 = sum(1 for i in d if has(i, "P0"))
p1 = sum(1 for i in d if has(i, "P1"))
print(f"{len(d)} open (P0:{p0} P1:{p1})")
' 2>/dev/null) || exit 0

[ -z "${summary:-}" ] && exit 0
ahead=$(git rev-list --count origin/main..origin/dev 2>/dev/null || echo "?")

echo "FLEET BACKLOG: ${summary} · dev ahead of main by ${ahead} commits · run /morning-patch to dispatch, /morning-patch-merge to integrate"
