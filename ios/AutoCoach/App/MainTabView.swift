import SwiftUI

/// Three-tab shell. Each tab owns its **own** `NavigationStack` so a push in one
/// tab never pops when the user switches away.
///
/// The tab bar is flat `Ground` via `.toolbarBackground` — no material, no blur.
/// `.toolbarBackgroundVisibility(.visible, for: .tabBar)` is required; without it
/// UIKit keeps the default translucent bar and the Ground colour never shows.
///
/// **Placeholder tabs are intentional.** Phase 1/2 lanes replace each body; this
/// lane owns only the shell.
struct MainTabView: View {
    let auth: AuthStore
    let api: APIClient

    var body: some View {
        TabView {
            Tab("Today", systemImage: "square.grid.2x2") {
                NavigationStack {
                    TabPlaceholder(kicker: "01 / TODAY", line: "Today's review queue lands here.")
                }
            }
            Tab("Library", systemImage: "tray.full") {
                NavigationStack {
                    DashboardView(auth: auth, api: api)
                }
            }
            Tab("Profile", systemImage: "person") {
                NavigationStack {
                    TabPlaceholder(kicker: "03 / PROFILE", line: "Profile, settings and credits land here.")
                }
            }
        }
        .tint(ACXColor.accent)
        .toolbarBackground(ACXColor.ground, for: .tabBar)
        .toolbarBackgroundVisibility(.visible, for: .tabBar)
    }
}

/// Lightweight stand-in a feature lane replaces wholesale. Kicker + one line,
/// nothing else — deliberately not a partial implementation of the real screen.
struct TabPlaceholder: View {
    let kicker: String
    let line: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker(kicker)
            Hairline()
            Text(line)
                .font(ACXFont.body(14))
                .foregroundStyle(ACXColor.muted)
                .padding(.top, 6)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(GroundBackground())
    }
}

/// Stand-in for the real `OnboardingFlow` (design PRD §5.4), which Phase 1
/// lane B owns. Routing to it is live now so the four-way `RootView` switch is
/// exercised; only the body is a placeholder.
///
/// `onSkip` lets the user through to the app so a routing bug here can never
/// hard-lock an account out of the product.
struct OnboardingPlaceholder: View {
    var onSkip: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("ONBOARDING")
            Hairline()
            Text("Onboarding")
                .font(ACXFont.display(26))
                .foregroundStyle(ACXColor.ink)
                .padding(.top, 6)
            Text("The four-step onboarding flow is built in a later lane. Continue for now.")
                .font(ACXFont.body(14))
                .foregroundStyle(ACXColor.muted)

            Button("CONTINUE", action: onSkip)
                .buttonStyle(PrimaryButtonStyle())
                .padding(.top, 16)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(GroundBackground())
    }
}

#Preview("TabPlaceholder") {
    TabPlaceholder(kicker: "01 / TODAY", line: "Today's review queue lands here.")
}

#Preview("OnboardingPlaceholder") {
    OnboardingPlaceholder(onSkip: {})
}
