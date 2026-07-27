import AuthenticationServices
import CryptoKit
import Foundation
import SwiftUI

/// The only values we need out of an `ASAuthorization`, extracted synchronously on
/// the main actor so nothing non-`Sendable` crosses into the async sign-in call.
///
/// `ASAuthorizationAppleIDCredential` is not `Sendable`; under Swift 6 strict
/// concurrency it cannot be captured by the `Task` that performs the token
/// exchange. Flattening it here at the callback boundary is the fix.
struct AppleIdentity: Sendable, Equatable {
    let idToken: String
    /// Apple returns this **only on the very first authorization** for an Apple ID.
    /// Every subsequent sign-in returns nil, forever. Persist it now or lose it.
    let fullName: String?
    let email: String?

    @MainActor
    init?(_ authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8)
        else { return nil }

        self.idToken = token
        self.email = credential.email
        if let components = credential.fullName {
            let formatted = PersonNameComponentsFormatter().string(from: components)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            self.fullName = formatted.isEmpty ? nil : formatted
        } else {
            self.fullName = nil
        }
    }
}

/// Nonce generation for Sign in with Apple.
///
/// The two directions are easy to swap and the failure is silent-ish (Supabase
/// rejects the exchange with an opaque error), so they are stated here once:
///
/// - `ASAuthorizationAppleIDRequest.nonce` carries the **SHA-256 hash**.
/// - `signInWithIdToken(credentials:)` carries the **raw** string.
enum AppleNonce {
    /// Cryptographically random URL-safe string.
    static func random(length: Int = 32) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        guard status == errSecSuccess else {
            // SecRandomCopyBytes only fails if the system RNG is unavailable, in
            // which case continuing with a weak nonce would be worse than crashing.
            preconditionFailure("SecRandomCopyBytes failed: OSStatus \(status)")
        }
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    /// Lowercase hex SHA-256 — the form Apple expects on the request.
    static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}

/// "Continue with Apple" — the system button, squared off to zero radius.
///
/// Apple's guidelines forbid recolouring or redrawing the button, so this is the
/// one surface in the app that is Apple-black rather than ink. The rounded fill it
/// draws is covered by a square black rectangle behind it, which lands the Quiet
/// Brutalism zero-radius rule without touching the button's own artwork.
struct AppleSignInButton: View {
    let auth: AuthStore
    /// Surfaced inline by the parent — never a raw alert.
    @Binding var errorMessage: String?
    var onStart: () -> Void = {}
    var onFinish: () -> Void = {}

    @State private var rawNonce: String = ""

    var body: some View {
        SignInWithAppleButton(.continue) { request in
            let nonce = AppleNonce.random()
            rawNonce = nonce
            request.requestedScopes = [.fullName, .email]
            request.nonce = AppleNonce.sha256(nonce)   // hashed on the request…
        } onCompletion: { result in
            // `onCompletion` is delivered on the main thread; asserting that lets us
            // read the non-Sendable `ASAuthorization` without hopping actors.
            MainActor.assumeIsolated { handle(result) }
        }
        .signInWithAppleButtonStyle(.black)
        .frame(height: 52)
        .background(Rectangle().fill(Color.black))
        .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
        .acxHardShadow()
        .accessibilityLabel("Continue with Apple")
    }

    @MainActor
    private func handle(_ result: Result<ASAuthorization, any Error>) {
        switch result {
        case .success(let authorization):
            guard let identity = AppleIdentity(authorization) else {
                errorMessage = "Apple didn't return an identity token. Try again."
                return
            }
            let nonce = rawNonce
            onStart()
            Task {
                let failure = await auth.signInWithApple(identity, rawNonce: nonce)  // …raw on the exchange
                errorMessage = failure
                onFinish()
            }
        case .failure(let error):
            // A user-cancelled sheet is not an error state — say nothing.
            if (error as? ASAuthorizationError)?.code == .canceled {
                errorMessage = nil
                return
            }
            errorMessage = "Apple sign-in didn't complete. Try again."
        }
    }
}
