# iOS Foundation Notes (Phase 0)

Decisions and identifiers established by the Phase 0 foundation lane. Feature lanes
should read this before touching shared plumbing.

---

## 1. Bundled fonts (closes #67)

TTFs live in `ios/AutoCoach/Resources/Fonts/`, declared via `UIAppFonts` in
`project.yml` under `targets.AutoCoach.info.properties`. They cannot go in an
`INFOPLIST_KEY_*` build setting — that mechanism has no array form.

| File | Source | Licence |
|---|---|---|
| `SpaceGrotesk-Variable.ttf` | google/fonts `ofl/spacegrotesk` | `OFL-SpaceGrotesk.txt` |
| `Inter-Variable.ttf` | google/fonts `ofl/inter` | `OFL-Inter.txt` |
| `SpaceMono-Regular.ttf` | google/fonts `ofl/spacemono` | `OFL-SpaceMono.txt` |
| `SpaceMono-Bold.ttf` | google/fonts `ofl/spacemono` | `OFL-SpaceMono.txt` |

All three families are SIL Open Font License 1.1; the licence files are committed
alongside and ship inside the app bundle.

### The PostScript names are not what you would guess

Space Grotesk and Inter ship from Google Fonts as **variable** fonts. Their named
instances carry the default instance name as a prefix, so the bold Space Grotesk
face is genuinely called `SpaceGrotesk-Light_Bold`. These strings were read out of
the actual TTFs with `CTFontManagerCreateFontDescriptorsFromURL`, not guessed:

```
SpaceGrotesk-Light          SpaceGrotesk-Light_Regular
SpaceGrotesk-Light_Medium   SpaceGrotesk-Light_Bold
Inter-Regular               Inter-Regular_Medium
Inter-Regular_SemiBold      Inter-Regular_Bold      (…Thin/Light/ExtraBold/Black too)
SpaceMono-Regular           SpaceMono-Bold
```

**This matters because a wrong font name fails silently.** `Font.custom("Space
Grotesk-Bold", …)` produces no build error and no runtime error — it renders in
San Francisco. Use the constants in `ACXFont.Face`; do not "tidy" them.

`ACXFont.assertBundledFacesResolve()` runs from `AutoCoachApp.init()` in DEBUG
only. It compares each resolved `UIFont.fontName` against the name requested and
asserts on a miss, so a regression here surfaces on the next launch instead of
shipping as a silent fallback.

Every `ACXFont` helper passes `relativeTo:` so Dynamic Type still scales.

## 2. App Group + Keychain access group

Declared in `project.yml` under `targets.AutoCoach.entitlements`, which generates
`ios/AutoCoach/AutoCoach.entitlements` (committed, generated — edit `project.yml`,
not the plist).

| Purpose | Identifier |
|---|---|
| App Group | `group.com.padzy.autocoach` |
| Keychain access group | `$(AppIdentifierPrefix)com.padzy.autocoach` |

These unblock the Phase 4 widget (§6.1) and share extension (§6.4): the App Group
gives a shared container, and the keychain group lets an extension read the
Supabase session the app already holds instead of owning a separate login.

**Caveat — they are inert today.** `DEVELOPMENT_TEAM` is empty, so a simulator
build signs with "Sign to Run Locally" and Xcode strips both entitlements from the
final `.xcent` (verified: `codesign -d --entitlements` on the built app returns an
empty dict). The declaration is correct and will take effect once a real team and
provisioning profile are configured; nobody should conclude from a simulator build
that the App Group "works" yet. Both identifiers must also be registered on the
Apple Developer portal before a device build will succeed.

## 3. Root routing

`RootView` switches four ways: `loading` → `signedOut` → `signedIn`+needs
onboarding → `signedIn`. `AuthStore.state` supplies the first three; the
onboarding branch comes from a `GET /onboarding` probe held in `RootView`'s own
state, so `AuthStore` stayed untouched.

**The probe fails open.** A failed or errored `GET /onboarding` routes to the app,
not to onboarding. Trapping a returning user in a signup flow they already
finished because of one network blip is a far worse failure than a user who
silently skips onboarding. Lane B should keep this bias when it replaces
`OnboardingPlaceholder`.

The gate re-arms on `signedOut`, so signing into a second account re-probes rather
than inheriting the first account's answer.

## 4. Tabs

`MainTabView` — `01 TODAY` / `02 LIBRARY` / `03 PROFILE`, each wrapping its **own**
`NavigationStack` so a push in one tab survives a tab switch. Tab bar is flat
`Ground` via `.toolbarBackground(_:for: .tabBar)` plus
`.toolbarBackgroundVisibility(.visible, for: .tabBar)` — the visibility modifier is
required, without it UIKit keeps its default translucent bar and the Ground colour
never appears.

Today and Profile are `TabPlaceholder` (kicker + one line). Library already points
at the existing `DashboardView`. Lanes D/E/F replace these bodies.

## 5. Networking model additions

`Networking/Models.swift` gained onboarding, XP-redeem, review-today, concepts and
progress types. **Every field shape was read from `backend/app/` directly**, not
from `CLAUDE.md` (stale) and not inferred. Two shapes that differ from the obvious
guess:

- **`learning_topics` is an object, not an array.** The backend types it
  `Optional[Dict[str, Any]]`, merges it key-by-key on upsert, and nests
  `experience_level` inside it. Modelling it as `[String]` would silently drop
  data on POST. It is typed `[String: JSONValue]` here, using the small `JSONValue`
  enum added for `Any`-shaped JSONB columns (`rules` on review-today too).
- **Concept fields are `concept_name` / `concept_description`**, not `name` /
  `description`. Note that `GET /review/today`'s `DueConcept` *does* use `name` —
  the two endpoints genuinely disagree, so they are two distinct Swift types.

`DocumentProgress.milestone` is a string `"none" | "25" | "50" | "75" | "100"`;
map it with `MilestoneBadge.Level(apiValue:)` rather than parsing it at each call
site.

## 6. `QuestionKind.unknown`

`QuestionKind` previously fell back to `.freeText` for any unrecognized
`question_type`, which handed the user a text box for a question the client cannot
render and graded the answer against the wrong input mode. There is now an
explicit `.unknown` case and `QuestionKind(apiValue:)`; `QuizSessionView` treats
`.unknown` exactly as `.rendered` (unsupported, cannot submit).

This required touching three `switch` statements in `Quiz/QuizSessionView.swift` —
a file otherwise outside this lane. The change is mechanical
(`case .rendered:` → `case .rendered, .unknown:`); a Phase 3 quiz lane should
expect it.
