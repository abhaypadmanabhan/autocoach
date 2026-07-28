import Foundation
import Network
import Observation

/// Minimal reachability flag, so "offline" can be a *designed* state rather than
/// a network error string.
///
/// `APIClient` sets `waitsForConnectivity = true`, which means a request made
/// with no network hangs until the 15s timeout instead of failing fast. Knowing
/// the path is down lets the screen say so immediately and show the last-known
/// snapshot instead of stalling on a spinner.
@MainActor
@Observable
final class NetworkReachability {
    private(set) var isOnline = true

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.padzy.autocoach.reachability")
    private var started = false

    func start() {
        guard !started else { return }
        started = true
        monitor.pathUpdateHandler = { path in
            // Reduce to a `Bool` inside the handler: `NWPath` is not `Sendable`
            // and must not cross into the main actor.
            let satisfied = path.status == .satisfied
            Task { @MainActor [weak self] in
                self?.isOnline = satisfied
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
