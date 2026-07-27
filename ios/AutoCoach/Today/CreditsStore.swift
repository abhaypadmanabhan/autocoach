import Foundation
import Observation

/// Persisted credit ledger, keyed by the **UTC** day.
///
/// UTC is not a choice — `backend/app/services/usage.py` buckets
/// `user_daily_usage` on `datetime.now(timezone.utc).date()`, so the quota really
/// does reset at UTC midnight regardless of where the user is standing.
struct CreditLedger: Codable, Equatable, Sendable {
    var utcDay: String = ""
    var used: Int = 0
    /// The server answered 429 daily-quota today. This is the only *authoritative*
    /// signal we ever get about the quota.
    var serverExhausted: Bool = false
    /// Limit echoed back on that 429 (base 5 plus any redeemed extras).
    var serverLimit: Int?
}

/// Device-local view of the 5/day quiz quota.
///
/// **There is no endpoint that reads `user_daily_usage`.** The client cannot know
/// what a session on the web or a second device consumed, so this counts what
/// *this device* spent and defers to the server the moment a 429 arrives. The UI
/// labels it as device-local rather than presenting a guess as fact.
@MainActor
@Observable
final class CreditsStore {
    static let fileName = "credits.json"
    /// `QUIZ_LIMIT` in `backend/app/services/usage.py`.
    static let baseLimit = 5

    private(set) var ledger: CreditLedger
    private let store: AppGroupStore

    init(store: AppGroupStore = .shared) {
        self.store = store
        self.ledger = store.read(CreditLedger.self, from: Self.fileName) ?? CreditLedger()
        rollOverIfNeeded()
    }

    var total: Int { ledger.serverLimit ?? Self.baseLimit }
    var used: Int { min(ledger.used, total) }
    var remaining: Int { max(0, total - used) }
    var isExhausted: Bool { ledger.serverExhausted || remaining == 0 }

    /// Time until the quota resets, i.e. the next UTC midnight.
    func resetsIn(from now: Date = Date()) -> DateComponents? {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        guard let midnight = utc.date(byAdding: .day, value: 1, to: utc.startOfDay(for: now)) else { return nil }
        return utc.dateComponents([.hour, .minute], from: now, to: midnight)
    }

    /// A standard (quota-consuming) session was created. Review sessions must
    /// **not** call this — the backend skips `consume_quiz_usage_or_429` for them.
    func noteStandardSessionStarted() {
        rollOverIfNeeded()
        ledger.used += 1
        persist()
    }

    /// The server rejected a session with the daily-quota 429. Authoritative:
    /// clamp the local count up to the server's own limit.
    func noteDailyQuotaReached(limit: Int) {
        rollOverIfNeeded()
        if limit > 0 { ledger.serverLimit = limit }
        ledger.used = max(ledger.used, ledger.serverLimit ?? Self.baseLimit)
        ledger.serverExhausted = true
        persist()
    }

    /// Discards yesterday's count once the UTC day turns over.
    func rollOverIfNeeded(now: Date = Date()) {
        let today = Self.utcDayKey(now)
        guard ledger.utcDay != today else { return }
        ledger = CreditLedger(utcDay: today, used: 0, serverExhausted: false, serverLimit: nil)
        persist()
    }

    private func persist() {
        store.write(ledger, to: Self.fileName)
    }

    private static func utcDayKey(_ date: Date) -> String {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        let c = utc.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
