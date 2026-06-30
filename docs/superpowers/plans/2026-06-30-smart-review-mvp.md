# Smart Review MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing-but-broken Smart Review feature end-to-end so the dashboard Review CTA starts a real, quota-free quiz scoped to the most-due document's weak concepts.

**Architecture:** Reuse the adaptive quiz engine + FSM + latency-split unchanged. `POST /quiz/sessions/` gains an optional `mode: "standard" | "review"`. In review mode the backend auto-picks the document with the most due concepts, seeds the concept selector to that doc's due concepts, marks the session `session_type='review'`, and **skips the daily quota**. Frontend `SmartReviewCard` creates the session and redirects to the existing session page, which renders a REVIEW kicker.

**Tech Stack:** FastAPI + Pydantic, Supabase (service-role client), Alembic, Next.js 16 App Router + SWR, TypeScript.

## Global Constraints

- **Allow-list (touch ONLY these):** `backend/app/api/routes/sessions.py`, `backend/app/services/session_manager.py`, `backend/app/models/quiz.py`, ONE new `backend/alembic/versions/` migration, `frontend/src/app/session/page.tsx`, `frontend/src/components/dashboard/SmartReviewCard.tsx`. Plus ONE new test file `backend/tests/test_smart_review.py` (owned by nobody; required for verification).
- **`backend/app/services/concepts.py` is READ-ONLY** — call `get_due_concepts` / `get_document_concepts`, do not edit.
- **Do NOT touch** `usage.py`, `config.py`, `abuse_controls.py`, `documents.py` (Agent 2), or `frontend/src/app/page.tsx` / `settings/page.tsx` (Agent 3). Also leave `db/models.py` and `hooks/useQuiz.ts` untouched — they are not on the allow-list; the migration is the DB source of truth and runtime uses the Supabase client, not the ORM.
- **Migration head is `02968ade0f8e`** — new migration's `down_revision` must be exactly that. `alembic upgrade head` then `alembic downgrade -1` must both run clean.
- **Service-role client bypasses RLS** — every new Supabase query MUST filter `.eq("user_id", str(user_id))`.
- **`user_id` is always derived from the token**, never from the request body.
- **Baseline: 65 pytest tests pass.** Do not break them.
- **Review is FREE** — the review path must never call `consume_quiz_usage_or_429`.
- Session length: `max(1, min(due_in_doc, 10))` questions.

---

### Task 1: Migration — `quiz_sessions.session_type`

**Files:**
- Create: `backend/alembic/versions/b3e7a1f9c2d4_add_quiz_session_type.py`

**Interfaces:**
- Produces: column `quiz_sessions.session_type TEXT NOT NULL DEFAULT 'standard'`.

- [ ] **Step 1: Write the migration**

```python
"""add quiz_sessions.session_type

Revision ID: b3e7a1f9c2d4
Revises: 02968ade0f8e
Create Date: 2026-06-30

Adds quiz_sessions.session_type ('standard' | 'review'). Drives the review
quota carve-out, the seeded concept selector, and future analytics. Defaults
to 'standard' so existing rows + the standard create path are unaffected.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3e7a1f9c2d4"
down_revision: Union[str, None] = "02968ade0f8e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quiz_sessions",
        sa.Column(
            "session_type",
            sa.Text(),
            nullable=False,
            server_default="standard",
        ),
    )


def downgrade() -> None:
    op.drop_column("quiz_sessions", "session_type")
```

- [ ] **Step 2: Apply up + down**

Run: `cd backend && source venv/bin/activate && alembic upgrade head && alembic downgrade -1 && alembic upgrade head`
Expected: each step completes without error; head is `b3e7a1f9c2d4`.

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/b3e7a1f9c2d4_add_quiz_session_type.py
git commit -m "feat(review): add quiz_sessions.session_type migration"
```

---

### Task 2: Pydantic request model — accept `mode`, make `document_id` optional

**Files:**
- Modify: `backend/app/models/quiz.py` (`QuizSessionCreate`)

**Interfaces:**
- Produces: `QuizSessionCreate.mode: str` (default `"standard"`, pattern `^(standard|review)$`); `QuizSessionCreate.document_id: str | None` (default `None`).

- [ ] **Step 1: Edit the model**

Replace the `QuizSessionCreate` class body so `document_id` is optional and `mode` is added:

```python
class QuizSessionCreate(BaseModel):
    """Request model for creating a quiz session."""

    document_id: str | None = None
    mode: str = Field(default="standard", pattern="^(standard|review)$")
    num_questions: int = Field(default=5, ge=1, le=20)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    question_types: list[QuestionType] = Field(default_factory=lambda: list(DEFAULT_QUESTION_TYPES))
    focus_concept_ids: list[str] | None = None
```

- [ ] **Step 2: Type-check imports compile**

Run: `cd backend && source venv/bin/activate && python -c "from app.models.quiz import QuizSessionCreate; print(QuizSessionCreate(mode='review').mode, QuizSessionCreate(document_id='x').document_id)"`
Expected: prints `review x`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/quiz.py
git commit -m "feat(review): accept mode + optional document_id on session create"
```

---

### Task 3: `session_manager` — due-doc picker, review-aware selector, `session_type` threading

**Files:**
- Modify: `backend/app/services/session_manager.py`
- Test: `backend/tests/test_smart_review.py`

**Interfaces:**
- Consumes: `concepts.get_due_concepts(user_id, limit) -> list[dict]` (each dict has `id`, `document_id`, `last_tested_at`); `concepts.get_document_concepts`.
- Produces:
  - `pick_review_document(user_id: str) -> tuple[str, list[str]] | None` — returns `(document_id, due_concept_ids)` for the most-due ready doc, else `None`.
  - `_due_concept_ids_for_document(user_id: str, document_id: str) -> set[str]`.
  - `_select_next_concept(session_id, user_id, document_id, session_type="standard")` — new 4th param.
  - `create_session(..., session_type: str = "standard")` — new kwarg; inserts `session_type` and threads it to Q1 selection.
  - `_generate_and_insert_question(..., session_type: str = "standard")`.

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_smart_review.py`:

```python
"""Tests for the Smart Review MVP: doc auto-pick + review-scoped selector."""

from unittest.mock import patch, MagicMock

from app.services import session_manager


USER = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
DOC_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
DOC_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
C1 = "11111111-1111-1111-1111-111111111111"
C2 = "22222222-2222-2222-2222-222222222222"
C3 = "33333333-3333-3333-3333-333333333333"


def _due(cid, doc, last):
    return {"id": cid, "document_id": doc, "last_tested_at": last, "mastery_score": 10.0}


def test_pick_review_document_picks_most_due_ready_doc():
    due = [
        _due(C1, DOC_A, "2026-06-01T00:00:00+00:00"),
        _due(C2, DOC_A, "2026-06-02T00:00:00+00:00"),
        _due(C3, DOC_B, "2026-06-03T00:00:00+00:00"),
    ]
    docs_resp = MagicMock()
    docs_resp.data = [{"id": DOC_A, "status": "ready"}, {"id": DOC_B, "status": "ready"}]
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.in_.return_value.eq.return_value.execute.return_value = docs_resp
    with patch.object(session_manager, "get_due_concepts", return_value=due), \
         patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.pick_review_document(USER)
    assert result is not None
    doc_id, due_ids = result
    assert doc_id == DOC_A  # 2 due > 1 due
    assert set(due_ids) == {C1, C2}


def test_pick_review_document_skips_non_ready_doc():
    due = [_due(C1, DOC_A, "2026-06-01T00:00:00+00:00"), _due(C2, DOC_A, "2026-06-02T00:00:00+00:00"),
           _due(C3, DOC_B, "2026-06-03T00:00:00+00:00")]
    docs_resp = MagicMock()
    docs_resp.data = [{"id": DOC_B, "status": "ready"}]  # DOC_A not ready
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.in_.return_value.eq.return_value.execute.return_value = docs_resp
    with patch.object(session_manager, "get_due_concepts", return_value=due), \
         patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.pick_review_document(USER)
    assert result is not None
    assert result[0] == DOC_B


def test_pick_review_document_none_when_nothing_due():
    with patch.object(session_manager, "get_due_concepts", return_value=[]):
        assert session_manager.pick_review_document(USER) is None


def test_selector_review_mode_restricts_to_due_concepts():
    concepts = [
        {"id": C1, "concept_name": "c1", "importance_score": 1.0, "is_core": True, "mastery_score": 10.0},
        {"id": C2, "concept_name": "c2", "importance_score": 1.0, "is_core": True, "mastery_score": 90.0},
    ]
    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_due_concept_ids_for_document", return_value={C2}), \
         patch.object(session_manager, "_get_session_question_history", return_value=[]):
        chosen = session_manager._select_next_concept("sess", USER, DOC_A, session_type="review")
    assert chosen["id"] == C2  # only the due concept, even though it has high mastery


def test_selector_review_mode_falls_back_to_core_when_due_empty():
    concepts = [
        {"id": C1, "concept_name": "c1", "importance_score": 1.0, "is_core": True, "mastery_score": 10.0},
    ]
    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_due_concept_ids_for_document", return_value=set()), \
         patch.object(session_manager, "_get_session_question_history", return_value=[]):
        chosen = session_manager._select_next_concept("sess", USER, DOC_A, session_type="review")
    assert chosen["id"] == C1  # falls back to normal core pool
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && source venv/bin/activate && pytest tests/test_smart_review.py -v`
Expected: FAIL — `pick_review_document` / `_due_concept_ids_for_document` not defined, and `_select_next_concept` rejects the `session_type` kwarg.

- [ ] **Step 3: Add imports + helpers**

In `session_manager.py`, extend the concepts import:

```python
from app.services.concepts import get_document_concepts, get_due_concepts
```

Add these two helpers just above `_select_next_concept`:

```python
def _due_concept_ids_for_document(user_id: str, document_id: str) -> set[str]:
    """Concept ids currently due for review within one document.

    Re-derived from get_due_concepts so the review pool narrows automatically
    as mastery rises (reviewed concepts leave the due set)."""
    try:
        due = get_due_concepts(user_id, limit=20)
    except Exception as e:
        logger.warning(f"[review] get_due_concepts failed for user {user_id}: {e}")
        return set()
    return {
        str(c["id"])
        for c in due
        if c.get("id") and str(c.get("document_id")) == str(document_id)
    }


def pick_review_document(user_id: str) -> tuple[str, list[str]] | None:
    """Auto-pick the document with the most due concepts.

    Tie-break: most recently studied (max last_tested_at among its due
    concepts). Skips documents not in 'ready' status / deleted. Returns
    (document_id, due_concept_ids) or None when nothing qualifies."""
    due = get_due_concepts(user_id, limit=20)
    if not due:
        return None

    by_doc: dict[str, dict] = {}
    for c in due:
        doc_id = c.get("document_id")
        cid = c.get("id")
        if not doc_id or not cid:
            continue
        entry = by_doc.setdefault(str(doc_id), {"ids": [], "latest": ""})
        entry["ids"].append(str(cid))
        last = c.get("last_tested_at") or ""
        if last > entry["latest"]:
            entry["latest"] = last
    if not by_doc:
        return None

    candidate_ids = list(by_doc.keys())
    docs_resp = (
        supabase_admin.table("documents")
        .select("id,status")
        .eq("user_id", user_id)
        .in_("id", candidate_ids)
        .eq("status", "ready")
        .execute()
    )
    ready_ids = {str(d["id"]) for d in (docs_resp.data or [])}
    ranked = [d for d in candidate_ids if d in ready_ids]
    if not ranked:
        return None

    # Most due first; tie-break by most recently studied.
    ranked.sort(key=lambda d: (len(by_doc[d]["ids"]), by_doc[d]["latest"]), reverse=True)
    chosen = ranked[0]
    return chosen, by_doc[chosen]["ids"]
```

- [ ] **Step 4: Make the selector review-aware**

In `_select_next_concept`, change the signature and the candidate-base block. Replace:

```python
def _select_next_concept(
    session_id: str, user_id: str, document_id: str
) -> dict | None:
```
with:
```python
def _select_next_concept(
    session_id: str, user_id: str, document_id: str, session_type: str = "standard"
) -> dict | None:
```

Then replace this block:
```python
    core_concepts = [c for c in all_concepts if c.get("is_core")]
    if not core_concepts:
        logger.warning(
            f"[selector] No core concepts for document {document_id}; cannot select"
        )
        return None
```
with:
```python
    if session_type == "review":
        due_ids = _due_concept_ids_for_document(user_id, document_id)
        core_concepts = [c for c in all_concepts if str(c["id"]) in due_ids]
        # Due subset exhausted (mastery rose) → fall back to normal core pool.
        if not core_concepts:
            core_concepts = [c for c in all_concepts if c.get("is_core")]
    else:
        core_concepts = [c for c in all_concepts if c.get("is_core")]

    if not core_concepts:
        logger.warning(
            f"[selector] No selectable concepts for document {document_id} "
            f"(session_type={session_type}); cannot select"
        )
        return None
```

- [ ] **Step 5: Thread `session_type` through Q1 generation**

In `_generate_and_insert_question`, change the signature:
```python
def _generate_and_insert_question(
    session_id: str,
    document_id: str,
    user_id: str,
    difficulty: str,
    question_types: list[str],
    question_number: int,
    session_type: str = "standard",
) -> dict | None:
```
and the selector call inside it:
```python
    concept = _select_next_concept(session_id, user_id, document_id, session_type)
```

- [ ] **Step 6: Thread `session_type` through `create_session`**

In `create_session`, change the signature to add the kwarg:
```python
def create_session(
    user_id: str,
    document_id: str,
    num_questions: int,
    difficulty: str,
    question_types: list[str],
    focus_concept_ids: list[str] | None = None,
    session_id: str | None = None,
    session_type: str = "standard",
) -> dict:
```
Add `"session_type": session_type,` to the `session_data` insert dict (next to `"status": "active",`). Pass `session_type=session_type` into the `_generate_and_insert_question(...)` call.

- [ ] **Step 7: Thread `session_type` through the background generator**

In `generate_next_question_bg`, after `session = session_resp.data[0]` and the active-status check, compute and pass the type. Replace the `concept = _select_next_concept(session_id, user_id, document_id)` line inside the retry loop with:
```python
            concept = _select_next_concept(
                session_id, user_id, document_id, session.get("session_type") or "standard"
            )
```

- [ ] **Step 8: Run the new tests + the selector regression suite**

Run: `cd backend && source venv/bin/activate && pytest tests/test_smart_review.py tests/test_adaptive_selector.py tests/test_latency_split.py -v`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/session_manager.py backend/tests/test_smart_review.py
git commit -m "feat(review): doc auto-pick + review-scoped concept selector"
```

---

### Task 4: Route — review branch + quota carve-out

**Files:**
- Modify: `backend/app/api/routes/sessions.py` (`create_quiz_session`)
- Test: `backend/tests/test_smart_review.py` (append)

**Interfaces:**
- Consumes: `session_manager.pick_review_document`, `session_manager.create_session`.
- Produces: `POST /quiz/sessions/` with `{"mode": "review"}` → creates a review session on the auto-picked doc, returns the same shape as standard (`session_id`, `first_question`, ...), and does NOT call `consume_quiz_usage_or_429`.

- [ ] **Step 1: Write failing tests (append to `test_smart_review.py`)**

```python
from fastapi.testclient import TestClient


def _client_with_user():
    import app.config
    from unittest.mock import MagicMock as MM
    app.config.get_settings = lambda: MM(
        supabase_url="http://test", supabase_publishable_key="test",
        supabase_secret_key="test", qdrant_url="http://test", qdrant_api_key="test",
        kimi_api_key="test", max_document_mb=10, max_documents_per_user=10,
        max_quiz_sessions_per_day=5, quiz_requests_per_minute=60, environment="test",
    )
    from app.main import app
    from app.api.routes.documents import get_user_id_from_token

    async def _override():
        return USER

    app.dependency_overrides[get_user_id_from_token] = _override
    return TestClient(app)


def test_review_session_skips_quota(mocker):
    client = _client_with_user()
    from app.api.routes import sessions as sessions_route

    mocker.patch.object(sessions_route, "pick_review_document", return_value=(DOC_A, [C1, C2]))
    create_mock = mocker.patch.object(
        sessions_route, "create_session",
        return_value={"session_id": "sess-rev", "document_id": DOC_A,
                      "difficulty": "medium", "total_questions": 2, "first_question": None},
    )
    consume_mock = mocker.patch.object(sessions_route, "consume_quiz_usage_or_429")

    resp = client.post("/quiz/sessions/", json={"mode": "review"})

    assert resp.status_code == 200
    consume_mock.assert_not_called()                      # review is FREE
    create_mock.assert_called_once()
    kwargs = create_mock.call_args.kwargs
    assert kwargs["session_type"] == "review"
    assert kwargs["document_id"] == DOC_A
    assert kwargs["num_questions"] == 2                    # min(len(due), 10)


def test_review_session_404_when_nothing_due(mocker):
    client = _client_with_user()
    from app.api.routes import sessions as sessions_route
    mocker.patch.object(sessions_route, "pick_review_document", return_value=None)
    resp = client.post("/quiz/sessions/", json={"mode": "review"})
    assert resp.status_code == 404
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && source venv/bin/activate && pytest tests/test_smart_review.py -k "review_session" -v`
Expected: FAIL — `pick_review_document` not importable from the route; review branch absent.

- [ ] **Step 3: Update the route**

In `sessions.py`, add `pick_review_document` to the `session_manager` import block. Then, inside `create_quiz_session`, immediately after `try:` and before the document lookup, insert the review branch:

```python
        if request.mode == "review":
            picked = pick_review_document(str(user_id))
            if not picked:
                raise HTTPException(
                    status_code=404,
                    detail="No concepts are due for review right now.",
                )
            review_document_id, due_ids = picked
            session_data = create_session(
                user_id=str(user_id),
                document_id=review_document_id,
                num_questions=max(1, min(len(due_ids), 10)),
                difficulty=request.difficulty,
                question_types=request.question_types,
                session_type="review",
            )
            # Review is FREE — intentionally skip consume_quiz_usage_or_429.
            return session_data

        if not request.document_id:
            raise HTTPException(status_code=400, detail="document_id is required.")
```

(The existing standard flow below is unchanged and continues to use `request.document_id`.)

- [ ] **Step 4: Run review tests + the existing usage-limit tests**

Run: `cd backend && source venv/bin/activate && pytest tests/test_smart_review.py tests/test_usage_limits.py -v`
Expected: all PASS (standard quota tests unaffected; review tests green).

- [ ] **Step 5: Full backend suite**

Run: `cd backend && source venv/bin/activate && pytest`
Expected: baseline 65 + new tests all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routes/sessions.py backend/tests/test_smart_review.py
git commit -m "feat(review): wire review branch + quota carve-out on POST /quiz/sessions"
```

---

### Task 5: Frontend — `SmartReviewCard` creates the session and redirects

**Files:**
- Modify: `frontend/src/components/dashboard/SmartReviewCard.tsx`

**Interfaces:**
- Consumes: `apiFetch<{ session_id: string }>("/quiz/sessions/", { method: "POST", body: { mode: "review" } })`, `getErrorMessage` (both from `@/lib/api`), `useRouter` from `next/navigation`.
- Produces: clicking "Start review" creates a review session, then `router.push("/session?session_id=<id>&mode=review")`.

- [ ] **Step 1: Update imports + add handler**

Replace the import block at the top with:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Sparkles, Loader2 } from "lucide-react";

import { useReviewQueue } from "@/hooks/useReviewQueue";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
```

Inside `SmartReviewCard`, after the `useReviewQueue()` destructure, add:
```tsx
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function handleStartReview() {
    setStarting(true);
    setStartError(null);
    try {
      const res = await apiFetch<{ session_id: string }>("/quiz/sessions/", {
        method: "POST",
        body: { mode: "review" },
      });
      router.push(`/session?session_id=${res.session_id}&mode=review`);
    } catch (err) {
      setStartError(getErrorMessage(err));
      setStarting(false);
    }
  }
```

- [ ] **Step 2: Replace the CTA button (final `return` block)**

Replace:
```tsx
        <Button asChild>
          <Link href="/session?mode=review">Start review</Link>
        </Button>
```
with:
```tsx
        <Button onClick={handleStartReview} disabled={starting}>
          {starting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Starting…
            </>
          ) : (
            "Start review"
          )}
        </Button>
```
Then add a startError line just below the closing `</Button>`'s parent flex row — directly before the closing `</div>` of the card root, insert:
```tsx
      {startError && (
        <p className="mt-2 text-[12px] text-[var(--danger)]">{startError}</p>
      )}
```
Remove the now-unused `import Link from "next/link";` (it is no longer referenced).

- [ ] **Step 3: Lint + type-check**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: no errors. (If lint flags an unused import, remove it.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/SmartReviewCard.tsx
git commit -m "feat(review): SmartReviewCard creates review session + redirects"
```

---

### Task 6: Frontend — session page renders a REVIEW kicker for `mode=review`

**Files:**
- Modify: `frontend/src/app/session/page.tsx`

**Interfaces:**
- Consumes: `searchParams.get("mode")`.
- Produces: when `mode=review`, the TopNav eyebrow reads "Smart Review" and the loading card kicker reads "01 / SMART REVIEW".

- [ ] **Step 1: Read the mode flag**

In `SessionContent`, right after the `sessionId` line, add:
```tsx
  const isReview = searchParams.get("mode") === "review";
```

- [ ] **Step 2: Review eyebrow on TopNav**

Change the `TopNav` prop:
```tsx
        eyebrow={document?.ai_title ?? document?.filename}
```
to:
```tsx
        eyebrow={isReview ? "Smart Review" : (document?.ai_title ?? document?.filename)}
```

- [ ] **Step 3: Parametrize the loading-card kicker**

Change the `QuizLoadingTips` definition header:
```tsx
function QuizLoadingTips() {
```
to:
```tsx
function QuizLoadingTips({ kicker = "01 / QUIZ LAUNCH" }: { kicker?: string }) {
```
and inside it replace:
```tsx
        <p className="kicker">01 / QUIZ LAUNCH</p>
```
with:
```tsx
        <p className="kicker">{kicker}</p>
```
Then update the call site:
```tsx
          {sessionLoading || questionLoading ? (
            <QuizLoadingTips />
```
to:
```tsx
          {sessionLoading || questionLoading ? (
            <QuizLoadingTips kicker={isReview ? "01 / SMART REVIEW" : undefined} />
```

- [ ] **Step 4: Lint + type-check**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/session/page.tsx
git commit -m "feat(review): REVIEW kicker on the session page"
```

---

### Task 7: Full verification gate

- [ ] **Step 1: Backend tests**

Run: `cd backend && source venv/bin/activate && pytest`
Expected: 65 baseline + new review tests PASS, 0 fail.

- [ ] **Step 2: Migration up/down**

Run: `cd backend && source venv/bin/activate && alembic upgrade head && alembic downgrade -1 && alembic upgrade head`
Expected: clean, head = `b3e7a1f9c2d4`.

- [ ] **Step 3: Frontend gates**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: no errors.

---

## Self-Review

**Spec coverage:**
- Extend `POST /quiz/sessions/` with `mode=review` → Task 2 (model) + Task 4 (route). ✅
- Auto-pick most-due doc, seed selector to due concepts → Task 3 (`pick_review_document`, review-aware `_select_next_concept`). ✅
- Review is FREE (skip quota) → Task 4 (review branch returns before `consume_quiz_usage_or_429`). ✅
- `quiz_sessions.session_type` migration on head `02968ade0f8e` → Task 1. ✅
- Reuse engine/FSM/latency-split → no fork; only the selector gains a scoping branch. ✅
- Frontend handles `?mode=review` → Task 5 (create+redirect) + Task 6 (kicker). ✅
- Session length `min(due,10)` → Task 4 `num_questions=max(1, min(len(due_ids), 10))`. ✅
- Tie-break most-recently-studied; skip non-ready docs → Task 3 picker. ✅
- Mastery updates clear due-status (retention loop) → automatic via existing `_update_concept_mastery`; review pool re-derived each pick so concepts drop out. ✅
- Edge case 0 due → card hides button already (`dueCount === 0`); route returns 404 defensively. ✅

**Placeholder scan:** none — every code step shows full content.

**Type consistency:** `session_type` kwarg defaults to `"standard"` everywhere it is added (`create_session`, `_generate_and_insert_question`, `_select_next_concept`); `pick_review_document` returns `tuple[str, list[str]] | None` and the route unpacks `review_document_id, due_ids`. Selector's 4th positional arg matches all call sites.
