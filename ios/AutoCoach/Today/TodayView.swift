import Combine
import SwiftUI

/// `01 / TODAY` — the home screen (design PRD §5.5).
///
/// Answers "what should I study right now" from data the backend already
/// computes: `GET /review/today` is the hero, and one tap starts a **review**
/// session, which `backend/app/api/routes/sessions.py` runs without consuming a
/// daily credit. That fact is on screen because it is the best thing this app
/// can tell a returning user.
///
/// Mounted by the app shell as `TodayView(auth:api:onOpenLibrary:)`.
struct TodayView: View {
    let auth: AuthStore
    let api: APIClient
    /// Switches the shell to the Library tab (the "study anyway" route).
    let onOpenLibrary: () -> Void
    /// Opens the credits sheet, which Settings owns.
    var onOpenCredits: () -> Void = {}

    /// Built lazily so the two disk-backed stores are read once per screen, not
    /// on every re-evaluation of the parent's body.
    @State private var model: TodayModel?

    var body: some View {
        Group {
            if let model {
                TodayContent(model: model, onOpenLibrary: onOpenLibrary, onOpenCredits: onOpenCredits)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // No credits yet — the model has not been built.
                        TodayHeader(date: Date())
                        TodayLoadingPanel()
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                }
                .scrollContentBackground(.hidden)
                .background(GroundBackground())
            }
        }
        .task {
            if model == nil { model = TodayModel(api: api) }
            await model?.load()
        }
    }
}

/// The screen proper, split out so the model can be `@Bindable`.
private struct TodayContent: View {
    @Bindable var model: TodayModel
    let onOpenLibrary: () -> Void
    /// Opens the credits sheet, which Settings owns.
    var onOpenCredits: () -> Void = {}

    /// Re-read whenever the day or the timezone changes, so the header date, the
    /// week strip and the streak decay stay correct without a relaunch.
    @State private var now = Date()

    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                TodayHeader(
                    date: now,
                    creditsUsed: model.credits.used,
                    creditsTotal: model.credits.total,
                    onOpenCredits: onOpenCredits
                )

                switch model.phase {
                case .loading:
                    TodayLoadingPanel()
                case .failed(let message):
                    TodayErrorPanel(message: message) { Task { await model.load() } }
                    streakBlock
                case .offline:
                    TodayOfflinePanel(snapshot: model.snapshot) { Task { await model.load() } }
                    streakBlock
                case .ready:
                    readyBlocks
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 40)
        }
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
        .refreshable { await model.load() }
        .acxToast($model.toast)
        .fullScreenCover(isPresented: $model.showQuiz) {
            if let engine = model.presentedEngine {
                QuizSessionView(
                    engine: engine,
                    api: model.api,
                    documentTitle: model.presentedTitle,
                    onClose: { model.quizDismissed() }
                )
            }
        }
        .onChange(of: model.showQuiz) { _, presented in
            if !presented {
                model.quizDismissed()
                Task { await model.load() }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            refreshClock()
            Task { await model.load() }
        }
        // Fires exactly on a calendar day rollover — including one caused by
        // moving timezone — which is the moment the streak and the week strip
        // stop being true.
        .onReceive(NotificationCenter.default.publisher(for: .NSCalendarDayChanged)) { _ in
            refreshClock()
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSSystemTimeZoneDidChange)) { _ in
            refreshClock()
        }
    }

    private func refreshClock() {
        now = Date()
        model.credits.rollOverIfNeeded(now: now)
    }

    @ViewBuilder
    private var readyBlocks: some View {
        if model.hasNoDocuments {
            EmptyState(
                kicker: "Nothing to study yet",
                message: "Add a document and AutoCoach pulls the concepts out of it, then brings them back for review as they fade.",
                actionLabel: "Open library",
                action: onOpenLibrary,
                showsCrosshair: true
            )
            streakBlock
        } else {
            DueCard(
                count: model.dueCount,
                isStarting: model.starting == .review,
                onStartReview: { Task { await model.startReview() } },
                onStudyAnyway: onOpenLibrary
            )

            streakBlock

            if let session = model.resumable {
                ContinueCard(
                    session: session,
                    isResuming: model.starting == .resume,
                    onResume: { Task { await model.resume() } }
                )
            }

            if !model.weakestConcepts.isEmpty {
                WeakestConcepts(
                    concepts: model.weakestConcepts,
                    startingConceptId: startingConceptId,
                    creditsSpent: model.credits.isExhausted,
                    // Only the server's own 429 disables the row. A device-local
                    // count of zero may simply be wrong — credits spent on the
                    // web or another device are invisible here — and refusing a
                    // legitimate tap on a guess is worse than a 429.
                    blocked: model.quotaBlocked || model.credits.ledger.serverExhausted,
                    onStart: { concept in Task { await model.startFocused(on: concept) } }
                )
            }
        }
    }

    private var streakBlock: some View {
        StreakRow(
            snapshot: model.streak.snapshot(asOf: now),
            activeDays: model.streak.activeWeekdayIndices(asOf: now),
            todayIndex: model.streak.todayWeekdayIndex(asOf: now),
            isDeviceLocalOnly: !model.streak.isSharedWithWidget
        )
    }

    private var startingConceptId: String? {
        if case .concept(let id) = model.starting { return id }
        return nil
    }
}
