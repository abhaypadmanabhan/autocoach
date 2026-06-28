---
description: Collect finished fleet branches — verify, review, merge green ones to dev
argument-hint: "[agent numbers, default all]"
---

You are the **cloud orchestrator** collecting finished fleet work. The agents have committed on their
`agent/*` branches in their worktrees. Verify and integrate. Process the agents named in `$ARGUMENTS`,
or every `agent/*` branch with commits if none given.

For each branch:

1. **Inspect.** `git fetch`; show `git diff --stat origin/dev...agent/<n>/<slug>`. Confirm it touched **only** the allow-listed files from its brief (`tasks/briefs/<issue#>-<slug>.md`). **Flag any scope violation** — files another agent owned, or out-of-scope edits.

2. **Verify CI locally** in that worktree (must be green before review):
   - backend: `python -m pytest -q --ignore=tests/test_evals_review_fixes.py` with dummy env (`QDRANT_URL`, `QDRANT_API_KEY`, `KIMI_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `ENVIRONMENT=test`)
   - frontend: `npx tsc --noEmit` and `npm run lint`

3. **Review the diff.** Run `/code-review`, then `/simplify`, then `/security-review` on the branch diff. Resolve blocking findings; if a fix is non-trivial, **bounce** it back to the agent rather than fixing silently.

4. **Merge green + clean branches to dev.** Open a PR (`gh pr create --base dev --head agent/<n>/<slug>`) so branch protection + CI run, then `gh pr merge --squash`. Put `Closes #<issue>` in the PR so the issue closes on the eventual dev→main. (Direct `git merge` only as admin fallback.)

5. **Bounce red/dirty branches.** Summarize exactly what failed (test, scope, review), leave the worktree intact, and tell the human to re-prompt that agent. Do not merge.

6. **Cleanup merged work.** After merge: `git worktree remove .worktrees/agent-<n>-<slug>` and delete the merged branch (`git branch -d` / `git push origin --delete`).

7. **Report.** A table — `agent · issue · verdict (merged / bounced) · notes`.

**Then the dev→main promotion** (only when all intended work is merged and dev CI is green):
run `/code-review` + `/security-review` on the aggregate dev-vs-main diff, summarize, and **confirm with the human before pushing main** (main push = Railway + Vercel prod deploy). Never auto-push main.
