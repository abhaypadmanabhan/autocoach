import Foundation
import UserNotifications

/// Local study reminders (design PRD §6.2).
///
/// **Local notifications only.** There is no APNs, no push server and no device
/// token stored anywhere in this product — a `UNCalendarNotificationTrigger` on
/// the user's own device is the whole mechanism.
///
/// Authorization is requested from the step-4 prime screen and *only* there,
/// after the user has picked a time. Asking on launch is the single fastest way
/// to get a permanent `denied` and lose the habit loop entirely.
enum StudyReminderScheduler {
    /// Prefix so we only ever cancel our own requests.
    private static let identifierPrefix = "autocoach.study-reminder"

    /// A small portfolio of hooks rather than one repeated nag — the same copy
    /// every day is what earns the "too many notifications" review.
    private static let hooks: [(title: String, body: String)] = [
        ("Time to study", "A few concepts are due. Five minutes is enough."),
        ("Your queue is waiting", "Review what's slipping before it goes cold."),
        ("Quick session?", "Answer three questions and keep the streak alive."),
        ("Pick up where you left off", "Your last document still has weak concepts."),
        ("Small and often wins", "One short review beats one long cram."),
        ("Due today", "The concepts you got wrong are back around."),
        ("Two minutes", "Just enough to keep today from being a zero."),
    ]

    /// Ask the system for permission. Returns whether it was granted.
    ///
    /// Safe to call when already determined — the system returns the existing
    /// answer without showing a second dialog.
    static func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            return try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    /// Replace any existing reminders with `daysPerWeek` weekly-repeating ones at
    /// `time`. Returns how many were scheduled.
    ///
    /// One request per weekday rather than one daily request, because the cap is
    /// "at most one per day" and a cadence under seven days a week has to skip
    /// days rather than fire every one of them.
    @discardableResult
    static func schedule(time: StudyTime, daysPerWeek: Int) async -> Int {
        let center = UNUserNotificationCenter.current()
        await cancelAll()

        let weekdays = weekdaySpread(count: daysPerWeek)
        var scheduled = 0

        for (index, weekday) in weekdays.enumerated() {
            var components = DateComponents()
            components.weekday = weekday
            components.hour = time.hour
            components.minute = time.minute

            let hook = hooks[index % hooks.count]
            let content = UNMutableNotificationContent()
            content.title = hook.title
            content.body = hook.body
            content.sound = .default

            let request = UNNotificationRequest(
                identifier: "\(identifierPrefix).\(weekday)",
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            )
            do {
                try await center.add(request)
                scheduled += 1
            } catch {
                // A single failed add must not abort the rest; the user still
                // gets the days that landed.
                continue
            }
        }
        return scheduled
    }

    static func cancelAll() async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let ours = pending.map(\.identifier).filter { $0.hasPrefix(identifierPrefix) }
        guard !ours.isEmpty else { return }
        center.removePendingNotificationRequests(withIdentifiers: ours)
    }

    /// `count` weekdays spread evenly across the week, Monday-first.
    ///
    /// `Calendar` weekdays are 1 == Sunday … 7 == Saturday, so Monday-first is
    /// `[2,3,4,5,6,7,1]`. Flooring keeps the picks strictly increasing for any
    /// count ≤ 7, so no day is ever chosen twice.
    static func weekdaySpread(count: Int) -> [Int] {
        let mondayFirst = [2, 3, 4, 5, 6, 7, 1]
        let clamped = min(7, max(1, count))
        guard clamped < 7 else { return mondayFirst }
        return (0..<clamped).map { mondayFirst[Int(Double($0) * 7.0 / Double(clamped))] }
    }
}
