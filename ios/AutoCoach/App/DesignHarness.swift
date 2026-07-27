#if DEBUG
import SwiftUI
import Supabase

/// DEBUG-only screen gallery, mounted by launching with `-designHarness 1`.
///
/// Every screen worth reviewing sits behind a signed-in Supabase session, and exercising
/// the quiz path spends LLM tokens. That made design review impossible without either
/// credentials or a bill — so the real view bodies are composed here against fixed data
/// instead. These are the **same** view types the app ships, not redrawn copies, so what
/// this renders is what a user sees.
///
/// Never reachable in a release build: the whole file is `#if DEBUG`.
struct DesignHarness: View {
    let auth: AuthStore
    let api: APIClient

    @State private var screen = Int(
        ProcessInfo.processInfo.environment["HARNESS_SCREEN"] ?? "0"
    ) ?? 0

    var body: some View {
        // A real TabView with SF Symbols — the same shell the app ships — so a
        // harness screenshot is representative rather than a segmented control
        // standing in for one.
        TabView(selection: $screen) {
            Tab("Today", systemImage: "house", value: 0) {
                NavigationStack { TodayHarness() }
            }
            Tab("Library", systemImage: "books.vertical", value: 3) {
                NavigationStack { DashboardView(auth: auth, api: api) }
            }
            Tab("Credits", systemImage: "bolt", value: 2) {
                CreditsSheet(api: api)
            }
            Tab("Profile", systemImage: "person.crop.circle", value: 1) {
                NavigationStack { SettingsView(auth: auth) }
            }
        }
        .tint(ACXColor.accent)
        .toolbarBackground(ACXColor.ground, for: .tabBar)
        .toolbarBackgroundVisibility(.visible, for: .tabBar)
    }
}

/// Today composed from the shipping block views with fixed data.
private struct TodayHarness: View {
    private let concepts = [
        DueConcept(id: "c1", name: "Write-ahead logging", document_id: "d1",
                   mastery_score: 0.31, mastery_percent: 31),
        DueConcept(id: "c2", name: "Two-phase commit", document_id: "d1",
                   mastery_score: 0.48, mastery_percent: 48),
        DueConcept(id: "c3", name: "Serializable snapshot isolation", document_id: "d1",
                   mastery_score: 0.62, mastery_percent: 62),
    ]
    private let streak = StreakSnapshot(days: 4, studiedToday: true, freezeArmed: false,
                                        freezesRemaining: 2, longest: 11)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                TodayHeader(date: Date(), creditsUsed: 2, creditsTotal: 5, onOpenCredits: {})
                DueCard(count: 12, isStarting: false, onStartReview: {}, onStudyAnyway: {})
                StreakRow(snapshot: streak, activeDays: [0, 1, 3], todayIndex: 3,
                          isDeviceLocalOnly: false)
                ContinueCard(
                    session: ResumableSession(
                        sessionId: "s1", documentId: "d1",
                        title: "Designing Data-Intensive Applications",
                        answered: 2, total: 5, difficulty: "medium",
                        startedAt: "2026-07-27T09:00:00Z"
                    ),
                    isResuming: false,
                    onResume: {}
                )
                WeakestConcepts(concepts: concepts, startingConceptId: nil,
                                creditsSpent: false, blocked: false, onStart: { _ in })
            }
            .padding(20)
        }
        .background(GroundBackground())
    }
}
#endif
