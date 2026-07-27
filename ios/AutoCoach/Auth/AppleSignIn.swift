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

/// The system Apple button, at zero corner radius.
///
/// SwiftUI's `SignInWithAppleButton` gives no way to change the corner radius, and
/// painting a square rectangle *behind* it does not work — the button draws its own
/// rounded fill on top, so the rounding stays visible. `ASAuthorizationAppleIDButton`
/// does expose `cornerRadius`, so we use the UIKit button directly and set it to 0.
///
/// This keeps Apple's own artwork and typography untouched (their guidelines forbid
/// redrawing it) while satisfying the zero-radius rule. It is still the one surface in
/// the app that is Apple-black rather than ink, which Apple requires.
private struct AppleIDButtonRepresentable: UIViewRepresentable {
    let onTap: () -> Void

    func makeUIView(context: Context) -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(authorizationButtonType: .continue,
                                                  authorizationButtonStyle: .black)
        button.cornerRadius = 0
        button.addTarget(context.coordinator,
                         action: #selector(Coordinator.tapped),
                         for: .touchUpInside)
        return button
    }

    func updateUIView(_ view: ASAuthorizationAppleIDButton, context: Context) {
        context.coordinator.onTap = onTap
        view.cornerRadius = 0
    }

    func makeCoordinator() -> Coordinator { Coordinator(onTap: onTap) }

    final class Coordinator: NSObject {
        var onTap: () -> Void
        init(onTap: @escaping () -> Void) { self.onTap = onTap }
        @objc func tapped() { onTap() }
    }
}

/// "Continue with Apple" — the system button, squared off to zero radius.
struct AppleSignInButton: View {
    let auth: AuthStore
    /// Surfaced inline by the parent — never a raw alert.
    @Binding var errorMessage: String?
    var onStart: () -> Void = {}
    var onFinish: () -> Void = {}

    @State private var rawNonce: String = ""
    @State private var delegate: AppleAuthDelegate?

    var body: some View {
        AppleIDButtonRepresentable { start() }
            .frame(height: 52)
            .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
            .acxHardShadow()
            .accessibilityLabel("Continue with Apple")
    }

    /// Drives `ASAuthorizationController` by hand, because we no longer get the
    /// request/completion closures `SignInWithAppleButton` provided.
    @MainActor
    private func start() {
        let nonce = AppleNonce.random()
        rawNonce = nonce

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = AppleNonce.sha256(nonce)   // hashed on the request…

        let controller = ASAuthorizationController(authorizationRequests: [request])
        let d = AppleAuthDelegate { result in
            MainActor.assumeIsolated { handle(result) }
        }
        // Held in @State so ARC does not release the delegate while the sheet is up —
        // ASAuthorizationController holds its delegate weakly.
        delegate = d
        controller.delegate = d
        controller.presentationContextProvider = d
        controller.performRequests()
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

/// Delegate + presentation anchor for the hand-driven `ASAuthorizationController`.
///
/// `ASAuthorizationController` keeps `delegate` and `presentationContextProvider`
/// **weak**, so the caller must retain this for the lifetime of the sheet.
final class AppleAuthDelegate: NSObject, ASAuthorizationControllerDelegate,
                               ASAuthorizationControllerPresentationContextProviding {
    private let completion: (Result<ASAuthorization, any Error>) -> Void

    init(completion: @escaping (Result<ASAuthorization, any Error>) -> Void) {
        self.completion = completion
    }

    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithAuthorization authorization: ASAuthorization) {
        completion(.success(authorization))
    }

    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithError error: any Error) {
        completion(.failure(error))
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        return scene?.keyWindow ?? ASPresentationAnchor()
    }
}
