import Foundation
import Supabase

/// Auth state used by root routing.
enum AuthState: Equatable, Sendable {
    case loading       // resolving the initial session
    case signedOut
    case signedIn
}

/// `@Observable` wrapper over `supabase-swift` auth (research §2).
///
/// Email + password only (M2). Session persistence is the SDK's default
/// Keychain storage. `authStateChanges` is the single source of truth for root
/// routing — `.signedIn`/`.signedOut`/`.initialSession` flip ``state`` and the
/// `RootView` switches screens accordingly.
///
/// `@MainActor` so all mutations happen on the main actor (required for
/// `@Observable` + SwiftUI under Swift 6 strict concurrency). The
/// `APIClient` actor does **not** touch this class — it calls `signOut()` on the
/// Supabase client directly, and the `authStateChanges` stream flips state here.
@MainActor
@Observable
final class AuthStore {
    private(set) var state: AuthState = .loading
    var signInErrorMessage: String?

    let supabase: SupabaseClient
    // `nonisolated(unsafe)`: cancelled from `deinit` (a nonisolated context).
    // `Task.cancel()` is thread-safe; the value is only assigned on the main actor.
    nonisolated(unsafe) private var listenerTask: Task<Void, Never>?

    init(supabase: SupabaseClient) {
        self.supabase = supabase
        // `authStateChanges` is an actor-isolated property on AuthClient → `await`.
        // The Task inherits MainActor isolation, so `handle()` runs on main.
        listenerTask = Task { [weak self] in
            for await (event, session) in await supabase.auth.authStateChanges {
                self?.handle(event: event, session: session)
            }
        }
    }

    deinit {
        listenerTask?.cancel()
    }

    private func handle(event: AuthChangeEvent, session: Session?) {
        switch event {
        case .initialSession:
            state = session != nil ? .signedIn : .signedOut
        case .signedIn, .tokenRefreshed, .userUpdated:
            state = .signedIn
        case .signedOut, .userDeleted:
            state = .signedOut
        default:
            break
        }
    }

    /// Email + password sign-in (web parity). Errors surface in
    /// ``signInErrorMessage`` rather than throwing, so the LoginView can render
    /// them inline without a do/catch ceremony at every call site.
    func signIn(email: String, password: String) async {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty, !password.isEmpty else {
            signInErrorMessage = "Enter your email and password."
            return
        }
        signInErrorMessage = nil
        do {
            _ = try await supabase.auth.signIn(email: trimmedEmail, password: password)
            // The `.signedIn` event updates `state`; set defensively too.
            state = .signedIn
        } catch {
            signInErrorMessage = friendlyMessage(error)
        }
    }

    func signOut() async {
        signInErrorMessage = nil
        try? await supabase.auth.signOut()
        // The `.signedOut` event updates `state`; set defensively too.
        state = .signedOut
    }

    /// Best-effort display email for settings/account affordances.
    var email: String? {
        supabase.auth.currentUser?.email
    }

    private func friendlyMessage(_ error: Error) -> String {
        // supabase-swift throws `AuthError` / `URLError`; surface a readable line.
        let raw = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        // Trim verbose SDK messages to the first sentence for the UI.
        if let first = raw.split(separator: ".").first, !first.isEmpty {
            return String(first) + "."
        }
        return raw.isEmpty ? "Sign in failed. Please try again." : raw
    }
}
