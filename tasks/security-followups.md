# Security Followups

Filed 2026-05-11 after full security audit. Criticals + High-severity items already shipped on `main` (see commit history). Items below are residual risk or hardenings to schedule.

## 1. XP redemption — CAS already atomic, partial-commit residual (LOW)

**File:** `backend/app/api/routes/xp.py:25-90`

**Original audit claim (wrong):** "Two concurrent requests can both pass the optimistic CAS in a narrow MVCC window."

**Actual behavior:** PostgREST compiles `.update({...}).eq("id", uid).eq("total_xp", current_xp)` into a single `UPDATE users SET total_xp=$1 WHERE id=$2 AND total_xp=$3` statement. Under READ COMMITTED (PostgREST's default isolation), Postgres acquires a row-level lock on the matching row; the losing concurrent UPDATE re-reads the row's post-commit version, the predicate `total_xp=$3` fails, and zero rows are returned. The route then raises 409. Race is impossible.

Verified by `test_redeem_xp_cas_mismatch_returns_409` (added 2026-05-14): mocks the CAS-mismatch case and confirms 409 + zero credit-grant attempts.

**Residual risk:** The deduct (`users.update`) and the credit grant (`user_daily_usage.update`) are two separate statements, not one transaction. Python exceptions between them are caught and the deduct is refunded (`xp.py:79-83`). Process kill / power loss between the two statements leaks 100 XP (one extra quiz credit lost). Bounded — once per occurrence, not amplifiable.

**Future hardening (not urgent):** consolidate deduct + credit into a single Postgres function called via `supabase_admin.rpc("redeem_xp", {...})`. No `.rpc()` precedent in the codebase today; adding one would require an Alembic migration creating the function. Defer until the partial-commit residual actually shows up in logs.

---

## 2. Per-worker in-memory rate limiter (MEDIUM)

**File:** `backend/app/core/rate_limit.py`

**Risk:** Each `uvicorn` worker / Railway replica has its own dict. Effective limit = `quiz_requests_per_minute × N_workers × N_replicas`. Currently single replica, single worker — no exploit today. Becomes real if we scale.

**Fix:** Move to Redis (Upstash via Vercel Marketplace already in stack) or Postgres-backed counter. Or document that the per-minute limit is best-effort and rely on the daily Postgres-backed `user_daily_usage` quota as the real gate.

Also: dict grows unbounded — leaks memory per unique user_id over time. Add periodic eviction or TTL.

---

## 3. CORS env trust (LOW)

**File:** `backend/app/config.py:68-95`

**Risk:** `FRONTEND_ORIGINS` env value is split + appended to allow-list without validation. A misconfigured Railway env (`FRONTEND_ORIGINS=https://evil.com,...`) silently widens CORS. Bounded because `cors_allow_credentials=False`, but the `Authorization` header could still be sent by JS on a malicious origin if a user pasted a token.

**Fix:** Validate each origin against a regex allowlist before adding:
```python
ALLOWED_ORIGIN_RE = re.compile(r"^https://([a-z0-9-]+\.)?autocoach[a-z0-9-]*\.(vercel\.app|com)$|^http://localhost:\d+$")
```
Reject + warn-log unmatched origins.

---

## 4. CSP `unsafe-inline` in script-src (LOW)

**File:** `frontend/next.config.ts:15`

**Risk:** `script-src 'unsafe-inline'` weakens XSS defense. Next 16 currently needs it for inline scripts. Codebase has zero `dangerouslySetInnerHTML`, so XSS surface is minimal — but defense in depth.

**Fix:** Migrate to nonce-based CSP. Next.js docs: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy. Generates a nonce per request via middleware, allows only scripts with matching `nonce` attribute.

---

## 5. Service-role key partial leak in logs (LOW)

**File:** `backend/app/core/supabase.py:54`

**Risk:** Startup banner logs last-6 chars of `supabase_secret_key` for ops sanity. Narrows brute-force search space.

**Fix:** Log only `len(key)` instead of suffix. Suffix added zero diagnostic value over length anyway.

---

## 6. PostgREST `or_` filter built with f-string (LOW — defensive)

**File:** `backend/app/services/concepts.py:535`

**Risk:** Today, both `practice_col` (hardcoded enum) and `stale_threshold` (server-generated ISO datetime) are trusted. Pattern is risky — a future change wiring user input here would be PostgREST injection (no parameterization in `or_` DSL).

**Fix:** Add inline assertion / type narrowing, or split into two queries. At minimum: comment marking the invariant.

---

## 7. Migration `6e3be108bedc` missing DROP CONSTRAINT (HIGH for fresh deploys, not security strictly)

**File:** `backend/alembic/versions/6e3be108bedc_*.py`

**Risk:** Already in HANDOFF.md followups. Carried over because it can break a fresh deploy mid-migration leaving DB in indeterminate state.

**Fix:** Add `op.execute("ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_type_check")` as first line of `upgrade()`.

---

## What was already fixed (this audit)

- Prompt injection on free-text grading — `<student_answer>` envelope + sanitizer + fail-closed defaults (`answer_evaluator.py`)
- Unbounded `AnswerSubmit.answer` / `SearchRequest.query` / `top_k` — Pydantic `Field(max_length=..., ge=..., le=...)` (`models/quiz.py`, `models/documents.py`)
- File-bomb DoS — actual byte cap post-download, extracted-text cap, chunk count cap (`services/ingestion.py`)
- JSON-bomb on onboarding — `learning_topics` 10KB cap + string field caps (`schemas/onboarding.py`)
- 422 body log leak — truncate + JWT pattern redaction (`main.py`)
- Misleading `RedeemXPRequest.amount` field — removed (`api/routes/xp.py`)

## Reviewed and OK

- AuthN/AuthZ: every route uses `Depends(get_user_id_from_token)`, `user_id` always derived from token
- IDOR: every backend query filters `eq("user_id", str(user_id))` despite service-role bypassing RLS
- SQL injection: no raw SQL, PostgREST parameterized everywhere
- SSRF: no user-controlled outbound URLs
- XSS: zero `dangerouslySetInnerHTML` in frontend
- Secrets in source: only `.env.example` tracked
- Storage path traversal: `startswith(f"{user_id}/")` check sufficient (Supabase paths are opaque keys)
- Dependency CVEs: pypdf 6.6.2, python-pptx 1.0.2, pillow 12.1.0, requests 2.32.5, cryptography 46.0.4 — all current as of audit
