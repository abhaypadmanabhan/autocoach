import Foundation
import Supabase

/// Auth state used by root routing.
enum AuthState: Equatable, Sendable {
    case loading       // resolving the initial session
    case signedOut
    case signedIn
}

/// Outcome of an email signup (PRD §5.2). Every branch is a *designed* screen
/// state; none of them is a raw error string in an alert.
enum SignUpOutcome: Equatable, Sendable {
    /// Project has email confirmation off — we already hold a session.
    case signedIn
    /// Supabase sent a confirmation link. The user is stranded unless we render
    /// the check-your-inbox state, which is the whole point of this case existing.
    case confirmationRequired
    /// This address already has an account — offer "Sign in instead".
    case duplicateAccount
    case failed(String)
}

/// Outcome of a transactional-email request (confirmation resend, password reset).
enum AuthEmailOutcome: Equatable, Sendable {
    case sent
    /// Supabase's per-address send throttle. A designed "wait a moment" line,
    /// not an error — same framing rule as the quiz quota.
    case rateLimited
    case failed(String)
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

    /// Email + password signup (PRD §5.2).
    ///
    /// Returns rather than throwing so `SignupView` can switch straight onto a
    /// designed state. Errors are **not** written to ``signInErrorMessage`` here —
    /// that property belongs to the login form and reusing it leaks a stale signup
    /// error onto the sign-in screen.
    func signUp(email: String, password: String) async -> SignUpOutcome {
        let trimmedEmail = AuthValidation.normalized(email)
        do {
            let response = try await supabase.auth.signUp(email: trimmedEmail, password: password)
            switch response {
            case .session:
                state = .signedIn
                return .signedIn
            case .user(let user):
                // Supabase deliberately obfuscates "this email is taken": rather
                // than erroring, it returns a synthetic user with an EMPTY
                // `identities` array. That empty array is the only signal, and
                // missing it is what makes ports show "check your inbox" for an
                // email that will never arrive.
                if user.identities?.isEmpty == true { return .duplicateAccount }
                return .confirmationRequired
            }
        } catch let error as AuthError {
            switch error.errorCode {
            case .userAlreadyExists, .emailExists:
                return .duplicateAccount
            case .weakPassword:
                return .failed("That password is too weak. Try a longer one.")
            default:
                return .failed(friendlyMessage(error))
            }
        } catch {
            return .failed(friendlyMessage(error))
        }
    }

    /// Re-sends the signup confirmation link (PRD §5.2, Resend button).
    func resendConfirmation(email: String) async -> AuthEmailOutcome {
        await sendEmail {
            try await self.supabase.auth.resend(
                email: AuthValidation.normalized(email),
                type: .signup
            )
        }
    }

    /// Password-reset email (PRD §5.3).
    func sendPasswordReset(email: String) async -> AuthEmailOutcome {
        await sendEmail {
            try await self.supabase.auth.resetPasswordForEmail(AuthValidation.normalized(email))
        }
    }

    private func sendEmail(_ operation: () async throws -> Void) async -> AuthEmailOutcome {
        do {
            try await operation()
            return .sent
        } catch let error as AuthError {
            if error.errorCode == .overEmailSendRateLimit || error.errorCode == .overRequestRateLimit {
                return .rateLimited
            }
            return .failed(friendlyMessage(error))
        } catch {
            return .failed(friendlyMessage(error))
        }
    }

    /// Exchanges an Apple identity token for a Supabase session.
    ///
    /// - Parameter rawNonce: the **unhashed** nonce. The `ASAuthorizationAppleIDRequest`
    ///   carried its SHA-256 hash; Supabase hashes this value itself and compares.
    ///   Passing the hash here fails the exchange.
    /// - Returns: `nil` on success, otherwise a message to render inline.
    func signInWithApple(_ identity: AppleIdentity, rawNonce: String) async -> String? {
        do {
            _ = try await supabase.auth.signInWithIdToken(
                credentials: .init(provider: .apple, idToken: identity.idToken, nonce: rawNonce)
            )
            state = .signedIn

            // Apple hands over the display name exactly once, on the first ever
            // authorization for this Apple ID. If we don't persist it here it is
            // unrecoverable — there is no API to ask for it again.
            if let fullName = identity.fullName {
                try? await supabase.auth.update(
                    user: UserAttributes(data: ["full_name": .string(fullName)])
                )
            }
            return nil
        } catch {
            return friendlyMessage(error)
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
