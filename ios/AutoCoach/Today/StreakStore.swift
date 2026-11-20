import Foundation
import Observation

/// Calendar-day arithmetic for the local streak.
///
/// Days are stored as `"yyyy-MM-dd"` **strings written in the user's calendar at
/// the moment the event happened**, never as absolute timestamps that get
/// re-derived later. That is the whole trick for surviving a timezone change: a
/// flight to Tokyo cannot retroactively move a day that is already a string, it
/// only changes what "today" resolves to — which is the correct behaviour, since
/// a user in Tokyo studies on Tokyo's today.
///
/// Diffs are taken between **noon** on each day rather than midnight. Midnight
/// does not exist on DST spring-forward dates in several timezones, so
/// `calendar.date(from:)` at hour 0 can shift or fail there; noon always
/// resolves, and the day component of a noon-to-noon difference is exact.
enum StudyDay {
    /// Autoupdating so a timezone change is picked up without an app relaunch.
    static var calendar: Calendar { .autoupdatingCurrent }

    /// The same calendar forced to Monday-first, because ``WeekStrip`` is
    /// hardcoded `M T W T F S S` and must not drift with the device locale.
    static var mondayFirstCalendar: Calendar {
        var c = Calendar.autoupdatingCurrent
        c.firstWeekday = 2
        return c
    }

    static func key(_ date: Date, calendar: Calendar = StudyDay.calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Noon on `key`, in `calendar`'s current timezone.
    static func noon(_ key: String, calendar: Calendar = StudyDay.calendar) -> Date? {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var c = DateComponents()
        c.year = parts[0]
        c.month = parts[1]
        c.day = parts[2]
        c.hour = 12
        return calendar.date(from: c)
    }

    /// Whole days from `from` to `to`. Negative if `to` is earlier.
    static func gap(from: String, to: String, calendar: Calendar = StudyDay.calendar) -> Int? {
        guard let a = noon(from, calendar: calendar), let b = noon(to, calendar: calendar) else { return nil }
        return calendar.dateComponents([.day], from: a, to: b).day
    }
}

/// Streak tuning constants.
///
/// Deliberately **not** statics on ``StreakStore``: that type is `@MainActor`, so
/// its statics are main-actor-isolated and `StreakState`'s nonisolated default
/// values could not reference them under Swift 6 strict concurrency.
enum StreakRules {
    static let startingFreezes = 2
    static let maxFreezes = 2
    /// Study days required to earn one freeze back.
    static let studyDaysPerFreeze = 5
    static let historyLimit = 90
}

/// Persisted streak state. Codable and stable on disk so the Phase 4 widget can
/// decode the same file.
struct StreakState: Codable, Equatable, Sendable {
    var currentStreak: Int = 0
    var longestStreak: Int = 0
    /// Last day the user actually started a session, as a ``StudyDay`` key.
    var lastStudyDay: String?
    /// Recent study days, newest first, capped at ``StreakStore.historyLimit``.
    var studyDays: [String] = []
    /// Days a freeze covered — kept so the week strip does not claim the user
    /// studied on a day they did not.
    var frozenDays: [String] = []
    var freezesRemaining: Int = StreakRules.startingFreezes
    /// Counts toward the next earned freeze.
    var studyDaysSinceFreezeEarned: Int = 0
}

/// How the streak reads *right now*, without mutating anything.
///
/// The displayed streak has to decay on its own — a user who opens the app after
/// missing three days must not see a live 12-day streak just because nothing has
/// written to the store since.
struct StreakSnapshot: Equatable, Sendable {
    let days: Int
    let studiedToday: Bool
    /// Yesterday was missed and a freeze is standing by to cover it.
    let freezeArmed: Bool
    let freezesRemaining: Int
    let longest: Int
}

/// Local-only study streak with a freeze, persisted to the App Group container.
///
/// Local-only is a settled decision, not an oversight: no endpoint exposes
/// per-day activity (design PRD §9.2 / decision 12.2), and deriving it from
/// sessions would be a guess. The UI says so on screen.
@MainActor
@Observable
final class StreakStore {
    static let fileName = "streak.json"

    private(set) var state: StreakState
    private let store: AppGroupStore

    /// `false` when the App Group container was unavailable and we fell back to
    /// local Application Support — surfaced in the UI rather than hidden.
    var isSharedWithWidget: Bool { store.isShared }

    init(store: AppGroupStore = .shared) {
        self.store = store
        self.state = store.read(StreakState.self, from: Self.fileName) ?? StreakState()
    }

    // MARK: - Reading

    func snapshot(asOf now: Date = Date()) -> StreakSnapshot {
        let today = StudyDay.key(now)
        guard let last = state.lastStudyDay, let gap = StudyDay.gap(from: last, to: today) else {
            return StreakSnapshot(
                days: 0, studiedToday: false, freezeArmed: false,
                freezesRemaining: state.freezesRemaining, longest: state.longestStreak
            )
        }

        let live: Int
        let armed: Bool
        switch gap {
        case ..<0:
            // Travelling west across the date line can make "today" resolve
            // earlier than the recorded last study day. Do not punish that.
            live = state.currentStreak
            armed = false
        case 0, 1:
            live = state.currentStreak
            armed = false
        case 2 where state.freezesRemaining > 0:
            live = state.currentStreak
            armed = true
        default:
            live = 0
            armed = false
        }

        return StreakSnapshot(
            days: live,
            studiedToday: gap == 0,
            freezeArmed: armed,
            freezesRemaining: state.freezesRemaining,
            longest: state.longestStreak
        )
    }

    /// Monday-first indices (0 == Monday) of the current week the user studied.
    func activeWeekdayIndices(asOf now: Date = Date()) -> Set<Int> {
        let studied = Set(state.studyDays)
        return Set(weekKeys(asOf: now).enumerated().compactMap { studied.contains($1) ? $0 : nil })
    }

    /// Index of today in the Monday-first week, or `nil` if it cannot be resolved.
    func todayWeekdayIndex(asOf now: Date = Date()) -> Int? {
        let today = StudyDay.key(now)
        return weekKeys(asOf: now).firstIndex(of: today)
    }

    private func weekKeys(asOf now: Date) -> [String] {
        let calendar = StudyDay.mondayFirstCalendar
        guard let monday = calendar.dateInterval(of: .weekOfYear, for: now)?.start else { return [] }
        return (0..<7).compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: monday).map { StudyDay.key($0, calendar: calendar) }
        }
    }

    // MARK: - Writing

    /// Record that the user started studying. Idempotent within a day.
    ///
    /// Recording on session *start* rather than on completion is deliberate: the
    /// quiz surface belongs to another lane and this screen only observes the
    /// start. It is the honest reading of "opened the app and did the work".
    func recordStudy(at now: Date = Date()) {
        let today = StudyDay.key(now)
        let gap = state.lastStudyDay.flatMap { StudyDay.gap(from: $0, to: today) }

        switch gap {
        case .some(let g) where g <= 0:
            // Already counted today (or a date-line rollback) — nothing to do.
            return
        case .some(1):
            state.currentStreak += 1
        case .some(2) where state.freezesRemaining > 0:
            // Yesterday was missed but a freeze covers it, so the chain holds.
            state.freezesRemaining -= 1
            if let last = state.lastStudyDay,
               let missed = StudyDay.noon(last).flatMap({ StudyDay.calendar.date(byAdding: .day, value: 1, to: $0) }) {
                let missedKey = StudyDay.key(missed)
                if !state.frozenDays.contains(missedKey) { state.frozenDays.insert(missedKey, at: 0) }
            }
            state.currentStreak += 1
        default:
            state.currentStreak = 1
        }

        state.lastStudyDay = today
        if !state.studyDays.contains(today) { state.studyDays.insert(today, at: 0) }
        state.studyDays = Array(state.studyDays.prefix(StreakRules.historyLimit))
        state.frozenDays = Array(state.frozenDays.prefix(StreakRules.historyLimit))
        state.longestStreak = max(state.longestStreak, state.currentStreak)

        state.studyDaysSinceFreezeEarned += 1
        if state.studyDaysSinceFreezeEarned >= StreakRules.studyDaysPerFreeze {
            state.studyDaysSinceFreezeEarned = 0
            state.freezesRemaining = min(StreakRules.maxFreezes, state.freezesRemaining + 1)
        }

        persist()
    }

    private func persist() {
        store.write(state, to: Self.fileName)
    }
}
