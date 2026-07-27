import SwiftUI
import Supabase

/// Top-level container. Builds the ``AuthStore`` + ``APIClient`` once on first
/// appearance (in a `.task`, which runs on the main actor — required to
/// construct the `@MainActor`-isolated `AuthStore` under Swift 6 strict
/// concurrency), then routes on auth state.
struct AppRoot: View {
    @State private var auth: AuthStore?
    @State private var api: APIClient?

    var body: some View {
        Group {
            if !AppConfig.isConfigured {
                ConfigMissingView()
            } else if let auth, let api {
                RootView(auth: auth, api: api)
            } else {
                BootView()
            }
        }
        .task {
            guard auth == nil, api == nil, AppConfig.isConfigured else { return }
            let supabase = SupabaseClient(
                supabaseURL: AppConfig.supabaseURL!,
                supabaseKey: AppConfig.supabaseKey!
            )
            auth = AuthStore(supabase: supabase)
            api = APIClient(supabase: supabase, baseURL: AppConfig.backendBaseURL)
        }
    }
}

/// Root switch on `AuthStore.state` (driven by `authStateChanges`), plus the
/// onboarding gate.
///
/// Four destinations: loading / signedOut / signedIn-needs-onboarding /
/// signedIn. The onboarding branch is resolved by `GET /onboarding`, which is
/// probed once per signed-in session.
///
/// **Failure policy:** a failed probe routes to the app, not to onboarding. A
/// transient network blip must never trap a returning user in a signup flow they
/// already finished. The cost of the opposite default is a user who silently
/// never gets onboarded.
struct RootView: View {
    let auth: AuthStore
    let api: APIClient

    /// Resolution state of the `GET /onboarding` probe.
    private enum Gate: Equatable {
        case probing
        case needsOnboarding
        case ready
    }

    @State private var gate: Gate = .probing

    var body: some View {
        switch auth.state {
        case .loading:
            BootView()
        case .signedOut:
            AuthFlowView(auth: auth)
                // Re-arm the probe so the *next* sign-in re-checks rather than
                // inheriting the previous account's answer.
                .onAppear { gate = .probing }
        case .signedIn:
            signedInBody
        }
    }

    @ViewBuilder
    private var signedInBody: some View {
        switch gate {
        case .probing:
            BootView()
                .task { await probeOnboarding() }
        case .needsOnboarding:
            OnboardingFlowView(api: api) { gate = .ready }
        case .ready:
            MainTabView(auth: auth, api: api)
        }
    }

    private func probeOnboarding() async {
        do {
            let status: OnboardingResponse = try await api.get("/onboarding")
            gate = status.has_completed ? .ready : .needsOnboarding
        } catch {
            // Fail open — see the failure policy above.
            gate = .ready
        }
    }
}

/// Brief launch / session-resolve screen.
struct BootView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker("AUTOCOACH")
            Hairline()
            Text("Loading…")
                .font(ACXFont.mono(13))
                .foregroundStyle(ACXColor.muted)
                .padding(.top, 6)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(GroundBackground())
    }
}

/// Shown when `Config.xcconfig` is missing or unresolved (fresh clone without
/// local config). Build still succeeds; this is the runtime floor.
struct ConfigMissingView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("CONFIG REQUIRED")
            Hairline()
            Text("Configuration missing")
                .font(ACXFont.display(26))
                .foregroundStyle(ACXColor.ink)
                .padding(.top, 6)
            Text("Copy ios/Config.xcconfig.template to ios/Config.xcconfig and fill in your Supabase URL + publishable key, then rebuild.")
                .font(ACXFont.body(14))
                .foregroundStyle(ACXColor.muted)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(GroundBackground())
    }
}
