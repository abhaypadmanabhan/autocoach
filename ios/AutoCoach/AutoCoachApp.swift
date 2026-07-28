import SwiftUI

/// AutoCoach — native iOS (Milestone 2: auth → quiz → verdict → results vertical slice).
///
/// Dependency wiring happens in ``AppRoot`` (built on first appearance via a
/// `.task`, so the `@MainActor`-isolated ``AuthStore`` is constructed on the
/// main actor — required under Swift 6 strict concurrency). The `@main` App
/// stays a thin shell.
@main
struct AutoCoachApp: App {
    init() {
        // Debug-only: trips immediately if a bundled face failed to register,
        // rather than letting the app quietly render in San Francisco.
        ACXFont.assertBundledFacesResolve()
    }

    var body: some Scene {
        WindowGroup {
            AppRoot()
        }
    }
}

