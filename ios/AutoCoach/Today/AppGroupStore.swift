import Foundation

/// Identifiers declared in `project.yml` (see `ios/docs/foundation-notes.md` §2).
enum AppGroup {
    static let identifier = "group.com.padzy.autocoach"
}

/// Small JSON-file store inside the **App Group container**.
///
/// The streak and the credit ledger have no backend (design PRD §9.2, decision
/// 12.2), so they live on the device. They deliberately do *not* live in plain
/// `UserDefaults`: the Phase 4 widget (§6.1) has to read the same bytes with the
/// app not running, and that only works from the shared container.
///
/// **The container can legitimately be unavailable.** `DEVELOPMENT_TEAM` is empty
/// today, so a simulator build signs "to run locally" and Xcode strips the
/// App Group entitlement — `containerURL(forSecurityApplicationGroupIdentifier:)`
/// then returns `nil` (foundation notes §2). Falling back to Application Support
/// keeps the streak working in the simulator instead of silently resetting on
/// every launch, and ``isShared`` records which one we actually got so the UI can
/// stay honest rather than promising a widget-readable streak it does not have.
struct AppGroupStore: Sendable {
    let directory: URL
    /// `true` when writes landed in the real App Group container.
    let isShared: Bool

    static let shared = AppGroupStore()

    init(groupIdentifier: String = AppGroup.identifier) {
        let fm = FileManager.default
        if let container = fm.containerURL(forSecurityApplicationGroupIdentifier: groupIdentifier) {
            directory = container.appending(path: "AutoCoach", directoryHint: .isDirectory)
            isShared = true
        } else {
            let base = (try? fm.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )) ?? URL.temporaryDirectory
            directory = base.appending(path: "AutoCoach", directoryHint: .isDirectory)
            isShared = false
        }
        try? fm.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    func read<T: Decodable>(_ type: T.Type, from name: String) -> T? {
        let url = directory.appending(path: name)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    func write<T: Encodable>(_ value: T, to name: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        // `.atomic` so a crash mid-write cannot leave the widget reading a
        // half-serialized file.
        try? data.write(to: directory.appending(path: name), options: .atomic)
    }
}
