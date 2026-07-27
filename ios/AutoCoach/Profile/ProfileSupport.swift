import Foundation
import Supabase

/// Shared App Group suite (foundation-notes §2). Lane D writes the streak;
/// Profile only reads. Simulator builds strip the entitlement today, so we
/// fall back to `.standard` when the suite is unavailable — never crash.
enum ProfileAppGroup {
    static let identifier = "group.com.padzy.autocoach"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: identifier) ?? .standard
    }
}

// MARK: - Local streak (read-only, defensive)

/// Snapshot of the device-local streak store Lane D owns.
///
/// Keys are the contract Profile expects Lane D to write. Absent / malformed
/// values → zero state. Never throws.
struct LocalStreakSnapshot: Equatable, Sendable {
    var count: Int
    /// Monday-first day indices (0…6) studied this week.
    var activeDays: Set<Int>
    var freezeAvailable: Bool

    static let zero = LocalStreakSnapshot(count: 0, activeDays: [], freezeAvailable: false)

    /// Reads the streak from `StreakStore`, which is the single writer.
    ///
    /// This deliberately does **not** guess at UserDefaults keys. The Today lane
    /// persists a `StreakState` as JSON in the App Group container, not as discrete
    /// defaults keys, so a key-probing reader would have silently reported a zero
    /// streak forever — the failure would have looked like "the user hasn't studied"
    /// rather than like a bug.
    @MainActor
    static func read(store: StreakStore = StreakStore(), now: Date = Date()) -> LocalStreakSnapshot {
        let snap = store.snapshot(asOf: now)

        // Map this week's recorded study days onto Monday-first indices for WeekStrip.
        var calendar = Calendar.autoupdatingCurrent
        calendar.firstWeekday = 2   // Monday
        let active: Set<Int> = {
            guard let week = calendar.dateInterval(of: .weekOfYear, for: now) else { return [] }
            var out: Set<Int> = []
            for key in store.state.studyDays {
                guard let date = StudyDay.noon(key), week.contains(date) else { continue }
                // weekday is 1=Sun…7=Sat; shift so Monday == 0.
                let weekday = calendar.component(.weekday, from: date)
                out.insert((weekday + 5) % 7)
            }
            return out
        }()

        return LocalStreakSnapshot(
            count: snap.days,
            activeDays: active,
            freezeAvailable: snap.freezesRemaining > 0
        )
    }
}

// MARK: - XP + credits local cache

/// Client-side cache for XP / daily credits. There is no GET endpoint for either;
/// Profile refreshes from Supabase when RLS allows, CreditsSheet updates after redeem,
/// and a daily-quota 429 can seed `used` when presented.
enum ProfileBalanceCache {
    private static let xpKey = "autocoach.xp.total"
    private static let usedKey = "autocoach.credits.used"
    private static let extraKey = "autocoach.credits.extra"
    private static let dayKey = "autocoach.credits.dayUTC"

    static var totalXP: Int {
        get { ProfileAppGroup.defaults.integer(forKey: xpKey) }
        set { ProfileAppGroup.defaults.set(max(0, newValue), forKey: xpKey) }
    }

    /// Quizzes consumed today (UTC). Cap display against base 5 + extras.
    static var quizzesUsed: Int {
        get {
            rollDayIfNeeded()
            return ProfileAppGroup.defaults.integer(forKey: usedKey)
        }
        set {
            rollDayIfNeeded()
            ProfileAppGroup.defaults.set(max(0, newValue), forKey: usedKey)
        }
    }

    static var extraQuizzes: Int {
        get {
            rollDayIfNeeded()
            return ProfileAppGroup.defaults.integer(forKey: extraKey)
        }
        set {
            rollDayIfNeeded()
            ProfileAppGroup.defaults.set(max(0, newValue), forKey: extraKey)
        }
    }

    static var dailyAllowance: Int { 5 + extraQuizzes }

    static func markQuotaExhausted(limit: Int) {
        rollDayIfNeeded()
        // `limit` from the 429 body is QUIZ_LIMIT + extra_quizzes.
        let extras = max(0, limit - 5)
        extraQuizzes = extras
        quizzesUsed = limit
    }

    static func noteRedeemedCredit(newXP: Int) {
        totalXP = newXP
        extraQuizzes += 1
    }

    private static func rollDayIfNeeded() {
        let today = utcDayString(Date())
        let stored = ProfileAppGroup.defaults.string(forKey: dayKey)
        if stored != today {
            ProfileAppGroup.defaults.set(today, forKey: dayKey)
            ProfileAppGroup.defaults.set(0, forKey: usedKey)
            ProfileAppGroup.defaults.set(0, forKey: extraKey)
        }
    }

    static func utcDayString(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(secondsFromGMT: 0)!
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }
}

// MARK: - Midnight-UTC reset countdown

enum CreditsResetCountdown {
    /// Seconds until next midnight UTC.
    static func secondsRemaining(from now: Date = Date()) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(secondsFromGMT: 0)!
        let startOfToday = cal.startOfDay(for: now)
        guard let next = cal.date(byAdding: .day, value: 1, to: startOfToday) else {
            return 0
        }
        return max(0, Int(next.timeIntervalSince(now)))
    }

    /// `RESETS IN 13h 52m` — mono-friendly, no seconds (PRD §5.11).
    static func label(from now: Date = Date()) -> String {
        let total = secondsRemaining(from: now)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        return "RESETS IN \(hours)h \(minutes)m"
    }
}

// MARK: - XP redeem

private struct EmptyJSONBody: Encodable {}

enum XPRedeemError: Error, Equatable, Sendable {
    case insufficient(have: Int, need: Int, message: String)
    case notFound(String)
    case conflict(String)
    case other(String)

    var message: String {
        switch self {
        case .insufficient(_, _, let m), .notFound(let m), .conflict(let m), .other(let m):
            return m
        }
    }
}

enum XPRedeemer {
    /// `POST /xp/redeem` with exactly one silent retry on 409.
    static func redeem(using api: APIClient) async -> Result<RedeemXPResponse, XPRedeemError> {
        do {
            return .success(try await once(api))
        } catch let err as APIError {
            if case .http(let status, _) = err, status == 409 {
                // Silent retry once, then surface.
                do {
                    return .success(try await once(api))
                } catch let retryErr as APIError {
                    return .failure(map(retryErr))
                } catch {
                    return .failure(.other(error.localizedDescription))
                }
            }
            return .failure(map(err))
        } catch {
            return .failure(.other(error.localizedDescription))
        }
    }

    private static func once(_ api: APIClient) async throws -> RedeemXPResponse {
        try await api.post("/xp/redeem", body: EmptyJSONBody())
    }

    private static func map(_ err: APIError) -> XPRedeemError {
        switch err {
        case .http(let status, let detail):
            if status == 400 {
                let have = parseHave(from: detail) ?? 0
                ProfileBalanceCache.totalXP = have
                return .insufficient(have: have, need: 100, message: detail)
            }
            if status == 404 {
                return .notFound(detail)
            }
            if status == 409 {
                return .conflict(detail)
            }
            return .other(detail)
        case .network(let m):
            return .other(m)
        default:
            return .other(err.localizedDescription)
        }
    }

    /// `Insufficient XP. You have <n>, but need 100.`
    private static func parseHave(from detail: String) -> Int? {
        guard let range = detail.range(of: #"You have (\d+)"#, options: .regularExpression) else {
            return nil
        }
        let snippet = detail[range]
        let digits = snippet.filter(\.isNumber)
        return Int(digits)
    }
}

// MARK: - Supabase balance refresh (best-effort)

enum ProfileBalanceRefresh {
    private struct UserXPRow: Decodable {
        let total_xp: Int
    }

    private struct DailyUsageRow: Decodable {
        let quizzes_used: Int?
        let extra_quizzes: Int?
    }

    /// Pulls `users.total_xp` + today's `user_daily_usage` when RLS permits.
    /// Failures are swallowed — cache stays as-is.
    static func refresh(supabase: SupabaseClient) async {
        let userId: String
        do {
            userId = try await supabase.auth.session.user.id.uuidString.lowercased()
        } catch {
            return
        }

        do {
            let response: PostgrestResponse<[UserXPRow]> = try await supabase
                .from("users")
                .select("total_xp")
                .eq("id", value: userId)
                .limit(1)
                .execute()
            if let xp = response.value.first?.total_xp {
                ProfileBalanceCache.totalXP = xp
            }
        } catch {
            // RLS / missing table — keep cache.
        }

        do {
            let today = ProfileBalanceCache.utcDayString(Date())
            let response: PostgrestResponse<[DailyUsageRow]> = try await supabase
                .from("user_daily_usage")
                .select("quizzes_used, extra_quizzes")
                .eq("user_id", value: userId)
                .eq("date", value: today)
                .limit(1)
                .execute()
            if let row = response.value.first {
                if let used = row.quizzes_used {
                    ProfileBalanceCache.quizzesUsed = used
                }
                if let extra = row.extra_quizzes {
                    ProfileBalanceCache.extraQuizzes = extra
                }
            }
        } catch {
            // Same — defensive.
        }
    }
}

// MARK: - Settings prefs

enum ProfileSettingsStore {
    private static let analyticsKey = "autocoach.analytics.optOut"
    private static let reminderTimeKey = "autocoach.reminder.studyTime"
    private static let reminderDaysKey = "autocoach.reminder.daysPerWeek"
    private static let reminderEnabledKey = "autocoach.reminder.enabled"

    static var analyticsOptedOut: Bool {
        get { UserDefaults.standard.bool(forKey: analyticsKey) }
        set { UserDefaults.standard.set(newValue, forKey: analyticsKey) }
    }

    static var reminderEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: reminderEnabledKey) }
        set { UserDefaults.standard.set(newValue, forKey: reminderEnabledKey) }
    }

    static var studyTime: StudyTime {
        get {
            if let raw = UserDefaults.standard.string(forKey: reminderTimeKey),
               let time = StudyTime(rawValue: raw) {
                return time
            }
            return .evening
        }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: reminderTimeKey) }
    }

    static var daysPerWeek: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: reminderDaysKey)
            return v == 0 ? 5 : min(7, max(1, v))
        }
        set { UserDefaults.standard.set(min(7, max(1, newValue)), forKey: reminderDaysKey) }
    }
}
