import SwiftUI
import Supabase

/// The signed-out surface, end to end (PRD §5.1–§5.3).
///
/// This is the lane's single mount point: it owns its own `NavigationStack` and
/// needs nothing but an ``AuthStore``, so the root router can swap it in without
/// knowing any of the screens behind it.
struct AuthFlowView: View {
    let auth: AuthStore

    @State private var path: [AuthRoute] = []

    /// Value-typed routes so the stack stays inspectable and pop-to-root is a
    /// single assignment rather than a chain of dismisses.
    enum AuthRoute: Hashable {
        case signup
        case login
        case forgotPassword
    }

    var body: some View {
        NavigationStack(path: $path) {
            WelcomeView(
                auth: auth,
                onEmailSignup: { path.append(.signup) },
                onSignIn: { path.append(.login) }
            )
            .navigationDestination(for: AuthRoute.self) { route in
                destination(route)
            }
        }
        .tint(ACXColor.ink)
    }

    @ViewBuilder
    private func destination(_ route: AuthRoute) -> some View {
        switch route {
        case .signup:
            SignupView(auth: auth, onSignIn: { goTo(.login) })
                .modifier(AuthScreenChrome())
        case .login:
            LoginView(
                auth: auth,
                onForgotPassword: { path.append(.forgotPassword) },
                onSignUp: { goTo(.signup) }
            )
            .modifier(AuthScreenChrome())
        case .forgotPassword:
            ForgotPasswordView(auth: auth, onBackToSignIn: { goTo(.login) })
                .modifier(AuthScreenChrome())
        }
    }

    /// Replaces the stack rather than pushing, so bouncing between signup and
    /// login cannot build an unbounded back-stack of the same two screens.
    private func goTo(_ route: AuthRoute) {
        path = [route]
    }
}

/// Shared navigation chrome for the pushed auth screens: cream bar, ink back
/// control, no title. Keeping the system bar (rather than hiding it) preserves the
/// interactive swipe-back gesture, which a custom back button alone does not.
private struct AuthScreenChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ACXColor.ground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
    }
}

#Preview {
    AuthFlowView(auth: AuthStore(
        supabase: SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "demo"
        )
    ))
}
