# AutoCoach Native iOS — Architecture Research (Milestone 1)

**Issue:** #59 · **Branch:** `agent/1/native-ios` · **Author:** Fable 5 (lead) · **Date:** 2026-07-05
**Backend (unchanged, client-only build):** `https://autocoach-production.up.railway.app`
**Sources:** `backend/app/api/routes/*` + `backend/app/models/*` (read directly from this worktree — source of truth), `frontend/src/lib/api.ts`, `frontend/src/hooks/useQuiz.ts`, `CLAUDE.md`, Padzy OS skill (`references/apple-platforms.md`, `themes/autocoach.json`).

> ⚠️ Two corrections vs. CLAUDE.md (repo doc is stale): there is **no `POST /quiz/generate`** route module anymore (deleted in PR #56), and there are **no standalone `/concepts` routes** — concepts are served via `GET /documents/{id}/concepts`. The map below reflects actual code.

---

## 1. API Map

Global rules:

- **Auth:** every endpoint except `GET /health` and `GET /` requires `Authorization: Bearer <supabase_jwt>`. `user_id` is always derived server-side from the token — never sent by the client.
  - 401 details: `"Invalid authorization header. Expected 'Bearer <token>'"`, `"Invalid or expired token"`, `"Token validation failed"`.
- **CORS is irrelevant to iOS** (browser-only mechanism). URLSession is unaffected; no allowlist change needed. Allowed headers/methods on the server already cover our use.
- **Errors:** FastAPI-style `{"detail": <string | object>}`. The client error type must tolerate `detail` being either a string or a structured object (see 429 shapes below).
- **Long-poll endpoints** accept `wait_ms` (0–10000, server-capped at 10s, internal 200ms tick) and signal state in the **body at HTTP 200**, never via 204.

### Health (no auth)

| Method/Path | Notes |
|---|---|
| `GET /health` | `{"status":"healthy","service":"autocoach-api"}` |
| `GET /health?deep=true` | probes Qdrant+Postgres; 200 or **503** with `checks: {qdrant: {status, latency_ms}, postgres: {...}}` |

### Documents (`/documents`, auth)

| Method/Path | Request | Response / notes |
|---|---|---|
| `POST /documents/register` | JSON `{filename, file_path, file_type: "pdf"\|"pptx", file_size}` | `DocumentResponse` with `status:"pending"`. **iOS primary upload path** — see flow below. |
| `POST /documents/upload` | multipart `file` | Backend-side upload alternative. 400 bad type/content-type, 413 >20MB. |
| `GET /documents/` | — | `{documents: [DocumentResponse]}` newest-first; each includes `session_id` of latest session |
| `GET /documents/{id}` | — | `DocumentResponse` + `concept_count`; 404 `"Document not found"` |
| `GET /documents/{id}/concepts` | — | `{document_id, concepts: [Concept]}` — Concept: `id, concept_name, concept_description?, importance_score, is_core, parent_concept_id?, created_at, mastery_score, times_tested, times_correct, last_tested_at?, mastered_at?` |
| `POST /documents/{id}/search` | `{query: str(1..500), top_k: int=5(1..20)}` | `{query, document_id, results: [{content, chunk_index, score}]}`; 400 if doc not `ready` |
| `DELETE /documents/{id}` | — | **204 No Content** (only non-JSON success in the API) |
| `GET /documents/progress/summary` | — | `{documents: [DocumentProgress]}` |
| `GET /documents/{id}/progress` | — | `DocumentProgress`: `document_id, document_title?, mastery_percent (0-100), concepts_total, concepts_practiced, weak_concepts_count, mastered_concepts_count, milestone: "none"\|"25"\|"50"\|"75"\|"100"` |

`DocumentResponse`: `id, filename, file_type, file_size, status ("pending"→"processing"→"ready"/"failed"), ai_title?, session_id?, concept_count?, created_at`.

**Upload flow (client-direct, mirrors web):**
1. Client uploads bytes straight to Supabase Storage, bucket **`documents`**, path **`{user_id}/{document_id}/{filename}`** (server rejects paths not starting with `{user_id}/` → 403; `..` → 400). Use supabase-swift Storage with the user's JWT.
2. `POST /documents/register` with the storage path.
3. Poll `GET /documents/{id}` until `status == "ready"` (or `"failed"`). Web polls ~2s interval; same here.

Register errors: 400 invalid type/path/mismatch/`"File not found in storage..."`, 403 path-ownership, 413 >20MB, 429 doc quota (below).

### Quiz sessions (`/quiz/sessions`, auth + rate limit)

Question type enum: `text_free` | `text_mcq` | `text_tf` | `rendered` (reserved, never emitted in Phase 1; `render_kind`/`render_payload` are NOT in any response model — ignore).
MCQ: `options` = exactly 4 strings, `correct_answer` = `A|B|C|D`. TF: `options` null, answer `true|false`. Free: no options, LLM-graded async.

`QuestionResponse` (shared shape): `question_id, question_number, total_questions, question_type, question_text, options?, difficulty`.

| # | Method/Path | Request | Response |
|---|---|---|---|
| 1 | `POST /quiz/sessions/` | `{document_id?, mode: "standard"\|"review" = "standard", num_questions: 1..20 = 5 (cap, adaptive), difficulty: "easy"\|"medium"\|"hard" = "medium", question_types: [QuestionType] = [mcq,tf,free], focus_concept_ids?: [uuid] (max 3, unique)}` | `{session_id, document_id, difficulty, total_questions, first_question: QuestionResponse}`. Synchronous LLM call — expect seconds, not ms. Errors: 400 doc-not-ready/missing document_id/focus rules, 404 doc or (review-mode) `"No concepts are due for review right now."`, 429 daily quota (standard only — **review mode is quota-free**). |
| 2 | `GET /quiz/sessions/{id}` | — | `SessionStatus`: `session_id, document_id, status, difficulty, total_questions, answered_questions, correct_answers, score_percentage?, questions: [SessionQuestionDetail], started_at, completed_at?`. Detail: `question_id, question_number, question_type, question_text, user_answer?, is_correct?, correct_answer, explanation?` — this is the **results screen** payload. |
| 3 | `GET /quiz/sessions/{id}/current` | — | `QuestionResponse`. 404 session, **410 session not active**, 404 `"No more questions..."` — web treats 404/410 as session-complete. Used for resume-in-progress. |
| 4 | `POST /quiz/sessions/{id}/answer?question_id={uuid}` | **`question_id` is a query param.** Body: `{answer: str(1..2000), input_method: "typed"\|"click"\|"voice" = "typed"}` | `AnswerResponse` (below). 400 on already-answered/inactive session (ValueError passthrough). |
| 5 | `GET /quiz/sessions/{id}/answer?question_id={uuid}&wait_ms=5000` | verdict long-poll (text_free only) | `AnswerResponse`; when still pending → `retry_after_ms: 500`. 404 unknown session/question, **409 `"Question not answered"`** if polled before submit. |
| 6 | `GET /quiz/sessions/{id}/next?wait_ms=5000` | next-question long-poll | `NextQuestionResponse` (below). |

`AnswerResponse`:
```
result: {
  is_correct: bool?,        // null while eval_status == "pending"
  correct_answer: str?,     // null while pending (answer-leak guard)
  explanation: str?,        // null while pending
  score_so_far: int, total_answered: int, feedback: str?,
  xp_awarded: int = 0, mastery_delta: double = 0.0
},
session_complete: bool,
session_ended_reason: str?,  // "cap_reached" | "mastery_threshold"
eval_status: "complete" | "pending",
retry_after_ms: int?         // set only on verdict-poll timeout (500)
```
- **MCQ/TF:** graded inline → `eval_status:"complete"` immediately; backend queues next-question generation.
- **text_free:** returns `eval_status:"pending"`, all verdict fields null → client polls endpoint #5 (see §4).

`NextQuestionResponse`:
```
status: "ready" | "preparing" | "ended" | "failed"
question: QuestionResponse?      // ready
retry_after_ms: int?             // preparing → ~500
reason: str?                     // ended: "cap_reached" | "mastery_threshold"
summary: {total_answered, correct_answers, score_percentage}?   // ended
error: str?  message: str?       // failed (e.g. "session_not_found")
```

### Review / XP / Onboarding (auth)

| Method/Path | Request | Response |
|---|---|---|
| `GET /review/today?limit=20` (1..20) | — | `{count, due_concepts: [{id, name, document_id, mastery_score, mastery_percent}], rules: {mastery_below: 0.75, stale_days: 2}}` |
| `POST /xp/redeem` | no body | `{success, message, new_total_xp, credits_added: 1}`. 400 `"Insufficient XP. You have <n>, but need 100."`, 404, **409 concurrent-update (retryable)** |
| `GET /onboarding` | — | `{has_completed, learning_topics?, goal?, study_frequency?, experience_level?}` (no trailing slash) |
| `POST /onboarding` | `{learning_topics? (≤10KB), goal? (≤500), study_frequency? (≤100), experience_level? (≤100)}` | upsert, merges `learning_topics`; returns `OnboardingResponse` |

### Rate-limit / quota shapes (client must handle all three)

1. **Per-minute limiter** (all `/quiz/sessions/*`, 60 req/min/user, in-memory): `429 {"detail": "Rate limit exceeded. Please slow down and try again."}` — detail is a **string**.
2. **Daily quiz quota** (session create, standard mode; 5/day + redeemed credits; pro/admin unlimited): `429 {"detail": {"error": "daily_limit_reached", "type": "quiz", "limit": <int>, "message": "You've reached your daily quiz limit of <N>."}}` — detail is an **object**. Server deletes the just-created session on this path — treat as "no session created". Also possible: `503 "Failed to update daily usage due to high contention. Please retry."`
3. **Document quota** (upload/register, default 2 docs/user): `429 {"detail": "Document limit reached (<N>). Please delete a document or upgrade your plan."}` (verified in `abuse_controls.py` — it is 429, not 403).

---

## 2. Auth Flow (Supabase JWT)

**Decision: official `supabase-swift` SDK** (`https://github.com/supabase/supabase-swift`, SPM) rather than raw GoTrue REST.

Rationale:
- Auth client handles the whole token lifecycle: `signIn(email:password:)`, `signUp`, session persistence, and **automatic background refresh** of the access token before expiry (refresh-token rotation handled internally). Hand-rolling refresh against `/auth/v1/token?grant_type=refresh_token` is exactly the kind of subtle-failure code we don't want to own.
- **Keychain storage is the SDK default on iOS** (`AuthLocalStorage` → Keychain-backed). Session (access + refresh token) survives relaunch; nothing token-shaped ever touches UserDefaults. We keep the default and note the storage key under our bundle's Keychain access group.
- We also need **Storage** for direct-to-bucket upload (§1 upload flow) — same SDK, same authenticated client, one dependency.
- The web client does the same thing via `@supabase/ssr` (`getSession()` → `session.access_token`), so behavior stays symmetric.

Configuration: `SUPABASE_URL` + publishable (anon) key shipped via a `Config.xcconfig` → Info.plist keys (not hardcoded in source; same values as the web app's `NEXT_PUBLIC_*` — publishable key is not a secret, but xcconfig keeps env swappable dev/prod).

**Attach pattern** (mirrors `apiFetch` in `frontend/src/lib/api.ts`):

```swift
// APIClient (actor) — per request:
let session = try await supabase.auth.session   // SDK refreshes if expired
request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
```

`supabase.auth.session` is the single source of truth — asking it per-request means we never cache a stale token ourselves.

Lifecycle:
- **Obtain:** email/password sign-in (web parity; OAuth later). `authStateChanges` async stream drives root routing (`signedIn` / `signedOut` / `tokenRefreshed`).
- **Store:** SDK default Keychain storage (`kSecClassGenericPassword`, this-device-only accessibility). No custom crypto.
- **Attach:** `APIClient` actor injects the bearer header on every backend call; Storage uploads use the same authenticated Supabase client directly.
- **Refresh:** automatic via SDK. Defense in depth: on a backend **401**, force `try await supabase.auth.refreshSession()` once and retry the request once; if still 401 → sign out and route to login (web equivalent: redirect to `/login`).
- **Sign out:** `supabase.auth.signOut()` clears Keychain session; wipe any cached user data in memory.

---

## 3. SwiftUI App Structure

**Targets:** iOS 18+, Swift 6 (strict concurrency), SwiftUI-only, no UIKit scenes. Light-only (`UIUserInterfaceStyle = Light` in Info.plist — Padzy OS has no dark mode; this also suppresses any dark-trait styling ambiguity).

### State management: **Observation framework (`@Observable`) + MVVM-lite, services as actors**

Rationale:
- `@Observable` (iOS 17+) is Apple's current default — per-property change tracking, no Combine boilerplate, plays directly with Swift 6 concurrency. ObservableObject/Combine is legacy for a greenfield 18+ app; TCA is unjustified dependency weight for a 6-screen client.
- "MVVM-lite": screens with real orchestration (QuizSession) get an `@Observable` model; dumb screens (Settings, Results) can consume services directly. No forced one-VM-per-view ceremony.
- **Services layer** (the part worth being strict about):
  - `APIClient` — `actor`; URLSession + Codable; attaches bearer; decodes the dual-shape `detail` error envelope into a typed `APIError` (`.rateLimited`, `.dailyQuota(limit:message:)`, `.docQuota`, `.unauthorized`, `.http(status, detail)`); one 401-refresh-retry.
  - `AuthStore` — `@Observable`; wraps supabase-swift auth state stream; exposes `sessionState` for root routing.
  - `QuizEngine` — `@Observable` per-session state machine (§4). Owns the answer/verdict/next polling choreography so views only render states.
  - `DocumentStore` — list + upload orchestration (Storage upload → register → readiness polling).
- Injection via `.environment(...)` (Observation-native), constructed once in `AutoCoachApp`.

### Navigation model

Root switch on auth/onboarding state, then a **TabView of three top-level sections** (HIG: tab bar = top-level only), each with its own `NavigationStack`. The quiz session is a **`fullScreenCover`** — it is a modal focus task with explicit exit, not a push; this blocks tab-switching mid-question (matches HIG modality intent and the web's dedicated `/session` route).

```
AutoCoachApp
└─ RootView (switch on AuthStore.sessionState + onboarding)
   ├─ AuthFlow: LoginView / SignupView            (NavigationStack)
   ├─ OnboardingFlow (first sign-in only)          (POST /onboarding)
   └─ MainTabView
      ├─ Tab 01 LIBRARY  (NavigationStack)
      │   ├─ DashboardView       — docs list + progress summary (GET /documents/, /progress/summary)
      │   ├─ DocumentDetailView  — concepts + per-doc progress + start-quiz config
      │   └─ UploadFlow (sheet)  — file importer → Storage → register → readiness poll
      ├─ Tab 02 REVIEW  (NavigationStack)
      │   └─ ReviewTodayView     — due concepts (GET /review/today) → starts mode:"review" session
      └─ Tab 03 SETTINGS (NavigationStack)
          └─ SettingsView        — account, XP balance + redeem, sign out
      └─ fullScreenCover: QuizSessionView → ResultsView
          (QuizSessionView drives QuizEngine; ResultsView renders GET /quiz/sessions/{id} SessionStatus)
```

Screen inventory (Milestone 2+): Login, Signup, Onboarding, Dashboard/Library, DocumentDetail, Upload sheet, QuizSession (question renderers per type: MCQ options / TF pair / free-text field), Results, ReviewToday, Settings. Deep-link/resume: `GET /{id}/current` restores an in-flight session.

### Concurrency rules

- All polling loops live in `QuizEngine` as structured `Task`s cancelled on view disappear/session end — no detached tasks, no timers.
- `APIClient` is an actor → request/decode off the main thread by construction; `@Observable` models are `@MainActor`.

---

## 4. Async Free-Text Verdict Handling

Mirrors `useQuiz.ts` (`pollAnswerVerdict` + `pollUntilReady`) exactly — the web hook encodes hard-won invariants the native client must keep:

**Invariants (from web + backend source):**
1. After `POST /answer` returns `eval_status:"pending"`, the answer **is already persisted**. NEVER resubmit — a retried POST dead-ends on 400 "Question already answered".
2. Verdict polling **never throws**: transient failures (network blip, per-minute 429, 5xx) count as a failed attempt, back off 1000ms, continue.
3. If the polling window exhausts while still pending → UI shows "still grading", **not** a verdict. `is_correct` stays `nil` (tri-state, not `false`!).
4. `correct_answer`/`explanation` are withheld server-side until grading completes (leak guard) — the UI must not reserve layout for them in pending state.

**QuizEngine state machine** (per question):

```
idle → submitting → (eval_status == "complete") → verdict(result)          // MCQ / TF, ~250ms
                  → (eval_status == "pending")  → grading                   // text_free
grading:  loop ≤ 6 attempts:
            GET /answer?question_id=&wait_ms=5000        // server long-poll ≤5s
            ├─ complete → verdict(result)
            ├─ pending  → sleep(retry_after_ms ?? 300ms) // server sends 500 on timeout
            └─ error    → sleep(1000ms)                  // swallowed, never thrown
          window exhausted → gradingTimedOut             // "still grading" UI, offer manual re-check
verdict → session_complete ? finished(fetch SessionStatus) : awaitingNext
awaitingNext: loop ≤ 4 attempts:
            GET /next?wait_ms=5000
            ├─ ready     → present(question)
            ├─ preparing → sleep(retry_after_ms ?? 500ms)
            ├─ ended     → finished(summary, reason)     // reason: cap_reached | mastery_threshold
            └─ failed    → error(message) + retry button
          exhausted → one last wait_ms=2000 try → failed("timeout") + retry
```

Swift shape: `enum QuestionPhase { case idle, submitting, grading(attempt: Int), gradingTimedOut, verdict(AnswerResult), awaitingNext, finished(SessionSummary, reason: String?), failed(String) }` driven by one cancellable `Task` per phase inside `QuizEngine`. `is_correct: Bool?` stays optional through the entire model layer — pending is a first-class state, and `eval_status` (not nil-checking) is the discriminator.

Numbers copied from web: verdict poll `wait_ms=5000`, `maxAttempts=6` (~30s worst case, grading ~2s p50 → typically 1 round-trip); next-question poll `wait_ms=5000`, `maxAttempts=4` (~20s). Server caps `wait_ms` at 10000 (`NEXT_QUESTION_MAX_WAIT_MS`); FSM stale-TTL self-heals at 30s, so client windows sit safely inside it. URLSession config: `timeoutIntervalForRequest ≥ 15s` so a 10s server hold never trips the client timeout.

---

## 5. Padzy OS → SwiftUI Design-Token Mapping

Theme: `autocoach` (warm ground, Functional+Dense tiers). **Light-only** — enforced via `UIUserInterfaceStyle = Light`; asset colors carry a single universal appearance (already in the Milestone-1 asset catalog).

### Colors (asset catalog, done in M1)

| Token | Hex | Asset name | Use |
|---|---|---|---|
| ground | `#F9F1E6` | `Ground` | screen background (`Color("Ground")`, `ignoresSafeArea` for backgrounds only) |
| surface | `#D2CABF` | `Surface` | hairlines on cream, secondary panels |
| ink | `#171717` | `Ink` | text, borders, hard shadow |
| muted | `#95928F` | `Muted` | secondary text (≥4.5:1 on cream only at small-text sizes — verify per use; prefer Ink at caption sizes) |
| accent | `#109462` | `Accent` + `AccentColor` (global tint) | active state, progress, focus, ONE primary action per view |
| error | `#C2402A` | `ErrorRed` | wrong-answer, destructive |

Rule: exactly one accent visible per view. Wrong/right verdict = ErrorRed/Accent, never both decoratively.

### Typography

Bundle TTFs (Google Fonts, OFL): **Space Grotesk** (display/headings), **Inter** (body), **Space Mono** (ALL data: numbers, timers, scores, XP, IDs, kickers — Invariant 1). Register via Info.plist `UIAppFonts` (xcodegen: `INFOPLIST_KEY` doesn't cover arrays → supply plist properties in `project.yml`). Always pair with Dynamic Type:

```swift
enum ACXFont {
  static func display(_ s: CGFloat, relativeTo t: Font.TextStyle) -> Font { .custom("SpaceGrotesk-Bold", size: s, relativeTo: t) }
  static func body(_ s: CGFloat = 17)  -> Font { .custom("Inter-Regular", size: s, relativeTo: .body) }
  static func mono(_ s: CGFloat = 13)  -> Font { .custom("SpaceMono-Regular", size: s, relativeTo: .footnote) }
}
```

Fallback until fonts land: `.system(design: .monospaced)` for data (SF Mono), system for body — M1 shell does this.

### Brand primitives (ViewModifiers, Milestone 2)

| Web pattern | SwiftUI equivalent |
|---|---|
| radius 0 everywhere | `Rectangle()` / `.clipShape(Rectangle())`; never `RoundedRectangle` > 0; `.buttonStyle` custom, no `.borderedProminent` |
| `.shadow-hard` (4px ink offset, zero blur; CTA + active quiz card ONLY) | `.background(alignment: .topLeading) { Rectangle().fill(Color("Ink")).offset(x: 4, y: 4) }` behind an Ink-stroked Rectangle — **never** `.shadow(radius:)` |
| `.kicker` `01 / DASHBOARD` | `Text("01 / LIBRARY").font(ACXFont.mono(12)).kerning(1.2)` — numbered mono kickers per section |
| 2px green left tick (active) | `.overlay(alignment: .leading) { Rectangle().fill(Color("Accent")).frame(width: 2) }` |
| 1px hairline dividers | `Rectangle().fill(Color("Surface")).frame(height: 1/displayScale)` (`@Environment(\.displayScale)`) |
| StatusPill (mono text + dot) | `HStack(4) { Circle().fill(statusColor).frame(6); Text(status).font(ACXFont.mono(11)) }` — Circle is the ONE rounded exception (dot, per web parity) |
| no gradients / blur / materials | flat asset colors only; no `.regularMaterial`, no `.glassEffect` — suppress Liquid Glass per surface (flat toolbar/tab backgrounds via `.toolbarBackground(Color("Ground"), for: ...)`) |

### Platform contract kept (override decoration, never interaction)

44pt hit targets; safe areas respected (cream extends under via `ignoresSafeArea` on background only); push vs modal per intent (§3); Dynamic Type via `relativeTo:` everywhere; VoiceOver labels on question options and verdict states (verdict announced via `AccessibilityNotification.Announcement`); Reduce Motion gates any verdict/progress animation; contrast floor 4.5:1 (Ink on Ground = ~14:1 ✓, Accent on Ground = ~4.6:1 ✓ for large/non-text, Muted on Ground fails small-text — data labels in Muted must be ≥ footnote and non-essential).

---

## Milestone 1 deliverables in this commit

- `ios/project.yml` — xcodegen manifest (source of truth; regenerate with `xcodegen generate`)
- `ios/AutoCoach.xcodeproj` — generated, committed so Xcode/humans need no tooling
- `ios/AutoCoach/` — `@main` app + placeholder ContentView + asset catalog (6 theme colors, light-only)
- Verified: `xcodebuild -project ios/AutoCoach.xcodeproj -scheme AutoCoach -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build` → **BUILD SUCCEEDED**; app installs + launches on iPhone 17 Pro simulator without crash (no iPhone 16 runtime installed on this machine — 17 Pro is the local equivalent).

## Open questions for review (before Milestone 2)

1. Password reset / OAuth providers in-scope for native, or email+password only (web parity)?
2. Document upload: iOS Files-app importer only, or also camera-scan → PDF?
3. Voice input (`input_method: "voice"` exists in the API) — wire up dictation in M2 or defer?
4. Min deployment 18.0 chosen (Observation + broad device coverage). Bump to 26 only if we want Liquid-Glass-era APIs — we suppress that look anyway. Confirm.
