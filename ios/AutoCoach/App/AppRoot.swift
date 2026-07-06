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

/// Root switch on `AuthStore.state` (driven by `authStateChanges`).
struct RootView: View {
    let auth: AuthStore
    let api: APIClient

    var body: some View {
        switch auth.state {
        case .loading:
            BootView()
        case .signedOut:
            LoginView(auth: auth)
        case .signedIn:
            DashboardView(auth: auth, api: api)
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
