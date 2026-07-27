# AutoCoach iOS M3 — Handover & QA checklist

**Branch:** `feat/ios-m3` (18 commits on top of `dev` @ `937c6e0`) · **Date:** 2026-07-27
**Not merged to `dev`. Nothing pushed.** Built by a 6-agent Herdr run (`20260727-2005-49`).

App went from **15 Swift files / 2,159 lines** to **51 files / 10,504 lines**.

---

## What changed, in one line

A brand-new user can now sign up, onboard, upload a document, see their concept mastery and
their due-review queue, and spend their XP — **none of which was possible before this branch.**
Before it, the native app had no signup and no upload, so a fresh account was a dead end.

---

## Verified vs unverified — read this before testing

**Verified by me, not by the agents that wrote it:**
- `xcodebuild … -destination 'iPhone 17 Pro' build` → **BUILD SUCCEEDED**, zero errors, at every
  integration point (7 separate builds).
- App **installs and launches** on the simulator with no crash and a clean system log.
- The Welcome screen renders correctly — fonts, cream ground, emerald ticks, zero radii, hard
  shadow (screenshotted).
- The Apple button's corner radius — the lane claimed it was square, the screenshot showed it
  was not, and it is now genuinely square via `ASAuthorizationAppleIDButton.cornerRadius`.

**NOT verified — the honest boundary:**
Everything past the Welcome screen needs a real signed-in Supabase session, and exercising the
quiz path spends Kimi/OpenAI tokens. Per the standing rule about paid APIs, no agent ran a live
flow and neither did I. **So every screen below is compile-and-reason correct, not proven.**
That is what the QA pass is for.

---

## QA checklist

Run on a real device or simulator with a real account. `⚠` marks the ones I consider most
likely to break, with the reason.

### Auth
- [ ] Fresh install → Welcome renders, not Login
- [ ] Continue with email → Signup → create a genuinely new account → lands in onboarding
- [ ] ⚠ **If the Supabase project has email confirmation ON**, signup shows "check your inbox"
      with a working Resend. If it is OFF, that state is unreachable. *Nobody has confirmed which
      it is* — this is open question 1 below.
- [ ] ⚠ Signing up with an **existing** email offers "Sign in instead". Detection relies on
      Supabase returning an empty `identities` array, which is observed behaviour, not contract.
- [ ] ⚠ **Sign in with Apple needs two console changes nobody has made** (see Blockers). Until
      then it will fail. This is config, not code.
- [ ] Forgot password sends a real reset email
- [ ] Wrong password shows an inline message, never a raw error string

### Onboarding
- [ ] All 4 steps → completes → never shows again on relaunch
- [ ] **Skip every step** → still completes, never blocks
- [ ] Kill the app mid-flow → resumes on the same step
- [ ] Notification permission is asked only *after* the step-4 time choice, never at launch
- [ ] ⚠ A returning user is never trapped in onboarding. The probe **fails open** — a network
      blip routes into the app instead of into onboarding. There is currently **no way back into
      the flow** if that happens; Settings needs a "redo onboarding" entry.

### Upload
- [ ] Files → pick a real PDF → progress bar moves with actual bytes → registers → processing →
      ready → quizzable
- [ ] ⚠ Background the app mid-upload → no corrupt state; either resumes or fails with a retry
- [ ] A >20 MB file is refused with the real size shown
- [ ] Non-PDF/PPTX files cannot be picked at all
- [ ] ⚠ With 2 documents already present, a third upload shows the credits framing **and an
      inline delete**, never a raw 429

### Today
- [ ] Due count matches what the backend returns
- [ ] Start review → session begins and **does not consume a daily credit** (this is the whole
      point of the screen — verify the credit count is unchanged afterwards)
- [ ] Zero due renders "Nothing due. You're ahead." with a working Study-anyway → Library
- [ ] ⚠ Weakest-concept tap starts a session actually focused on that concept
- [ ] ⚠ Streak survives a date rollover and a timezone change. It is **device-local** — see
      Known limitations.
- [ ] ⚠ The "continue in progress" card finds a resumable session. `GET /documents/` exposes only
      the latest session id per document and no status, so it is found by probing — it can miss.

### Library / Document detail
- [ ] Rows show real mastery %, concept counts and a status that moves `processing → ready` on
      its own without a manual refresh
- [ ] Row tap opens the detail screen (it used to start a quiz immediately)
- [ ] Activation checklist shows on a new account and disappears for good after all three
- [ ] Swipe-to-delete confirms first, then really deletes
- [ ] Concepts are sorted **weakest first**, with importance dots and core badges
- [ ] Selecting up to 3 concepts and starting a quiz genuinely focuses on them; a 4th is refused
      with an explanation
- [ ] ⚠ Hitting the daily quota opens the credits sheet — **never** an alert

### Profile / Settings / Credits
- [ ] Email, aggregate mastery and XP are real
- [ ] ⚠ Redeem 100 XP → credit granted, balance updates. 409 retries once silently.
- [ ] Reset countdown is sane (client-computed from midnight UTC — there is no endpoint)
- [ ] Reminder time/days schedules a real local notification; denying permission does not break
      the screen
- [ ] Sign out confirms, then genuinely clears the session
- [ ] Terms and Privacy render natively in-app (App Store review will look for this)

### Design system (spot-check any 3 screens)
- [ ] No rounded corners anywhere except the `StatusPill` dot
- [ ] Hard offset shadow appears on **one** CTA per screen, nowhere else
- [ ] No coloured status dots — states are shapes; the only colour is a genuine failure
- [ ] No text smaller than ~13pt
- [ ] Reduce Motion on → nothing animates
- [ ] Dynamic Type at the largest setting → nothing clips

---

## Blockers needing you (config, not code)

1. **Sign in with Apple will not work until:**
   - the Apple provider is enabled in the **Supabase dashboard** with the correct Services ID, and
   - Sign in with Apple is enabled on the `com.padzy.autocoach` **App ID** in the Apple Developer
     portal.
2. **App Group / Keychain access group are declared but inert on this build.** `DEVELOPMENT_TEAM`
   is unset, so the entitlement is stripped and the container falls back to local storage. Chosen
   identifiers — `group.com.padzy.autocoach` and `$(AppIdentifierPrefix)com.padzy.autocoach` —
   need registering. Worth renaming *now* if you want different ones, before the widget and share
   extension exist.
3. **Is email confirmation ON in the Supabase project?** It decides whether the signup
   check-your-inbox state is reachable at all.

---

## Known limitations (deliberate, not bugs)

- **The streak is device-local** and dies on reinstall or device change. No endpoint exposes
  per-day activity. Settings says so on screen. Your call, taken this session.
- **The credits count is a device-local estimate**, labelled as such — credits spent on the web or
  another device are invisible, because nothing exposes `user_daily_usage`.
- **Streak records on session *start*, not completion** — starting and immediately quitting still
  counts. The quiz surface belongs to another lane; a start is the only signal Today can see.
- **XP and credits have no GET endpoint** — both are cached client-side and refreshed
  opportunistically.

---

## Deferred (unchanged from PRD §9 — all need the backend unfrozen)

Subscription entitlements · durable cross-device streak · fast recall mode · source-chunk citation
under answers · YouTube/audio ingest · Quizlet/Anki import · audio mode · social · time-series
stats · server push.

**Still to build client-side (Phase 3 + 4, not started):** SessionConfigSheet, quiz/results
polish, haptics, session resume, camera scan, widget, Live Activity, Share Extension, App Intents.

### Camera scan (#68) — resolved without a spike
A raw VisionKit scan produces an **image-only PDF**, so backend extraction would find no text and
the document would silently ingest as zero chunks. It does **not** need backend OCR: run
`VNRecognizeTextRequest` on-device (free, no network) and embed the result as an invisible text
layer, which the existing PDF extractor then reads normally. Gate it on `chunk_count > 0` after
register, and block upload client-side if Vision recognises almost no text — otherwise a dead file
burns one of the user's two document slots. Full detail in PRD §12.1.

---

## Two defects I fixed that the agents got wrong

Recorded because both are the kind of thing that survives a "looks fine" review:

1. **The Apple button was still round.** The lane squared it by painting a rectangle *behind*
   `SignInWithAppleButton`, but the button draws its own rounded fill on top. It reported the
   criterion as met. The screenshot disproved it.
2. **Profile would have shown a zero streak forever.** Today persists a `StreakState` as JSON in
   the App Group container; Profile was probing for UserDefaults keys that never existed. Both
   lanes passed their own acceptance criteria — the bug only existed *between* them, and it would
   have read as "the user hasn't studied" rather than as a fault.
