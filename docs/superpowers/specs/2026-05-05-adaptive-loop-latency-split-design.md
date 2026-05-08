# Adaptive-Loop Latency Split — Design

**Date:** 2026-05-05
**Status:** Awaiting approval
**Owner:** Quiz / Session subsystem
**Depends on:** PR2 (`feat/adaptive-loop`) merged

## Context

PR2 made `submit_answer` synchronous: evaluate → update mastery → select next concept → call LLM → return. Audit measured **p50 ≈ 2.4 s, p95 ≈ 6–9 s**, dominated by the LLM round trip (2–6 s typical, up to 8 s tail). UX risk: a 2.5 s "Submit" feels broken.

The user already spends 4–10 s reading explanation/feedback after every answer. We can hide LLM latency inside that window: return feedback fast, generate the next question in the background, hand it over when the user clicks Next.

Goal: **submit endpoint p50 < 400 ms, p95 < 800 ms** by removing the LLM call from the request path. Keep the adaptive selector exactly as specified in PR2 — only the *timing* of generation changes, not what gets generated or in what order.

## Non-goals

- Not changing the selection algorithm (70/30 weighted, miss-streak boost, 3-correct deprioritize, end-on-mastery).
- Not adding a job queue / Redis / Celery infra for one feature.
- Not streaming question content over SSE — that is a future optimization.
- Not reordering: mastery still updates *before* selection runs.

---

## 1. New endpoint signatures

### `POST /quiz/sessions/{session_id}/answer` (modified)

Already exists from PR2. Behavior changes: returns immediately after mastery update; **does not** include `next_question`.

**Request body** (unchanged):
```json
{
  "answer": "string",
  "input_method": "typed" | "click" | "voice",
  "question_id": "uuid"
}
```

**Response** (`AnswerResponse`, modified):
```json
{
  "result": {
    "is_correct": true,
    "correct_answer": "string",
    "explanation": "string | null",
    "feedback": "string | null",
    "score_so_far": 3,
    "total_answered": 4,
    "xp_awarded": 10,
    "mastery_delta": 1.5
  },
  "session_complete": false,
  "session_ended_reason": null
}
```

When the session ends in this call (cap hit OR all-core-mastered):
```json
{
  "result": { ... },
  "session_complete": true,
  "session_ended_reason": "cap_reached" | "mastery_threshold"
}
```

`next_question` is gone from this response. Frontend MUST call `/next` if and only if `session_complete === false`.

### `GET /quiz/sessions/{session_id}/next` (new)

Returns the next question, waiting briefly if generation is still running.

**Query params (optional):**
- `wait_ms` (int, default 5000, max 10000): max time to block on the request before returning a "still preparing" status.

**Response 200 — question ready:**
```json
{
  "status": "ready",
  "question": {
    "question_id": "uuid",
    "question_number": 5,
    "total_questions": 10,
    "question_type": "text_mcq",
    "question_text": "string",
    "options": ["...", "..."] | null,
    "difficulty": "medium"
  }
}
```

**Response 202 — still generating (after `wait_ms` elapsed):**
```json
{
  "status": "preparing",
  "retry_after_ms": 500
}
```
Frontend polls again. Server-side wait keeps poll count low; the 202 is the safety valve for slow LLMs (> 5 s).

**Response 200 — session ended (no further questions):**
```json
{
  "status": "ended",
  "reason": "cap_reached" | "mastery_threshold",
  "summary": {
    "total_answered": 10,
    "correct_answers": 7,
    "score_percentage": 70.0
  }
}
```

**Response 409 — generation failed terminally:**
```json
{
  "status": "failed",
  "error": "generator_unavailable",
  "message": "Could not generate the next question. Please retry."
}
```
Frontend can surface a retry button; calling `/next` again kicks off a fresh attempt (see "retry once" rule below).

### `POST /quiz/sessions/{session_id}/next/retry` (optional, deferred)

If a background generation fails terminally, the user-facing retry is just a fresh `GET /next` call which our server-side handler treats as a re-trigger. No separate endpoint needed for v1.

---

## 2. Question lifecycle state machine

A session-level pointer + per-question status row. We do **not** introduce a new table; we add columns to the existing `questions` table.

### Question status enum (new column)

```
text values: 'pending' | 'generating' | 'ready' | 'answered' | 'failed'
```

- **pending** — placeholder row inserted; selector not yet chosen / generation not yet started. *(Optional; we may skip this and create rows directly in `generating`.)*
- **generating** — background task is running, LLM call in flight.
- **ready** — generated, available to serve.
- **answered** — user submitted an answer (terminal).
- **failed** — background task gave up after retry. Terminal until a fresh `/next` request triggers a new generation, which inserts a *new* row.

```
                          GET /next
                       (no row exists)
                              |
                              v
                       [generating]
                              |
                          ┌───┴───────┐
                          |           |
                       success      failure
                          |           |
                          v           v
                       [ready]    [failed]
                          |           |
                  GET /next picks |   /next-call retry → new [generating] row
                          |           |
                          v
                       served to client
                          |
                  POST /answer
                          |
                          v
                       [answered]
```

### Session state transitions

```
create_session:
  insert session(active, total=N, answered=0)
  trigger_generation(question_number=1)  # background

submit_answer(qid, ans):
  evaluate
  update_mastery
  mark question.answered
  recompute_session_counts
  if answered >= N OR all_core_mastered:
    session.status = 'completed'
    return {result, session_complete: true, ended_reason: ...}
  trigger_generation(question_number=answered+1)  # background, fire-and-forget
  return {result, session_complete: false}

GET /next:
  if session.status == 'completed':
    return {status:'ended', reason, summary}
  q = SELECT * FROM questions WHERE session_id=? AND status IN ('ready','generating') ORDER BY question_number LIMIT 1
  if q is None or q.status == 'failed':
    trigger_generation(question_number=session.answered+1)  # backstop
    q = wait briefly (up to wait_ms) for status='ready'
  if q.status == 'ready':
    return {status:'ready', question}
  return 202 {status:'preparing', retry_after_ms:500}
```

### Schema additions (alembic migration)

```sql
-- Add status column
ALTER TYPE question_status_enum ADD VALUE IF NOT EXISTS '...';
-- Or create the enum fresh:
CREATE TYPE question_status_enum AS ENUM
  ('pending', 'generating', 'ready', 'answered', 'failed');

ALTER TABLE questions
  ADD COLUMN status question_status_enum NOT NULL DEFAULT 'ready';
  -- Default 'ready' so existing rows from PR2 stay valid
ALTER TABLE questions
  ADD COLUMN ready_at timestamptz NULL;
ALTER TABLE questions
  ADD COLUMN generation_attempts smallint NOT NULL DEFAULT 0;

CREATE INDEX idx_questions_session_status_qnum
  ON questions (session_id, status, question_number);
```

`ready_at` is set when status transitions to `ready` — useful for `/next` long-poll and for analytics on generation latency.

---

## 3. Background task trigger

**Recommendation: FastAPI `BackgroundTasks`** (per-process, in-memory).

### Why BackgroundTasks, not a queue

| Factor | BackgroundTasks | Celery / Arq / RQ |
|---|---|---|
| Setup cost | Zero | Redis broker, worker pool, deploy config |
| Latency to start | < 5 ms | 50–200 ms + worker pickup |
| Failure semantics | If pod dies, task lost | Durable, retried on a different worker |
| Cross-pod state | None — generation must run where request landed | Any worker |
| Observability | Stdout logs only | Built-in dashboards |

For this feature: every generation has a tightly-coupled "user is waiting" partner. Durability across pod restarts buys nothing — if the pod dies, the user's HTTP request also died, they will retry, the new request lands somewhere, and `/next` will trigger generation backstop. We do not need cross-pod scheduling.

### When to revisit

Switch to Arq (Redis) if any of:
- Generation needs to run for users who are not actively in a request (pre-warm, scheduled review)
- We need a retry queue (currently doing single in-process retry)
- We add cross-feature background work (image extraction, embeddings) and want one shared worker pool

### Implementation sketch

```python
# routes/sessions.py
@router.post("/{session_id}/answer")
def submit(
    session_id: UUID,
    body: AnswerSubmit,
    bg: BackgroundTasks,
    user_id: UUID = Depends(get_user_id_from_token),
) -> AnswerResponse:
    result = submit_answer_fast(session_id, user_id, body.question_id, body.answer, body.input_method)
    if not result["session_complete"]:
        bg.add_task(generate_next_question_bg, session_id, str(user_id))
    return result


def generate_next_question_bg(session_id: str, user_id: str) -> None:
    """Insert a 'generating' row, run the selector + LLM, update to 'ready'.
    Single retry on failure. Idempotent: skip if a 'ready' or 'generating'
    row already exists for this session."""
    # 1. claim slot — atomic insert with ON CONFLICT DO NOTHING
    # 2. run _select_next_concept (uses fresh mastery from prior submit)
    # 3. call LLM via generate_single_question
    # 4. on success: UPDATE status='ready', ready_at=now, fill question fields
    # 5. on failure: increment generation_attempts; if < 2, retry once;
    #    else UPDATE status='failed'
```

### Long-poll wait in `/next`

```python
@router.get("/{session_id}/next")
def get_next(
    session_id: UUID,
    wait_ms: int = 5000,
    user_id: UUID = Depends(get_user_id_from_token),
) -> NextResponse:
    deadline = monotonic() + min(wait_ms, 10000) / 1000.0
    while True:
        result = check_next_question(session_id, user_id)
        if result.status in ("ready", "ended", "failed"):
            return result
        if monotonic() >= deadline:
            return NextResponseStatus(status="preparing", retry_after_ms=500)
        sleep(0.2)  # 200 ms pacing → 25 DB reads in worst-case 5 s wait
```

200 ms poll interval, capped at 25 DB reads per long-poll. Each read is a single indexed query (`session_id, status` index above), so cost is negligible.

---

## 4. Estimated p50 / p95 of new submit endpoint

Path: evaluate answer → update question row → upsert mastery → recompute doc progress → recompute session counts → mark complete (if applicable) → return.

| Stage | p50 | p95 |
|---|---|---|
| `evaluate_answer` (LLM only for `text_free`) | 30 ms / 2000 ms* | 80 ms / 5000 ms* |
| `UPDATE questions` (1 round trip) | 40 ms | 100 ms |
| `upsert user_concept_mastery` (1 RT per concept, usually 1) | 40 ms | 90 ms |
| `_recompute_document_progress` (1 read + 1 write) | 80 ms | 180 ms |
| `_recompute_session_counts` (1 read) | 40 ms | 90 ms |
| `UPDATE quiz_sessions` (1 RT, only on completion) | 30 ms (amortized) | 80 ms |
| `BackgroundTasks.add_task` enqueue | < 1 ms | < 1 ms |

**Totals (excluding the `text_free` LLM eval):**
- **p50: ~250 ms**
- **p95: ~550 ms**

\* `text_free` answers still call the LLM inside `evaluate_free_text`. That path's p50 stays ~2 s. **This is a known wart**: `text_mcq` and `text_tf` get the fast path; `text_free` does not, because evaluating natural-language answers needs an LLM. For v1, accept the asymmetry — `text_free` is a minority of questions in the default mix, and the user is already in "review" state when this runs. A follow-up can move the eval LLM call to the background and have `/next` join on both eval-complete and gen-complete.

**Submit endpoint targets (excluding text_free):**
- p50: ✅ < 400 ms
- p95: ✅ < 800 ms

**Submit endpoint targets (text_free):**
- p50: ~2 s (unchanged from PR2 baseline; budget for follow-up)
- p95: ~5 s

---

## 5. Risk: tab close between submit and next

### Scenario

User answers Q4, sees explanation, then closes tab before clicking Next. Submit response committed: question `answered`, mastery updated. Background task fires, inserts `generating` row, calls LLM, writes `ready` row.

### Failure modes

1. **Background task in flight when pod is killed (deploy / OOM):** the in-memory task object is destroyed. Result: a `generating` row stays orphan in the DB. When the user later returns to the session and calls `/next`, our backstop logic detects no `ready` row, sees the stale `generating` row past a freshness threshold, and triggers a fresh generation.
2. **Background task succeeds, user never returns:** a `ready` question sits in the DB. No leak — it's correctly attributed to the session. If the user resumes the session days later, they see this question. If they start a new session for the same doc, this row is untouched.
3. **User opens the same session in two tabs:** both tabs poll `/next`; both see the same `ready` row. First answer wins (handled by existing PR2 logic: `if question.user_answer is not None: raise "already answered"`). The losing tab's `/answer` returns 4xx; frontend should refresh. Acceptable; pre-existing behavior.
4. **Session marked complete but background already enqueued:** `submit_answer` checks completion *before* enqueuing, so this can't happen on the happy path. There's a narrow race where `submit_answer` sees `session_complete=false` but a concurrent request also submitting would race. Mitigation: in `generate_next_question_bg`, re-fetch session status before doing any work; if `completed`, return early.

### Stale `generating` row recovery

```python
GENERATION_TTL_SECONDS = 30  # max LLM call we tolerate

def check_next_question(session_id, user_id):
    row = SELECT * FROM questions
          WHERE session_id=? AND status IN ('ready','generating')
          ORDER BY question_number LIMIT 1
    if row is None:
        trigger_generation(...)
        return preparing
    if row.status == 'generating' and now - row.created_at > GENERATION_TTL_SECONDS:
        UPDATE questions SET status='failed' WHERE id=row.id
        trigger_generation(...)
        return preparing
    if row.status == 'ready':
        return ready(row)
    return preparing  # still generating, within TTL
```

This makes the system self-healing for the tab-close case at the cost of one extra `now()` comparison per `/next` call.

### Net assessment

Tab close between submit and next is **safe**: no data corruption, no orphan rows that affect subsequent flows, and the worst case (mid-flight pod death) heals automatically the next time the user accesses the session via the staleness-TTL backstop.

---

## Migration order

1. Apply schema migration (add `status`, `ready_at`, `generation_attempts`, partial index).
2. Deploy backend with new endpoints + modified `/answer`. Existing PR2 sessions: rows default to `status='ready'` so the in-flight question is served correctly on the first `/next` call.
3. Deploy frontend that calls `/next`. Old frontend (cached SPA) still works because the `/answer` response is a strict superset of what it parses today (next_question removal is the only field that disappears, and old code that expected it will see `null`-equivalent and ideally fall through; verify).

If old frontend handling of missing `next_question` is unsafe, gate behind a feature flag `ADAPTIVE_NEXT_ENDPOINT_V1`: when off, `/answer` keeps returning `next_question` (synchronous behavior). Flip on after frontend deploy. Remove the flag in the next release.

---

## Test plan

- **Unit**: `submit_answer_fast` returns no LLM call; mastery updated; bg trigger called iff session not complete.
- **Unit**: `generate_next_question_bg` is idempotent (running it twice produces only one `ready` row).
- **Unit**: `check_next_question` correctly maps row status → response and triggers regen on stale `generating`.
- **Integration**: full flow create → answer Q1 → /next → get Q2 → answer Q2 → /next ends correctly when cap hit.
- **Integration**: end-on-mastery short-circuits without calling /next at all.
- **Latency**: bench submit p50/p95 with an in-process mock for mastery DB writes; assert < targets.
- **Failure injection**: kill background task; confirm `/next` recovers via staleness TTL.

---

## Open questions for approval

1. **`text_free` LLM eval in submit path** — accept the 2 s wart for v1, or also move the eval to background and have `/next` join on both? **Recommend: accept for v1.**
2. **Feature flag for backwards-compat?** — defaults to "off" until frontend deploys, or hard cutover and accept a brief stale-SPA window? **Recommend: hard cutover; same release ships backend + frontend.**
3. **`pending` state in the question_status enum** — keep as a placeholder for future use, or omit until needed? **Recommend: omit; YAGNI.**
4. **Stale generation TTL value** — 30 s feels right (covers OpenAI tail + our network); confirm or adjust.
