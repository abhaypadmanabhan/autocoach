import SwiftUI

/// The blocks of ``TodayView``, top to bottom (design PRD §5.5).
///
/// Every one of them is square, ink-bordered and flat. The hard offset shadow
/// appears exactly once on this screen — on the due card's primary CTA — and
/// nowhere else.

// MARK: - Card chrome

/// Zero-radius ink-bordered panel. The one card shape on this screen.
private struct CardChrome: ViewModifier {
    var padding: CGFloat = 18
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ACXColor.ground)
            .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
    }
}

extension View {
    fileprivate func todayCard(padding: CGFloat = 18) -> some View {
        modifier(CardChrome(padding: padding))
    }
}

// MARK: - Header

struct TodayHeader: View {
    let date: Date
    /// Credits live here as a compact inline indicator rather than as a block of
    /// their own. Quota is ambient status: it should be glanceable and take almost
    /// no room. The full story (reset countdown, XP, redeem) lives in Settings, so
    /// it is told once in the app instead of twice.
    var creditsUsed: Int?
    var creditsTotal: Int = 5
    var onOpenCredits: (() -> Void)?

    private var formatted: String {
        date.formatted(.dateTime.weekday(.wide).day().month(.wide))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                ScreenTitle("Today", subtitle: formatted)
                Spacer(minLength: 12)
                if let creditsUsed {
                    Button { onOpenCredits?() } label: {
                        CreditsInline(used: creditsUsed, total: creditsTotal)
                    }
                    .buttonStyle(.plain)
                }
            }
            Hairline()
        }
    }
}

// MARK: - Due card (the hero)

struct DueCard: View {
    let count: Int
    let isStarting: Bool
    let onStartReview: () -> Void
    let onStudyAnyway: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if count > 0 {
                dueBody
            } else {
                aheadBody
            }
        }
        .todayCard()
    }

    private var dueBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(count)")
                    .font(ACXFont.monoBold(56, relativeTo: .largeTitle))
                    .monospacedDigit()
                    .foregroundStyle(ACXColor.ink)
                    .accessibilityHidden(true)
                Text(count == 1 ? "Concept due" : "Concepts due")
                    .font(ACXFont.body(15)).foregroundStyle(ACXColor.muted)
                    .accessibilityHidden(true)
            }
            .accessibilityElement()
            .accessibilityLabel(count == 1 ? "1 concept due" : "\(count) concepts due")

            Button(action: onStartReview) {
                Text(isStarting ? "Starting…" : "Start review")
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(isStarting)
            // The hard shadow renders 4pt beyond the button; reserve the room so
            // the card border never clips it.
            .padding(.trailing, 4)
            .padding(.bottom, 4)

            Text("Review sessions don’t use credits")
                .font(ACXFont.body(15))
                .kerning(0.6)
                .foregroundStyle(ACXColor.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Zero due is a **success** state, never an empty one. No numeral, no
    /// primary CTA — there is nothing to push the user toward.
    private var aheadBody: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Nothing due")
            Text("Nothing due. You're ahead.")
                .font(ACXFont.display(24))
                .foregroundStyle(ACXColor.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text("Spaced review brings concepts back when they start to fade. Come back tomorrow, or pick a document and study anyway.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
                .fixedSize(horizontal: false, vertical: true)
            Button("Study anyway", action: onStudyAnyway)
                .buttonStyle(GhostButtonStyle())
        }
    }
}

// MARK: - Credits

struct CreditsRow: View {
    let used: Int
    let total: Int
    let isExhausted: Bool
    let resetsIn: DateComponents?
    let onOpenLibrary: () -> Void

    private var remaining: Int { max(0, total - used) }

    private var resetsCopy: String {
        guard let resetsIn, let hours = resetsIn.hour, let minutes = resetsIn.minute else {
            return "Resets at midnight UTC"
        }
        return "RESETS IN \(hours)H \(minutes)M"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Text("Credits")
                    .font(ACXFont.body(15)).foregroundStyle(ACXColor.muted)
                CreditPips(used: used, total: total)
                Spacer(minLength: 8)
                Text("\(remaining) / \(total)")
                    .font(ACXFont.monoBold(13))
                    .monospacedDigit()
                    .foregroundStyle(ACXColor.ink)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Quiz credits")
            .accessibilityValue("\(remaining) of \(total) remaining")

            if isExhausted {
                // A spent quota is anticipation, not an error (design PRD
                // principle 3). No red, no alert — the free path stays open.
                VStack(alignment: .leading, spacing: 6) {
                    Text(resetsCopy)
                        .font(ACXFont.monoBold(13))
                        .foregroundStyle(ACXColor.ink)
                    Text("Review sessions above are still free.")
                        .font(ACXFont.body(15))
                        .foregroundStyle(ACXColor.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.leading, 12)
                .overlay(alignment: .leading) {
                    Rectangle().fill(ACXColor.accent).frame(width: 2)
                }
            }

            Text("Counted on this device")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
        }
        .todayCard()
        .contentShape(Rectangle())
        .onTapGesture(perform: onOpenLibrary)
    }
}

// MARK: - Streak

struct StreakRow: View {
    let snapshot: StreakSnapshot
    let activeDays: Set<Int>
    let todayIndex: Int?
    /// Kept in the signature for callers, but Today no longer prints the
    /// "stored on this device" caveat — Settings states it once, where a user
    /// goes to understand the feature. Repeating a disclaimer on the home screen
    /// every single day is noise, not honesty.
    var isDeviceLocalOnly: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(snapshot.days)")
                    .font(ACXFont.monoBold(20))
                    .monospacedDigit()
                    .foregroundStyle(ACXColor.ink)
                Text(snapshot.days == 1 ? "day streak" : "day streak")
                    .font(ACXFont.body(17))
                    .foregroundStyle(ACXColor.ink)
                Spacer(minLength: 8)
                if snapshot.freezesRemaining > 0 {
                    Text("\(snapshot.freezesRemaining) freeze\(snapshot.freezesRemaining == 1 ? "" : "s")")
                        .font(ACXFont.body(15))
                        .foregroundStyle(ACXColor.muted)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Streak")
            .accessibilityValue("\(snapshot.days) days, \(snapshot.freezesRemaining) freezes left")

            WeekStrip(activeDays: activeDays, todayIndex: todayIndex)

            if snapshot.freezeArmed {
                Text("A freeze will cover yesterday.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
            }
        }
    }
}

// MARK: - Continue

struct ContinueCard: View {
    let session: ResumableSession
    let isResuming: Bool
    let onResume: () -> Void

    var body: some View {
        Button(action: onResume) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    SectionLabel("Continue")
                    Spacer(minLength: 8)
                    Text("Q\(session.answered + 1) / \(session.total)")
                        .font(ACXFont.monoBold(13))
                        .monospacedDigit()
                        .foregroundStyle(ACXColor.ink)
                }
                Text(session.title)
                    .font(ACXFont.body(16))
                    .foregroundStyle(ACXColor.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                ProgressHairline(value: Double(session.answered) / Double(max(session.total, 1)))
                Text(isResuming ? "Resuming…" : "Tap to resume")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
            }
            .todayCard()
        }
        .buttonStyle(.plain)
        .disabled(isResuming)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Resume \(session.title)")
        .accessibilityValue("Question \(session.answered + 1) of \(session.total)")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Weakest concepts

struct WeakestConcepts: View {
    let concepts: [DueConcept]
    let startingConceptId: String?
    let creditsSpent: Bool
    let blocked: Bool
    let onStart: (DueConcept) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel("Weakest concepts")
                Spacer(minLength: 8)
                Text("Uses 1 credit")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
            }
            .padding(.bottom, 10)
            Hairline()

            ForEach(concepts) { concept in
                conceptRow(concept)
                Hairline()
            }

            if creditsSpent {
                Text(blocked
                     ? "No credits left today — the review above is still free."
                     : "You may be out of credits today — the review above is still free.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 12)
            }
        }
    }

    private func conceptRow(_ concept: DueConcept) -> some View {
        Button {
            onStart(concept)
        } label: {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(concept.name)
                        .font(ACXFont.body(16))
                        .foregroundStyle(blocked ? ACXColor.muted : ACXColor.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    MasteryBar(percent: concept.mastery_percent, label: "Mastery")
                }
                Text(startingConceptId == concept.id ? "…" : "→")
                    .font(ACXFont.monoBold(15))
                    .foregroundStyle(ACXColor.muted)
            }
            // 44pt minimum hit target.
            .frame(minHeight: 44)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(blocked || startingConceptId != nil)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Practise \(concept.name)")
        .accessibilityValue("Mastery \(concept.mastery_percent) percent")
        .accessibilityHint(blocked ? "No credits left today" : "Starts a focused quiz and uses one credit")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Non-content states

/// Loading is a **designed** panel, not a spinner: the blocks that are coming
/// are outlined so the screen does not jump when they land.
struct TodayLoadingPanel: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Loading today")
            ProgressHairline()
            Text("Checking what's due for review.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
        }
        .todayCard()
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.updatesFrequently)
    }
}

struct TodayErrorPanel: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                StatusMark(.failed)
                Text("COULDN'T load today")
                    .font(ACXFont.bodySemibold(15))
                    .kerning(1.2)
                    .foregroundStyle(ACXColor.error)
            }
            Text(message)
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.ink)
                .fixedSize(horizontal: false, vertical: true)
            Button("Try again", action: onRetry)
                .buttonStyle(GhostButtonStyle())
        }
        .todayCard()
        .accessibilityElement(children: .contain)
    }
}

struct TodayOfflinePanel: View {
    let snapshot: TodaySnapshot?
    let onRetry: () -> Void

    private var savedCopy: String? {
        guard let snapshot else { return nil }
        return "LAST UPDATED \(snapshot.savedAt.formatted(.relative(presentation: .named)))".uppercased()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                StatusMark(.pending)
                Text("Offline")
                    .font(ACXFont.bodySemibold(15))
                    .kerning(1.2)
                    .foregroundStyle(ACXColor.ink)
            }
            if let snapshot {
                Text("Showing what we last knew: \(snapshot.dueCount) \(snapshot.dueCount == 1 ? "concept" : "concepts") due. Starting a session needs a connection.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                    .fixedSize(horizontal: false, vertical: true)
                if let savedCopy {
                    Text(savedCopy)
                        .font(ACXFont.body(15))
                        .foregroundStyle(ACXColor.muted)
                }
            } else {
                Text("No connection, and nothing cached yet. Reconnect and we'll pull today's queue.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button("Try again", action: onRetry)
                .buttonStyle(GhostButtonStyle())
        }
        .todayCard()
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Previews
//
// One per designed state, so the five-state discipline is inspectable in Xcode
// rather than only in prose.

private let previewConcepts = [
    DueConcept(id: "c1", name: "Consistent hashing", document_id: "d1", mastery_score: 0.18, mastery_percent: 18),
    DueConcept(id: "c2", name: "Write-ahead logging", document_id: "d1", mastery_score: 0.41, mastery_percent: 41),
    DueConcept(id: "c3", name: "Serializable snapshot isolation", document_id: "d1", mastery_score: 0.62, mastery_percent: 62),
]

private let previewStreak = StreakSnapshot(
    days: 4, studiedToday: true, freezeArmed: false, freezesRemaining: 2, longest: 11
)

#Preview("Today — due") {
    ScrollView {
        VStack(alignment: .leading, spacing: 20) {
            TodayHeader(date: Date())
            DueCard(count: 12, isStarting: false, onStartReview: {}, onStudyAnyway: {})
            CreditsRow(used: 2, total: 5, isExhausted: false, resetsIn: nil, onOpenLibrary: {})
            StreakRow(snapshot: previewStreak, activeDays: [0, 1, 3], todayIndex: 3, isDeviceLocalOnly: true)
            ContinueCard(
                session: ResumableSession(
                    sessionId: "s1", documentId: "d1", title: "Designing Data-Intensive Applications",
                    answered: 2, total: 5, difficulty: "medium", startedAt: "2026-07-27T09:00:00Z"
                ),
                isResuming: false,
                onResume: {}
            )
            WeakestConcepts(
                concepts: previewConcepts, startingConceptId: nil,
                creditsSpent: false, blocked: false, onStart: { _ in }
            )
        }
        .padding(20)
    }
    .background(GroundBackground())
}

#Preview("Today — zero due + quota spent") {
    ScrollView {
        VStack(alignment: .leading, spacing: 20) {
            TodayHeader(date: Date())
            DueCard(count: 0, isStarting: false, onStartReview: {}, onStudyAnyway: {})
            CreditsRow(
                used: 5, total: 5, isExhausted: true,
                resetsIn: DateComponents(hour: 13, minute: 52), onOpenLibrary: {}
            )
            StreakRow(
                snapshot: StreakSnapshot(days: 3, studiedToday: false, freezeArmed: true, freezesRemaining: 1, longest: 11),
                activeDays: [0, 2], todayIndex: 4, isDeviceLocalOnly: true
            )
            WeakestConcepts(
                concepts: previewConcepts, startingConceptId: nil,
                creditsSpent: true, blocked: true, onStart: { _ in }
            )
        }
        .padding(20)
    }
    .background(GroundBackground())
}

#Preview("Today — loading / error / offline") {
    ScrollView {
        VStack(alignment: .leading, spacing: 20) {
            TodayLoadingPanel()
            TodayErrorPanel(message: "The server had a problem. Please try again.", onRetry: {})
            TodayOfflinePanel(
                snapshot: TodaySnapshot(dueCount: 7, dueConcepts: previewConcepts, documentCount: 3, savedAt: Date()),
                onRetry: {}
            )
            TodayOfflinePanel(snapshot: nil, onRetry: {})
        }
        .padding(20)
    }
    .background(GroundBackground())
}
