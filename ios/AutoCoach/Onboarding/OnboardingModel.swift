import Foundation
import Observation

/// Onboarding state, persistence and backend mapping (design PRD §5.4).
///
/// The backend accepts **exactly four** fields — `learning_topics` (a JSONB
/// *dict*, merged key-by-key on upsert), `goal` (≤500), `study_frequency`
/// (≤100), `experience_level` (≤100). Every answer below maps onto one of them.
/// Nothing here invents a field the server cannot persist.

// MARK: - Answer vocabularies

/// Step 2 — `experience_level`.
enum ExperienceLevel: String, CaseIterable, Codable, Sendable {
    case newToThis = "new_to_this"
    case someBackground = "some_background"
    case revising = "revising"

    var title: String {
        switch self {
        case .newToThis:      return "New to this"
        case .someBackground: return "Some background"
        case .revising:       return "Revising"
        }
    }

    var blurb: String {
        switch self {
        case .newToThis:      return "Start from the fundamentals."
        case .someBackground: return "Fill the gaps, skip the basics."
        case .revising:       return "Drill what you already covered."
        }
    }
}

/// Step 3 — `goal`.
enum GoalKind: String, CaseIterable, Codable, Sendable {
    case exam, course, work, curiosity

    var title: String {
        switch self {
        case .exam:      return "An exam"
        case .course:    return "A course"
        case .work:      return "Work"
        case .curiosity: return "Curiosity"
        }
    }

    var blurb: String {
        switch self {
        case .exam:      return "There's a date and a syllabus."
        case .course:    return "Keeping pace with the material."
        case .work:      return "Something the job needs."
        case .curiosity: return "No deadline, just interest."
        }
    }

    /// Only an exam or a course has a meaningful target date.
    var acceptsDate: Bool { self == .exam || self == .course }
}

/// Step 4 — the time half of `study_frequency`.
enum StudyTime: String, CaseIterable, Codable, Sendable {
    case morning, midday, evening

    var title: String {
        switch self {
        case .morning: return "Morning"
        case .midday:  return "Midday"
        case .evening: return "Evening"
        }
    }

    /// Local hour/minute the reminder fires at.
    var hour: Int {
        switch self {
        case .morning: return 8
        case .midday:  return 12
        case .evening: return 19
        }
    }

    var minute: Int { self == .midday ? 30 : 30 }

    /// `08:30` — mono, 24h, locale-independent so it matches the stored value.
    var clockLabel: String { String(format: "%02d:%02d", hour, minute) }
}

// MARK: - Draft

/// Everything the user has answered so far, plus where they are. Persisted after
/// every mutation so killing the app mid-flow resumes on the same step.
struct OnboardingDraft: Codable, Equatable, Sendable {
    var stepIndex: Int = 0
    var topics: [String] = []
    var customTopic: String = ""
    var experience: ExperienceLevel?
    var goal: GoalKind?
    var goalDate: Date?
    var studyTime: StudyTime?
    var daysPerWeek: Int = 5

    static let maxTopics = 3

    /// Topics as they go to the server: the chips plus the trimmed free-text one.
    var allTopics: [String] {
        let custom = customTopic.trimmingCharacters(in: .whitespacesAndNewlines)
        return custom.isEmpty ? topics : topics + [custom]
    }

    var topicCount: Int { allTopics.count }
    var canAddTopic: Bool { topicCount < Self.maxTopics }
}

// MARK: - Payload mapping

enum OnboardingPayload {
    /// ISO-8601 *date* only — the server stores `goal` as free text, so the
    /// format has to be stable on our side or it is unreadable later.
    static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// `learning_topics` — a dict, never an array. The server merges the keys it
    /// receives into the existing row and adds `experience_level` of its own, so
    /// sending `{"topics": [...]}` is additive rather than destructive.
    static func learningTopics(from draft: OnboardingDraft) -> [String: JSONValue]? {
        let topics = draft.allTopics
        guard !topics.isEmpty else { return nil }
        return ["topics": .array(topics.map { .string($0) })]
    }

    /// `goal` ≤ 500 chars. `"exam"` or `"exam by 2026-09-01"`.
    static func goal(from draft: OnboardingDraft) -> String? {
        guard let goal = draft.goal else { return nil }
        guard goal.acceptsDate, let date = draft.goalDate else { return goal.rawValue }
        return String("\(goal.rawValue) by \(dateFormatter.string(from: date))".prefix(500))
    }

    /// `study_frequency` ≤ 100 chars. `"morning 5x_week 08:30"` — time of day,
    /// cadence and the exact reminder clock, so the value round-trips into
    /// Settings later without a second source of truth.
    static func studyFrequency(from draft: OnboardingDraft) -> String? {
        guard let time = draft.studyTime else { return nil }
        return String("\(time.rawValue) \(draft.daysPerWeek)x_week \(time.clockLabel)".prefix(100))
    }

    static func request(from draft: OnboardingDraft) -> OnboardingCreateRequest {
        OnboardingCreateRequest(
            learning_topics: learningTopics(from: draft),
            goal: goal(from: draft),
            study_frequency: studyFrequency(from: draft),
            experience_level: draft.experience?.rawValue
        )
    }
}

// MARK: - Store

/// Drives the flow. Owns the draft, its local persistence and the single POST.
@MainActor
@Observable
final class OnboardingStore {
    /// Pages, in order. The prime is deliberately *after* the step-4 choice —
    /// the system permission dialog must never be the first thing a user sees.
    enum Page: Int, CaseIterable {
        case topics, experience, goal, cadence, notificationPrime
    }

    private(set) var draft: OnboardingDraft
    private(set) var isSubmitting = false
    private(set) var submitError: String?
    /// Set once the user has resolved the permission prime, so the button stops
    /// offering something the system will silently no-op on.
    private(set) var notificationOutcome: NotificationOutcome?

    enum NotificationOutcome: Equatable, Sendable {
        case granted(count: Int)
        case denied
        case skipped
    }

    private let api: APIClient
    private let defaults: UserDefaults
    private static let draftKey = "onboarding.draft.v1"

    init(api: APIClient, defaults: UserDefaults = .standard) {
        self.api = api
        self.defaults = defaults
        if let data = defaults.data(forKey: Self.draftKey),
           let restored = try? JSONDecoder().decode(OnboardingDraft.self, from: data) {
            self.draft = restored
        } else {
            self.draft = OnboardingDraft()
        }
    }

    var page: Page { Page(rawValue: draft.stepIndex) ?? .topics }

    /// 0…1 for the pinned progress bar. The prime reads as complete.
    var progress: Double {
        let questionCount = Double(Page.allCases.count - 1)   // the prime is not a question
        return min(1, Double(draft.stepIndex + 1) / questionCount)
    }

    var canGoBack: Bool { draft.stepIndex > 0 }

    /// Whether Continue is enabled — a selection must exist on the current step.
    var hasSelection: Bool {
        switch page {
        case .topics:            return draft.topicCount > 0
        case .experience:        return draft.experience != nil
        case .goal:              return draft.goal != nil
        case .cadence:           return draft.studyTime != nil
        case .notificationPrime: return true
        }
    }

    // MARK: Mutation

    func toggleTopic(_ topic: String) {
        if let index = draft.topics.firstIndex(of: topic) {
            draft.topics.remove(at: index)
        } else if draft.canAddTopic {
            draft.topics.append(topic)
        }
        persist()
    }

    func setCustomTopic(_ text: String) {
        // The cap counts the free-text entry, so refuse it once three chips are
        // already selected rather than silently over-filling.
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty && draft.topics.count >= OnboardingDraft.maxTopics {
            draft.customTopic = ""
        } else {
            draft.customTopic = text
        }
        persist()
    }

    func select(_ level: ExperienceLevel) { draft.experience = level; persist() }

    func select(_ goal: GoalKind) {
        draft.goal = goal
        if !goal.acceptsDate { draft.goalDate = nil }
        persist()
    }

    func setGoalDate(_ date: Date?) { draft.goalDate = date; persist() }
    func select(_ time: StudyTime) { draft.studyTime = time; persist() }

    func setDaysPerWeek(_ days: Int) {
        draft.daysPerWeek = min(7, max(1, days))
        persist()
    }

    // MARK: Navigation

    func back() {
        guard draft.stepIndex > 0 else { return }
        draft.stepIndex -= 1
        persist()
    }

    /// Advance one page. Returns `true` when the flow has run off the end and
    /// the caller should submit.
    func advance() -> Bool {
        // Skipping the cadence question means there is no time to remind at, so
        // priming for a permission we could not act on would be a dark pattern.
        if page == .cadence && draft.studyTime == nil { return true }
        guard draft.stepIndex + 1 < Page.allCases.count else { return true }
        draft.stepIndex += 1
        persist()
        return false
    }

    // MARK: Submit

    /// POSTs **once** with all four fields. Called on the last page only.
    ///
    /// `has_completed` is true for any existing row, so a successful POST is what
    /// makes the flow stop re-showing — the gate in `RootView` reads it back on
    /// the next launch.
    func submit() async -> Bool {
        guard !isSubmitting else { return false }
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }

        let request = OnboardingPayload.request(from: draft)
        do {
            let _: OnboardingResponse = try await api.post("/onboarding", body: request)
            clearDraft()
            return true
        } catch let error as APIError {
            submitError = error.errorDescription ?? "Could not save your answers."
            return false
        } catch {
            submitError = error.localizedDescription
            return false
        }
    }

    /// Skip the current question: discard whatever was selected on it, then
    /// advance. Every field is optional server-side, so skipping all four still
    /// produces a valid POST — the row is created and the flow never re-shows.
    ///
    /// Returns `true` when the caller should submit.
    func skipCurrent() -> Bool {
        switch page {
        case .topics:
            draft.topics = []
            draft.customTopic = ""
        case .experience:
            draft.experience = nil
        case .goal:
            draft.goal = nil
            draft.goalDate = nil
        case .cadence:
            // No time means no reminder to prime for, so `advance()` also skips
            // straight past the permission screen.
            draft.studyTime = nil
        case .notificationPrime:
            notificationOutcome = .skipped
        }
        persist()
        return advance()
    }

    func dismissError() { submitError = nil }

    // MARK: Notifications

    func recordNotificationOutcome(_ outcome: NotificationOutcome) {
        notificationOutcome = outcome
    }

    // MARK: Persistence

    private func persist() {
        guard let data = try? JSONEncoder().encode(draft) else { return }
        defaults.set(data, forKey: Self.draftKey)
    }

    private func clearDraft() {
        defaults.removeObject(forKey: Self.draftKey)
    }
}
