# Self-host Langfuse on Railway (Phase 1.7)

## Context

Phase 1.7 instruments every LLM + retrieval call in the FastAPI backend so we can debug RAG quality, watch token cost, and (later) drive Ragas/DeepEval offline scoring. Decision is locked on **self-hosted Langfuse** (not Cloud, not LangSmith) for data ownership and to keep eval traces co-located with the rest of our infra.

This spec covers deployment, secrets, networking, retention, backend integration, verification, and rollback. No infra is created and no code is changed by this document — it is the review gate before that work begins.

---

## 1. Deployment topology

### Template

Langfuse publishes an official Railway one-click template at https://langfuse.com/self-hosting/railway. Template URL: `https://railway.com/deploy/exma_H?referralCode=513qqz`. The page does not publish a last-updated date, so verify the template's maintainer and last commit on the Railway template page before clicking deploy.

### Service inventory (Langfuse platform v3 / SDK v4)

| Service | Purpose | Notes |
|---|---|---|
| `langfuse-web` | Next.js UI + ingestion API + public REST API | Runs Postgres + ClickHouse migrations on startup. |
| `langfuse-worker` | Async event processing, tokenization, evaluations, batch exports, retention deletes | Runs background data-backfill migrations on startup. |
| Postgres | OLTP — users, projects, API keys, prompts, configs | Dedicated DB, **not** shared with autocoach's Supabase. |
| ClickHouse | OLAP — traces, observations, scores | Replaces v2's overloaded Postgres. |
| Redis / Valkey | Cache (300s default TTL) **and** BullMQ queue web→worker | Single instance acceptable for dev. |
| MinIO | S3-compatible blob — raw event payloads + media uploads | `LANGFUSE_S3_*_FORCE_PATH_STYLE=true` required. |

**v2→v3 rationale:** Postgres bottlenecks at trace volume, so v3 splits OLAP to ClickHouse, async work to a worker, and absorbs spikes via Redis + S3. Source: https://langfuse.com/changelog/2024-12-09-Langfuse-v3-stable-release.

### Project placement (decision)

**Co-locate in the existing `autocoach-production` Railway project as separate services.** Rationale: Railway private networking (`*.railway.internal`) is per-project only — separating projects forces public HTTPS hops with $0.05/GB egress and added latency. Co-located services still get independent restart/scale; Langfuse misbehavior won't bring down FastAPI as long as instrumentation is non-blocking (see §5 Failure mode).

Trade-off accepted: shared Railway billing line, one Pro-plan base fee instead of two.

### Resource footprint

Conservative dev sizing — to be revised after first week of traffic:

| Service | RAM | vCPU | Volume |
|---|---|---|---|
| langfuse-web | 1 GB | 0.5 | — |
| langfuse-worker | 1 GB | 0.5 | — |
| Postgres | 0.5 GB | 0.25 | 5 GB |
| ClickHouse | 2 GB | 0.5 | 10 GB |
| Redis | 0.25 GB | 0.1 | — |
| MinIO | 0.5 GB | 0.25 | 10 GB |

**Disclaimer — sized below stated production minimum.** Langfuse's self-hosting docs state a 2 vCPU / 4 GB-RAM-per-container production minimum. The figures above are deliberately under that floor because Phase 1.7 traffic is dev-scale (single-operator, low-volume tracing). Acceptable for now; revisit and resize before any traffic that depends on Langfuse uptime (e.g. customer-facing analytics, automated eval gates). Tripwire: when §4's backup-revisit clause fires, this footprint gets resized at the same time.

---

## 2. Secrets & config

### Generated on operator's laptop, pasted into Railway

| Var | Generation | Format |
|---|---|---|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | ≥256 bits |
| `SALT` | `openssl rand -base64 32` | ≥256 bits |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | exactly 64 hex chars |

Store generated values in 1Password (or equivalent) before pasting — Railway's UI will not redisplay them.

### Provided by Railway service references (no manual entry)

`DATABASE_URL` (Postgres), `CLICKHOUSE_URL`, `CLICKHOUSE_MIGRATION_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `REDIS_CONNECTION_STRING` (or four-tuple), and the MinIO `LANGFUSE_S3_*_BUCKET / _REGION / _ENDPOINT / _ACCESS_KEY_ID / _SECRET_ACCESS_KEY` — all wired by the Railway template via `${{Postgres.DATABASE_URL}}`-style references.

Set explicitly:
- `CLICKHOUSE_CLUSTER_ENABLED=false`
- `LANGFUSE_S3_*_FORCE_PATH_STYLE=true`
- `NEXTAUTH_URL` = the public URL Railway assigns to `langfuse-web` (e.g. `https://langfuse-web-production-xxxx.up.railway.app`).

### Headless project bootstrap (one-time, on first deploy)

Use https://langfuse.com/self-hosting/headless-initialization to create org/project/user/API-keys without clicking through the UI:

- `LANGFUSE_INIT_ORG_ID`, `LANGFUSE_INIT_ORG_NAME`
- `LANGFUSE_INIT_PROJECT_ID`, `LANGFUSE_INIT_PROJECT_NAME`
- `LANGFUSE_INIT_PROJECT_PUBLIC_KEY`, `LANGFUSE_INIT_PROJECT_SECRET_KEY` ← these become the SDK keys autocoach uses
- `LANGFUSE_INIT_PROJECT_RETENTION` ← see §4
- `LANGFUSE_INIT_USER_EMAIL`, `LANGFUSE_INIT_USER_NAME`, `LANGFUSE_INIT_USER_PASSWORD`

Generate the public/secret key pair locally (any 32-char base64 strings work) and store in 1Password before deploy. After first successful boot, these env vars can be removed — they are read once at init.

### Backend (autocoach-production) consumer-side env

Set on the existing FastAPI service in Railway, **never committed**:

- `LANGFUSE_PUBLIC_KEY` — copy from `LANGFUSE_INIT_PROJECT_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY` — copy from `LANGFUSE_INIT_PROJECT_SECRET_KEY`
- `LANGFUSE_HOST` — `http://langfuse-web.railway.internal:3000` (intra-project private DNS)
- `LANGFUSE_ENVIRONMENT=production`

Pulled into local `.env` (gitignored) only when the operator wants to point local dev at the prod Langfuse (not the default — see §5).

---

## 3. Networking

- **Public URL:** Railway-provided `*.up.railway.app` for `langfuse-web` is acceptable for Phase 1.7. Custom domain (`langfuse.autocoach.app`) deferred — no operational need until a teammate other than the operator needs UI access.
- **Backend → Langfuse traffic:** stays internal via `langfuse-web.railway.internal:3000`. Set `LANGFUSE_HOST` accordingly. Fall back to public URL only if internal DNS resolution fails.
- **Frontend CSP:** verified at `frontend/next.config.ts:12–21`. Current `connect-src` allows `'self'`, `*.supabase.co`, PostHog, and `BACKEND_URL`. **No CSP change required** — Langfuse ingestion is backend-only; the frontend never talks to Langfuse directly.

---

## 4. Data retention & cost

### Retention

Default: **indefinite** (Langfuse stores traces/observations/scores forever). Configured per-project, minimum 3 days. Set on Phase 1.7 first deploy via `LANGFUSE_INIT_PROJECT_RETENTION=30` (30 days = 4× our typical iteration cycle, plenty for debugging without unbounded ClickHouse growth). Mechanism: nightly worker job that deletes via `s3:DeleteObject` + ClickHouse partition drop.

### Cost (Railway Pro plan, dev traffic)

Per-resource: $10/GB-RAM/mo, $20/vCPU/mo, $0.15/GB-volume/mo, $0.05/GB egress.

Estimate using §1 sizing: **~$100–120/mo all-in** including the existing $20 Pro base (which covers $20 of usage). ClickHouse is the largest line item (~$32/mo). Hobby plan does not fit. Source: https://docs.railway.com/reference/pricing.

### Backup

Rely on Railway managed Postgres daily snapshots; revisit if/when Langfuse data becomes load-bearing for product decisions rather than just dev observability. (Tripwire: the moment a PRD or experiment readout cites Langfuse-derived numbers, this section gets revised and a real backup story specced.)

---

## 5. Backend integration plan

### Client init module

New file: **`backend/app/observability/langfuse.py`**.

**SDK target:** `langfuse>=4.5,<5`. Pin `4.5.x` (current stable as of 2026-05-08); `4.6.x` is still beta. Backend already runs Pydantic 2.12.5 (`backend/requirements.txt:44`), satisfying v4's Pydantic-v2 requirement. The v4 SDK is **OpenTelemetry-native** — public surface uses OTel concepts (spans, context propagation), not the v3 `langfuse_context` module.

Imports (v4 API):
```python
from langfuse import observe, get_client
```

Responsibilities:
1. Read `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`, `LANGFUSE_ENVIRONMENT` from `app/config.py` settings.
2. If any of the three keys/host is missing → NOOP path: do not call `get_client()`. Log once at startup that Langfuse is disabled. No exception. The `@observe()` decorators stay in place but the SDK becomes a no-op when no client has been initialized.
3. If all present → initialize the v4 client (env vars are auto-read by the SDK; `get_client()` returns the singleton). Configure `release=<git sha>` from `RAILWAY_GIT_COMMIT_SHA`.
4. Set the **global environment tag** on every trace via the SDK's environment field, sourced from `LANGFUSE_ENVIRONMENT`. Allowed values: `production | development | ci | eval`. Default to `development` when unset (i.e. local uvicorn with no Railway env).
5. Expose a single `langfuse` module-level handle other modules import.
6. Hook `langfuse.flush()` into the FastAPI lifespan shutdown handler. Verified at `backend/app/main.py:31–42`: `@asynccontextmanager` decorator at line 31, `async def lifespan(app: FastAPI)` at line 32, attached to the app via `lifespan=lifespan` at line 49. Add the flush after the `yield` (post-shutdown log line) so graceful Railway restarts don't drop buffered events.

### Where `LANGFUSE_ENVIRONMENT` is set

| Context | Value | How |
|---|---|---|
| Production Railway deploy | `production` | Railway env var on autocoach-production service |
| Local `uvicorn --reload` | `development` | Default when env var unset; no `.env` change needed |
| CI test runs | `ci` | Set in `.github/workflows/*.yml` env block (when CI lands) |
| Phase 1.7 step 5 golden-set eval runs | `eval` | Set in the eval harness shell script before invoking the runner |

This tagging matters because step 5's 50-question golden set will replay against prod-like traffic; without `eval` segregation, those traces would skew aggregate latency/cost dashboards.

### Call sites to instrument with `@observe()`

Verified locations from backend recon:

| Call site | File:line | Decorator name suggestion | as_type |
|---|---|---|---|
| Quiz question generation (Kimi) | `backend/app/services/quiz_generator.py:326` (`generate_quiz_questions`) | `quiz.generate_questions` | `generation` |
| Quiz fallback (OpenAI) | `backend/app/services/quiz_generator.py:357` | covered by parent span | — |
| Concept extraction during ingestion | `backend/app/services/quiz_generator.py:144` (`extract_concepts_from_content`) | `ingestion.extract_concepts` | `generation` |
| Free-text answer eval (Kimi → OpenAI fallback) | `backend/app/services/answer_evaluator.py:141` (`evaluate_free_text`) | `quiz.evaluate_free_text` | `generation` |
| Embedding generation | `backend/app/services/embeddings.py:51` (`get_embeddings`) | `embeddings.openai_3_small` | `generation` |
| Qdrant retrieval | `backend/app/services/retrieval.py:26` (`retrieve_relevant_chunks`) | `retrieval.qdrant` | `span` |
| Mastery update | `backend/app/services/session_manager.py:97` (`_update_concept_mastery`) | `session.update_mastery` | `span` |

The lower-level wrappers in `backend/app/services/llm.py` (`call_kimi`, `call_openai`) are intentionally **not** instrumented at the wrapper level — instrumenting at the service-method level produces meaningfully named spans (`quiz.generate_questions` vs anonymous `call_kimi`).

### Cross-async-boundary trace propagation (forward-looking)

HANDOFF.md follow-up #2 will move `evaluate_free_text` off the request path into a background worker (currently ~2 s p50 inline). When that PR lands, the request handler's `@observe()` span will close before the eval completes, breaking the trace tree unless we explicitly carry parent context.

The v4 SDK's OTel-native API exposes **`propagate_attributes()`** (or equivalent OTel `extract` / `inject` helpers) for serializing the active trace context across an async boundary. The pattern at PR time:
1. Producer (request handler) calls `propagate_attributes()` → attaches the carrier dict to the queued job payload.
2. Consumer (background worker) reads the carrier, calls the symmetric extractor, and runs the work inside a child span of the original trace.

Out of scope to implement here. Flag this in the follow-up #2 PR description.

### Local dev behavior

NOOP path is the default — operator runs `uvicorn app.main:app --reload` with no Langfuse env vars and Phase 1.7 instrumentation is silent. Override paths if/when needed:

- **Point local at prod Langfuse:** copy `LANGFUSE_PUBLIC_KEY` / `_SECRET_KEY` / `_HOST` into local `.env`, set `LANGFUSE_ENVIRONMENT=development` so traces don't pollute prod aggregates.
- **Local docker-compose stack:** explicitly out of scope for Phase 1.7.

### Failure mode

Langfuse Python SDK v4+ is documented as: "**Cannot break your application: SDK errors are caught and logged.**" and "fully async … almost no latency." Source: https://langfuse.com/docs/observability/sdk/overview.

This means:
- If Langfuse is down or unreachable, `@observe()` calls swallow the error and the request path continues.
- We do **not** add a separate timeout/circuit breaker. The SDK's built-in async batching is sufficient.
- We rely on the NOOP-when-keys-missing path (above) as the operator-facing kill switch (see §7 Rollback).

---

## 6. Verification checklist

Run in order. Each step blocks the next.

1. **Langfuse-web up:**
   `curl https://<langfuse-web-public-url>/api/public/health`
   Expect `200 OK`. Then `curl 'https://<…>/api/public/health?failIfDatabaseUnavailable=true'` to also probe Postgres + ClickHouse.

2. **Langfuse UI reachable:**
   Open the public URL in a browser, sign in as the bootstrapped user, confirm the `autocoach` project exists and shows the API keys.

3. **Migrations completed cleanly:**
   `railway logs --service langfuse-web` → search for "schema migrations applied". `railway logs --service langfuse-worker` → search for "background migrations". No "ECONNREFUSED" or migration-lock errors.

4. **No collision with autocoach alembic:**
   Restart `autocoach-production` service. `railway logs --service autocoach-production` → confirm `alembic upgrade head` runs against Supabase Postgres and Langfuse migrations run against the dedicated Railway Postgres. They share no database.

5. **End-to-end smoke test (the gate):**
   Set `LANGFUSE_*` env on autocoach-production, redeploy. Trigger one quiz question generation by `POST /quiz/sessions/` against a known document. Within 30 seconds, the trace must appear in Langfuse UI under the `autocoach` project with: parent span `quiz.generate_questions`, child generation span tagged with whatever Kimi model identifier is currently configured in `backend/app/services/llm.py` (`KIMI_MODEL` constant at line 15 — `kimi-k2.5` today, `kimi-k2.6` after the planned model upgrade), environment tag `production`, and `release=<git sha>`.

6. **Failure mode probe:**
   Stop the `langfuse-web` service. Trigger another quiz session. Confirm: (a) request succeeds with normal latency, (b) backend logs show one Langfuse warning (no traceback), (c) when langfuse-web comes back, queued events from the SDK's local buffer flush.

---

## 7. Rollback

Two-tier kill switch, no redeploy required for tier 1:

**Tier 1 — disable instrumentation in autocoach-production:**
Remove `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST` from the autocoach-production env in Railway. Restart the service. The init module's NOOP path takes over (§5). No code change. ETA: <2 minutes.

**Tier 2 — bring down Langfuse stack itself:**
In Railway, stop `langfuse-web` and `langfuse-worker`. Postgres/ClickHouse/Redis/MinIO remain so trace history is preserved. Backend must already be on Tier 1 — otherwise it queues events to a dead host until the SDK's buffer fills.

**Full removal (only if Phase 1.7 is abandoned):**
Delete the four data services last. Drop the langfuse Postgres/ClickHouse volumes. Remove the four `LANGFUSE_*` env vars from autocoach-production.

---

## 8. Out of scope for this spec

Per user constraint: Ragas / DeepEval wiring (Phase 1.7 step 4+), golden eval-set construction, chunking sweep work. These get their own specs once Langfuse is collecting traces.

### Adjacent: Kimi K2.6 model upgrade

Tracked as parallel work, not part of this spec. K2.6 is the new current Moonshot model and the API has been updated. Plan: bump the `KIMI_MODEL` constant in `backend/app/services/llm.py:15` from `kimi-k2.5` to `kimi-k2.6` and reconcile any request-/response-shape changes from the API update. This must happen before the §6-step-5 smoke test if we want the first traces to reflect the model we're actually shipping. Do it in its own small PR — keep Langfuse and the model bump independently revertable.

---

## 9. Open questions

Items I could not resolve from public docs alone — flag during deploy rather than guess now.

1. **Maintainer + last-update date** of the Railway template behind `exma_H`. Verify on the Railway template page before clicking deploy.
2. **Per-service resource minimums** Langfuse considers safe — not published. Treat §1 footprint as an opening guess; revise after week 1.
3. **`LANGFUSE_ENABLED` vs `tracing_enabled`** — the SDK docs do not explicitly document a top-level disable flag for v4. The plan relies on key-absence NOOP. Confirm against `langfuse>=4.5,<5` source once installed; if a first-class flag exists, prefer it.
4. **Exact JSON body** of `/api/public/health` 200 response — docs do not publish it. Verify post-deploy and pin the assertion in the smoke-test script.

---

## Sources

- https://langfuse.com/self-hosting
- https://langfuse.com/self-hosting/railway
- https://langfuse.com/self-hosting/configuration
- https://langfuse.com/self-hosting/headless-initialization
- https://langfuse.com/self-hosting/configuration/health-readiness-endpoints
- https://langfuse.com/self-hosting/background-migrations
- https://langfuse.com/docs/administration/data-retention
- https://langfuse.com/docs/observability/sdk/overview
- https://langfuse.com/docs/observability/sdk/upgrade-path/python-v3-to-v4
- https://langfuse.com/changelog/2024-12-09-Langfuse-v3-stable-release
- https://pypi.org/project/langfuse/
- https://docs.railway.com/reference/private-networking
- https://docs.railway.com/reference/pricing
