# Kimi K2.5 → K2.6 model migration

## Context

Moonshot is EOL'ing the original `kimi-k2` on **2026-05-25** (17 days from this spec). We currently run on `kimi-k2.5` (released Jan 2026, still supported). `kimi-k2.6` shipped 2026-04-20 as the new flagship.

Phase 1.7 Langfuse instrumentation is about to start capturing traces. We want the first traces to reflect the model we're shipping for the next several months, not a model we're a week away from migrating off. This spec captures everything needed for a small, independent model-bump PR that lands **before** the Langfuse Railway deploy and is independently revertable.

**Key finding from recon:** the migration is a literal one-token change to `KIMI_MODEL` in `backend/app/services/llm.py:15`. Our current `call_kimi` already passes `extra_body={"thinking": {"type": "disabled"}}` — which is exactly the K2.6 flag we'd need to add anyway. Everything else (no `temperature`, no `top_p`, no `tools`, no `response_format`) is already compatible with K2.6's stricter constraints.

---

## 1. Current state recon

### Where the model identifier lives

```
backend/app/services/llm.py:15:  KIMI_MODEL = "kimi-k2.5"
backend/app/services/llm.py:39:  model=KIMI_MODEL,
```

That's it. Verified via `grep -rn "kimi-k2\|KIMI_MODEL" backend/` — the constant is referenced exactly twice (definition + use site), and there are zero hardcoded `kimi-k2*` strings anywhere else in `backend/app/` or `backend/tests/`.

### `call_kimi` shape (current)

```python
KIMI_BASE_URL = "https://api.moonshot.ai/v1"
KIMI_MODEL = "kimi-k2.5"

def call_kimi(system_prompt: str, user_prompt: str) -> str:
    client = OpenAI(api_key=settings.kimi_api_key, base_url=KIMI_BASE_URL)
    response = client.chat.completions.create(
        model=KIMI_MODEL,
        messages=[{"role": "system", "content": system_prompt},
                  {"role": "user", "content": user_prompt}],
        max_tokens=4096,
        extra_body={"thinking": {"type": "disabled"}},
    )
    return response.choices[0].message.content or ""
```

What we **already do right** for K2.6:
- No `temperature` set → K2.6 fixes it at 0.6 (non-thinking) and rejects custom values; we pass nothing, fine.
- No `top_p` set → K2.6 fixes it at 0.95; we pass nothing, fine.
- `extra_body={"thinking": {"type": "disabled"}}` → already the K2.6 incantation to suppress reasoning content + reasoning-token billing.
- No `tools` passed → K2.6's "Agent Swarm" autonomous tool execution cannot fire on our calls.
- No `response_format=json_object` → JSON parsing relies on prompt discipline. (Same on K2.5 today; not changing.)

### Auth + endpoint

`https://api.moonshot.ai/v1/chat/completions`, `Authorization: Bearer $KIMI_API_KEY`. **Unchanged** between K2.5 and K2.6. Source: https://platform.kimi.ai/docs/api/overview.md.

### Fallback chain

`backend/app/services/answer_evaluator.py:141-150` (`evaluate_free_text`) — calls `call_kimi`, falls back to `call_openai(model="gpt-4o-mini")` on empty response. Bumping `KIMI_MODEL` carries through automatically; no fallback-side change required.

---

## 2. Breaking-change audit (K2.5 → K2.6)

### Request body

| Field | K2.5 | K2.6 | Our exposure |
|---|---|---|---|
| `temperature` | accepted | **fixed; rejects custom** | none — we don't send |
| `top_p` | accepted | **fixed at 0.95; rejects custom** | none — we don't send |
| `n` | accepted | **fixed at 1; rejects custom** | none — we don't send |
| `max_tokens` | accepted | accepted (deprecated alias for `max_completion_tokens`) | we send `max_tokens=4096`, still works |
| `stop` | unchanged | unchanged | we don't send |
| `response_format` | supported | supported (JSON mode + json_schema) | we don't send |
| `tools` / `tool_choice` | unchanged | unchanged schema | we don't send |
| **`thinking`** | unknown — likely no-op | **NEW; default `enabled`** | we already send `{"type": "disabled"}` ✅ |
| streaming | unchanged | adds ordering guarantee for `reasoning_content` before `content` | we don't stream |

### Response body

| Field | K2.5 | K2.6 | Our exposure |
|---|---|---|---|
| `choices[0].message.content` | string | string (unchanged) | we read `.content` directly — fine |
| `choices[0].message.reasoning_content` | absent | **populated by default** unless `thinking: disabled` | we set `thinking: disabled` ✅ |
| `finish_reason` | `stop` / `length` / `tool_calls` | unchanged | not inspected |
| `usage` | `prompt_tokens / completion_tokens / total_tokens` | same documented schema | not inspected |
| error envelope | OpenAI-compatible | OpenAI-compatible | unchanged |

### Agent Swarm / 300-step tool calling

K2.6 introduced autonomous multi-step tool execution. **Trigger:** the request includes a `tools` array. **No `tools` → no agent swarm.** Our quiz-generation calls do not pass `tools`. Confirmed safe. Source: https://platform.kimi.ai/docs/guide/use-kimi-k2-to-setup-agent.md.

### Reasoning content handling

With `thinking: {"type": "disabled"}` (which we already send), `reasoning_content` is **not produced** and we are not billed for reasoning tokens. The downstream code (`json.loads(response)` in `quiz_generator`, plain string in `answer_evaluator`) keeps working unchanged.

### Net breaking-change exposure: **zero**

Our existing call shape is K2.6-clean by accident-of-good-defaults. The bump is genuinely just the model string.

---

## 3. Cost delta

Per Moonshot first-party pricing (USD per 1M tokens, exclusive of tax):

| | Input cache hit | Input cache miss | Output |
|---|---|---|---|
| `kimi-k2.5` | $0.10 | $0.60 | $3.00 |
| `kimi-k2.6` | $0.16 | $0.95 | $4.00 |
| **Delta** | +60% | +58% | +33% |

Sources:
- https://platform.kimi.ai/docs/pricing/chat-k25.md
- https://platform.kimi.ai/docs/pricing/chat-k26.md

### Phase 1 monthly spend estimate

We don't have aggregate token counts in production yet — that's exactly what Langfuse will give us. Rough order-of-magnitude using prompt sizes:
- Quiz-generation prompt: ~2K input, ~600 output per question
- Concept extraction (during ingestion): ~3K input, ~400 output per chunk batch
- Free-text answer eval: ~500 input, ~200 output per submission

At current dev traffic (single-operator, ~50 quiz calls/day, ~10 ingestion calls/day, ~30 evals/day, ~80% cache miss because prompts vary), back-of-envelope monthly Kimi spend:
- K2.5: ~**$3–6/month**
- K2.6: ~**$4–8/month** (roughly +33–40%)

**Decision-grade conclusion**: cost delta is negligible at current volume. Re-evaluate once Langfuse provides real numbers and once we ship to >100 active users.

---

## 4. Migration plan

### Code change

Single line in `backend/app/services/llm.py`:

```diff
- KIMI_MODEL = "kimi-k2.5"
+ KIMI_MODEL = "kimi-k2.6"
```

### Tests

`grep -rn "kimi-k2" backend/tests/` returns zero matches. No mocks pin the model string. No test fixture mirrors response shapes that K2.6 changes (and K2.6 doesn't change the shapes we use).

No test updates required. The Phase 1.7 observability tests (`test_observability_langfuse.py`) don't touch `llm.py`.

### Answer-evaluator fallback

`call_kimi` → `call_openai(model="gpt-4o-mini")` chain works unchanged. The OpenAI fallback is independent of which Kimi model fails.

### Optional hardening (recommend, but defer to a follow-up if you want this PR truly minimal)

Add a runtime assertion that the response actually came from K2.6:

```python
content = response.choices[0].message.content
if response.model and not response.model.startswith("kimi-k2.6"):
    logger.warning(f"Kimi response model={response.model}, expected kimi-k2.6")
```

Catches silent provider fallback (e.g. Moonshot routing to a cheaper model under load). One log line, no behavior change. **Recommendation: include in this same PR — it's three lines and meaningfully de-risks the cutover.**

### What does NOT change

- `KIMI_BASE_URL`
- `extra_body={"thinking": {"type": "disabled"}}` — keep it; it does the right thing on K2.6 explicitly and is harmless on K2.5.
- `max_tokens=4096`
- Prompt content anywhere in the codebase.
- The OpenAI fallback path.

---

## 5. Verification

### Pre-deploy local smoke test

1. `cd backend && source venv/bin/activate`
2. Confirm `.env` has a current `KIMI_API_KEY`.
3. From a Python REPL with `KIMI_MODEL` set to `kimi-k2.6`:
   ```python
   from app.services.llm import call_kimi
   r = call_kimi("You are a concise tutor.", "Define overfitting in one sentence.")
   assert r and len(r) > 20
   ```
4. Run `pytest tests/ -q -W ignore` — expect baseline (57 passed / 3 failed / 1 error from pre-existing infra issues; no new failures).

### Post-deploy verification

1. **Response-model echo**: hit prod with one quiz-generation call, then check Railway logs for the temporary log line added in §4. The log should show `kimi-k2.6` in the `response.model` field. If it shows `kimi-k2.5`, Moonshot routed somewhere unexpected — investigate.
2. **End-to-end quiz round-trip**: trigger one `POST /quiz/sessions/` against a known document. Confirm question generation succeeds and the parsed JSON is well-formed (i.e. `quiz_generator` didn't choke on a different response shape).
3. **End-to-end answer eval**: submit one free-text answer to a generated question. Confirm evaluator returns a verdict (no fallback to OpenAI fired, unless that's expected for that prompt).
4. **Moonshot dashboard**: log into Moonshot's developer console and confirm the request volume on `kimi-k2.6` rose while `kimi-k2.5` dropped to zero.

### Quality / latency regression check

We don't currently have an eval harness — that's Phase 1.7 step 4–7. So the regression check is qualitative for this PR:

1. Generate 3 quiz questions on the same document **before** the bump (`kimi-k2.5`).
2. Generate 3 quiz questions on the same document **after** the bump (`kimi-k2.6`).
3. Eyeball: are the K2.6 questions roughly the same quality as K2.5? Are the latencies in the same ballpark?

This is intentionally cheap. Once Langfuse + the golden eval set land (Phase 1.7 step 5), we'll have proper A/B numbers — but not blocking this PR on infrastructure that doesn't exist yet.

---

## 6. Rollback

### Trivial path

```diff
- KIMI_MODEL = "kimi-k2.6"
+ KIMI_MODEL = "kimi-k2.5"
```

Redeploy. Zero schema/data change in this PR — no migration to undo, no DB column to drop, no env var to unset. Rollback ETA: <5 minutes (one commit revert + Railway redeploy).

### Rate-limit / quota concern

Open question (#5 below): whether K2.6 has its own quota bucket or shares with K2.5 on a single API key. **Defensive assumption**: separate buckets. If we observe `429` rate-limit errors after the cutover that we didn't see on K2.5, that's the signal. Mitigation: roll back, file a quota-tier-bump ticket with Moonshot support, retry the cutover.

---

## 7. Sequencing relative to Langfuse deploy

**Recommendation: Kimi PR first, Langfuse Railway deploy second.**

Reasons:
1. Kimi PR is a one-line code change. Railway deploy is a multi-service infra change. Land the simple, isolated thing first so the harder thing happens against a stable baseline.
2. Langfuse traces should reflect the production model. Doing Kimi second means the first ~hours/days of trace data are tagged with the wrong model identifier and the eval harness comparisons get muddied.
3. The two PRs share zero code or infra. No coupling means no merge-order ambiguity.
4. If Kimi rollback fires, it does not affect the Langfuse stack. If Langfuse rollback fires, it does not affect Kimi. Independent revertability is preserved by either order, but Kimi-first is cleaner because Langfuse will then observe a single stable model from minute one.

**Order of operations:**
1. Land Kimi K2.6 PR. Local smoke test. Push to `main`. Railway redeploys autocoach-production. Verify §5 post-deploy steps.
2. (Days/hours later, separate session) Deploy Langfuse stack on Railway per `docs/specs/langfuse-selfhost.md`. Set `LANGFUSE_*` env on autocoach-production. Redeploy backend. Verify the spec's §6 step 5 smoke test — first trace shows `model=kimi-k2.6` automatically.

---

## 8. Out of scope (per user constraint)

- Moving from Moonshot first-party to OpenRouter / DeepInfra / Bedrock.
- Changing the OpenAI fallback model (`gpt-4o-mini` stays).
- Prompt tuning for K2.6. If post-deploy quality is visibly worse on K2.6, file a follow-up — don't bundle prompt rewrites into this PR.

---

## 9. Open questions

Items I could not confirm from public Moonshot docs alone — flag during deploy rather than guess.

1. **Dated K2.6 builds**: Moonshot lists `kimi-k2.6` only as a rolling alias, no `kimi-k2.6-2026-04-20`-style pinned identifier. If we ever want reproducible builds, we'll need to ask Moonshot support whether dated tags are available.
2. **`reasoning_tokens` in `usage`**: K2.6's docs show only the three OpenAI-standard token fields. The implementer flagged this — if reasoning output is rolled into `completion_tokens` (likely) we may see surprising token counts in Langfuse. Verify empirically post-deploy.
3. **Per-model vs shared quota**: not documented. Defensive assumption is separate buckets. Confirm via Moonshot dashboard or empirically.
4. **Whether Moonshot does silent fallback** (e.g. K2.6 → K2.5 under load). The proposed runtime `response.model` log will surface this if it happens. No published policy either way.

---

## Sources

- https://platform.kimi.ai/docs/models.md
- https://platform.kimi.ai/docs/api/overview.md
- https://platform.kimi.ai/docs/api/chat.md
- https://platform.kimi.ai/docs/api/models-overview.md
- https://platform.kimi.ai/docs/guide/use-kimi-k2-to-setup-agent.md
- https://platform.kimi.ai/docs/guide/use-kimi-k2-thinking-model.md
- https://platform.kimi.ai/docs/guide/use-json-mode-feature-of-kimi-api.md
- https://platform.kimi.ai/docs/pricing/chat-k25.md
- https://platform.kimi.ai/docs/pricing/chat-k26.md
- https://platform.kimi.ai/docs/pricing/limits.md
