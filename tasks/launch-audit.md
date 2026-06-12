# Pre-Launch Audit — 2026-06-11

Scope: legal/compliance readiness, security (incl. prompt injection), known bugs/ops gaps before public announcement. Three parallel code audits; top findings spot-checked against source. One agent finding (missing user_id check in `submit_answer`) was verified **false** and discarded — session ownership is enforced at `session_manager.py:816`.

**Decision made in this session:** report-only for security/GDPR; privacy + terms template pages added (`/privacy`, `/terms`), signup links fixed.

---

## TL;DR — answers to the launch questions

| Question | Answer |
|---|---|
| Privacy policy needed? | **Yes** — required (PostHog analytics, EU users possible, user uploads). Draft now live at `/privacy` — review before launch. |
| Terms of Service needed? | **Yes** — draft now live at `/terms`. |
| EULA needed? | **No** — EULAs are for installed/distributed software. ToS covers a web app. |
| SOC2 needed? | **No** — SOC2 is a B2B enterprise sales artifact requiring a paid audit (~$10–30k+). Irrelevant for a consumer launch. Revisit only when an enterprise customer asks. |
| Critical security holes? | **None found that allow cross-user data access.** AuthZ, XSS, SQLi, SSRF, secrets all verified clean. Medium items below. |
| Ready for public post? | **Almost.** Do the Launch Blockers checklist below first (~half a day). |

---

## Launch Blockers (do before public post)

- [ ] **Review + edit the legal drafts** at `frontend/src/app/privacy/page.tsx` and `frontend/src/app/terms/page.tsx`. They are templates, not legal advice. Fill in: governing-law jurisdiction (terms §08), confirm contact email, verify the "providers don't train on API data" claim against current Moonshot/OpenAI API terms.
- [ ] **PostHog session recording** — not explicitly disabled in `frontend/src/lib/analytics.ts` init. Add `disable_session_recording: true` (or verify off in PostHog dashboard). Recording sessions without consent is the biggest privacy exposure here.
- [ ] **Error visibility** — Langfuse is NOOP and there is no Sentry. If launch traffic breaks something, you're blind. Either finish Langfuse Cloud Phase 0 (`tasks/todo.md`, ~5 min once keys exist) or add Sentry free tier to the backend.
- [ ] **Account deletion stopgap** — no self-serve deletion exists. Privacy draft promises deletion-on-email within 30 days; make sure you can actually fulfill that (Supabase: delete auth user + cascade documents/chunks/sessions + Qdrant points). A small admin script is enough for launch.

## Should fix soon (first week post-launch)

### Security — medium

- [ ] **Prompt-injection envelope for concept extraction** — `backend/app/services/concepts.py:146` embeds raw document chunk text in the LLM prompt with no untrusted-content delimiters. A poisoned PDF can steer concept extraction. Copy the pattern already used in `answer_evaluator.py` (wraps content in tags + strips closing tags). Effort: ~30 min.
- [ ] **Validate LLM quiz output before DB insert** — `backend/app/services/quiz_generator.py:340-372` parses LLM JSON with no Pydantic schema, no length caps, no check that returned `concept_id` is in the requested set. Add a Pydantic model with max lengths + concept_id allowlist. Effort: ~1 hr.
- [ ] **XP refund race** — `backend/app/api/routes/xp.py:83` refunds blindly on credit-grant failure; concurrent spend can double XP. One-line fix: add `.eq("total_xp", new_xp)` CAS guard to the refund update. Also resolves the one failing test (`test_redeem_xp_refund_on_failure`). Partial-commit risk already documented at `xp.py:29-32`.
- [ ] **Server-side route protection** — no root `frontend/src/middleware.ts`; protected pages rely on client-side session checks. Add middleware redirect for /dashboard, /upload, /session, /settings, /results. (Note: data is still safe — backend enforces auth — this is UX/defense-in-depth.)
- [ ] **Password minimum** — `frontend/src/lib/validation/auth.ts:13` allows 6 chars. Raise to 8 (placeholder text already says "At least 8 characters"). Also set Supabase Auth min length server-side.

### Security — low / hardening

- [ ] Reject `..` in `register_document` path — `backend/app/api/routes/documents.py:240` only checks prefix. Supabase Storage keys are literal so traversal is unlikely, but `if ".." in request.file_path: raise 400` is free.
- [ ] Stop leaking storage errors to clients — `documents.py:156` returns raw Supabase error in detail. Return generic message, log real error.
- [ ] Validate upload Content-Type to pdf/pptx allowlist (`documents.py:149`) — mitigated by magic-byte parsing, but cheap.
- [ ] Add `Strict-Transport-Security` + `Permissions-Policy` headers in `frontend/next.config.ts`.
- [ ] Analytics opt-out toggle in settings (pairs with privacy policy claim of user choice).

### Ops

- [ ] **LLM single point of failure** — quiz generation has no fallback if Kimi key fails/billing lapses → 50x errors. (OpenAI fallback exists only in the free-text eval cascade.) Decide: accept risk, or wire `call_openai` fallback into `quiz_generator` too.
- [ ] In-memory rate limiter is per-worker (`core/rate_limit.py`) — known; Postgres daily quotas are the real gate. Fine at current scale, revisit on multi-replica.
- [ ] Add LICENSE file if repo is/becomes public (or keep repo private — then skip).

## Nice to have

- [ ] Data export endpoint (GDPR Art. 20) — email-based fulfillment is acceptable at this scale.
- [ ] Cookie-consent banner — PostHog with PII-stripped events + no session recording is defensible without one for a US-targeted launch; add if targeting EU seriously.
- [ ] PII (user_id) scrubbing in backend logs.
- [ ] Drop orphan `daily_sprints` table.
- [ ] CSP nonce instead of `'unsafe-inline'` script-src.

---

## Verified SAFE (audited, no action)

- **AuthZ**: every route derives user_id from JWT (`get_user_id_from_token`), all service-role queries filter `.eq("user_id", ...)`. Spot-checked `submit_answer` (`session_manager.py:812-835`) — session + question both scoped correctly.
- **XSS**: zero `dangerouslySetInnerHTML`; LLM content rendered as React text; no markdown-to-HTML libs.
- **SQLi**: all queries via Supabase client builders, no raw SQL.
- **SSRF**: no user-controlled URL fetching.
- **Secrets**: nothing committed (`.gitignore` covers `.env*`), JWTs redacted from request logs (`main.py` `_safe_body_for_log`), only publishable keys in `NEXT_PUBLIC_*`.
- **Prompt injection (answer path)**: `answer_evaluator.py` wraps user answers in delimiters and strips closing tags before LLM eval.
- **Uploads**: extension allowlist, 20MB limit, per-user path prefix check, magic-byte validation via pypdf/python-pptx, 2-doc + 5-session/day quotas with atomic CAS.
- **Analytics**: PostHog events sanitized — email/token/raw_text/content stripped before capture; no-op when key missing.
- **Dependencies**: current, no known high CVEs (FastAPI 0.128.0, Next 16.1.6, React 19.2.3, PyJWT 2.10.1, supabase-js 2.93.2, supabase-py 2.27.2).
- **Tests**: 65/66 passing; sole failure is the XP refund race above.

---

## Changes made in this session

1. `frontend/src/app/privacy/page.tsx` — new privacy policy draft (Quiet Brutalism styled).
2. `frontend/src/app/terms/page.tsx` — new ToS draft.
3. `frontend/src/app/(auth)/signup/page.tsx:259,263` — Terms/Privacy links now point to `/terms` and `/privacy` instead of `#` (removes false-consent problem).
