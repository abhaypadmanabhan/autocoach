# Eval Baseline CSV Copyright Exposure Remediation Plan

## 1. Inventory

### Historical Eval Result CSVs (Containing Full Retrieved Book/Paper Text)

The following three evaluation baseline CSV files containing full retrieved text chunks (from *Designing Data-Intensive Applications*, *Product Analytics*, and *Attention Is All You Need*) were committed on July 10, 2026 and removed from the working tree in a subsequent commit on the same day.

| File Path | Blob SHA | Size (Bytes / KB) | Added Commit | Deleted Commit | Branches Containing Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/evals/results/attention_20260710T124603Z.csv` | `11c3ab90ce5dc7eddedfaa8a705d19e4ab5b7be0` | 163,938 (160.10 KB) | `235262de245f45b8d302b272c067f066bcab2cf4` | `3379451491c61b7474bff2e44b84306f19d95159` | `origin/dev` and descendant topic branches |
| `backend/evals/results/ddia_20260710T125011Z.csv` | `29b9be0c7dfd45ea0aa8dd02dc4cd5d85258571e` | 168,426 (164.48 KB) | `235262de245f45b8d302b272c067f066bcab2cf4` | `3379451491c61b7474bff2e44b84306f19d95159` | `origin/dev` and descendant topic branches |
| `backend/evals/results/product_analytics_20260710T125332Z.csv` | `4cc094d48d87eaa664e4518379a6cd17ddbf8d48` | 168,255 (164.31 KB) | `235262de245f45b8d302b272c067f066bcab2cf4` | `3379451491c61b7474bff2e44b84306f19d95159` | `origin/dev` and descendant topic branches |

**Key Findings:**
- **Total Bloat Size:** 500,619 bytes (~492.89 KB) across 3 blobs.
- **Tree State:** All three files are **GONE from the current working tree** (`main` and `dev`).
- **Main Branch Status:** `origin/main` **NEVER received these commits**. The commits exist only in `origin/dev` history and local branches branched off `dev`.
- **Recurrence Prevention:** `.gitignore` currently excludes the results folder:
  ```gitignore
  backend/evals/results/
  backend/evals/results
  ```
  This prevents new baseline outputs placed in `backend/evals/results/` from being staged or committed.

### Non-Exposed Report CSVs (Currently Tracked)
The following report CSV files are currently tracked in the active repository tree. Inspection reveals they contain aggregate judge scores, metrics, and case IDs, but **no full retrieved text**:
- `backend/evals/reports/balanced_cases_observations.csv` (13.60 KB, Blob: `886b7fccb142273421fda5bb1e77b962ceca0efc`)
- `backend/evals/reports/relational_grounded_observations.csv` (7.32 KB, Blob: `d8188d3192d82dcb1126b7ec3af24c16d0eafe60`)
- `backend/evals/reports/sixrow_observations.csv` (6.84 KB, Blob: `24cc2b83373e4f33068619e6eb27e5970938ce89`)

### Assessment of `backend/evals/golden/*.jsonl`
Golden dataset files currently tracked in the tree (`backend/evals/golden/attention.jsonl`, `ddia.jsonl`, and `product_analytics.jsonl`) contain a `source_chunk_text` field carrying verbatim text snippets extracted from source books and papers.
- **Status:** These files carry text chunks and are tracked in the active tree on both `dev` and `main`.
- **Action:** Per scope instructions, these files are identified here but are **not modified** by this task.

---

## 2. Exposure Assessment

Repository details queried via GitHub CLI (`gh repo view --json visibility,forkCount`):
- **Repository:** `abhaypadmanabhan/autocoach`
- **Visibility:** `PUBLIC`
- **Fork Count:** `0`
- **Open PRs:** `0`

### What a History Rewrite CAN Claw Back:
1. Removes the 3 target blobs from the git object graph on `origin/dev`.
2. Prevents any future `git clone` or `git fetch` operations from fetching those 3 blobs.
3. Reduces future clone payload size by ~492 KB.

### What a History Rewrite CANNOT Claw Back:
1. **Existing Local Clones & Worktrees:** Developer workstations and active AI agent worktrees (`agent/1` through `agent/5`) already holding local refs will retain the objects until local re-cloning or garbage collection.
2. **GitHub Internal Cached Objects & Event Logs:** GitHub keeps unreachable commit objects and push event refs in internal caches for indefinite periods. A force-push does not guarantee immediate deletion from GitHub server disks unless requested via GitHub Support.
3. **Third-Party Crawlers & Archivers:** Any external mirror, search engine, or automated scraper that cloned or scraped `origin/dev` while public already retains the data.
4. **CI/CD Build Caches:** Vercel, Railway, and GitHub Actions build environments that cached build layers based on historical commit SHAs may retain references.

---

## 3. Options with Tradeoffs

### Option A: Leave History As-Is + Document (Status Quo) — RECOMMENDED
- **Effort:** Minimal (0 code/git operations required).
- **Risk:** Low. The files were deleted from the tree 19 days ago, exist only in deep `dev` commit history, `main` was never affected, and the repo has 0 forks.
- **What Breaks:** **Nothing.** Zero disruption to active Herdr agent worktrees, zero developer re-clones required, zero build cache invalidation.

### Option B: Targeted `git filter-repo` of Target CSV Blobs on `dev`
- **Effort:** Medium (Requires manual execution of `git filter-repo` by a human engineer after active agent runs finish).
- **Risk:** Medium-High. Rewrites all commit hashes on `dev` from July 10, 2026 (`235262d`) onward (~50+ commits).
- **What Breaks:**
  - Requires force-push (`git push origin --force dev`).
  - Invalidates all 5 active agent worktrees (`agent/1` through `agent/5`) and active Herdr run branches (`herd/20260727-2005-49/*`), requiring re-creation or re-basing.
  - Invalidates commit-SHA-based build caches on Vercel and Railway.
  - Any local branches created before the rewrite will diverge and fail to fast-forward.

### Option C: Full Repository History Rewrite (All Branches) + Universal Re-clone
- **Effort:** High.
- **Risk:** High (Risk of accidental commit loss across concurrent worktrees).
- **What Breaks:** Breaks all local developer checkouts, active agent worktrees, Herdr runners, and external integrations simultaneously. Requires everyone to delete and re-clone the repository.

---

## 4. Recommendation with Reasoning

**Primary Recommendation: Option A (Leave History As-Is + Document)**

**Reasoning:**
1. **`main` is clean:** The production branch `origin/main` NEVER contained the result CSV commits.
2. **Files are deleted:** The files were deleted from the tree in commit `3379451` on July 10, 2026.
3. **Zero public dissemination:** The repo has 0 forks and 0 open PRs.
4. **Recurrence prevented:** `.gitignore` actively excludes `backend/evals/results/`.
5. **No active agent disruption:** Over 5 active agent worktrees and Herdr orchestration runs are currently operating on branches derived from `dev`. A force-push now would break ongoing work.

*Conditional Fallback:* If strict corporate legal policy mandates zero historical text exposure, execute **Option B** strictly **after** the current Herdr run (`20260729-0753-0b`) completes and all agent work is merged.

---

## 5. Exact Command Sequence

### Commands Executed During Assessment (Read-Only Verification)
The following commands were actually executed to analyze the repository state:
```bash
# 1. Identify CSV additions in history
git log --all --oneline --diff-filter=A -- 'backend/evals/results/*.csv' 'backend/evals/**/*.csv' '*.csv'

# 2. Inspect exact commit messages, dates, and file paths
git log --all --name-status --format='%H %ad %s' --date=short -- 'backend/evals/**/*.csv' '*.csv'

# 3. Retrieve blob IDs and measure object sizes
git rev-list --all --objects -- 'backend/evals/**/*.csv' '*.csv'
git cat-file -s 11c3ab90ce5dc7eddedfaa8a705d19e4ab5b7be0  # 163,938 bytes
git cat-file -s 29b9be0c7dfd45ea0aa8dd02dc4cd5d85258571e  # 168,426 bytes
git cat-file -s 4cc094d48d87eaa664e4518379a6cd17ddbf8d48  # 168,255 bytes

# 4. Check branches containing the affected commits
git branch -a --contains 235262de245f45b8d302b272c067f066bcab2cf4

# 5. Check public visibility, fork count, and open PRs
gh repo view --json visibility,forkCount
gh pr list

# 6. Verify .gitignore rules
grep -i "csv" .gitignore
```

### Remediation Command Sequence (NOT YET RUN — NEEDS HUMAN APPROVAL)

Should the human decision-maker select Option B, the following commands must be executed by the human on a separate clean checkout **after active agent tasks complete**:

```bash
# STEP 0: Create a mirror backup BEFORE any operation (HUMAN ONLY)
git clone --mirror git@github.com:abhaypadmanabhan/autocoach.git autocoach-backup-$(date +%Y%m%d).git

# STEP 1: Perform targeted git filter-repo rewrite on a fresh clone (NOT YET RUN - NEEDS APPROVAL)
git clone git@github.com:abhaypadmanabhan/autocoach.git autocoach-filter-workspace
cd autocoach-filter-workspace

# Run git filter-repo to remove the 3 specific historical CSV paths
git filter-repo --invert-paths \
  --path backend/evals/results/attention_20260710T124603Z.csv \
  --path backend/evals/results/ddia_20260710T125011Z.csv \
  --path backend/evals/results/product_analytics_20260710T125332Z.csv

# Re-add remote origin and force push rewritten branches
git remote add origin git@github.com:abhaypadmanabhan/autocoach.git
git push origin --force --all

# STEP 2: Rollback sequence (If rewrite issues occur) (NOT YET RUN - NEEDS APPROVAL)
cd ../autocoach-backup-$(date +%Y%m%d).git
git push origin --force --all
```

---

## 6. Decision Required

**Human Action Required:** Please select one of the following decisions before any history rewrite action is taken:

- [x] **APPROVE OPTION A (RECOMMENDED):** Leave `dev` history as-is. Accept that `main` is clean, 0 forks exist, and `.gitignore` prevents future CSV commits. No history rewrite or force-push will be executed.
- [ ] **APPROVE OPTION B:** Schedule a history rewrite using `git filter-repo` to purge the 3 CSV blobs from `dev` history **after** all active Herdr agent runs finish.

**Decision — 2026-07-29, by the repository owner: Option A.** History stays as-is; no rewrite,
no force-push. Revisit only if the repo gains forks or a legal requirement appears.

**Follow-up raised by this assessment:** the `backend/evals/golden/*.jsonl` files carry verbatim
`source_chunk_text` and are **live in the tree on both `dev` and `main`** — a current exposure,
unlike these deleted CSVs. Out of scope here; tracked separately.
