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

    @State private var showUpload = false

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
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                Button {
                                    showUpload = true
                                } label: {
                                    Image(systemName: "plus")
                                        .foregroundStyle(ACXColor.ink)
                                }
                                .accessibilityLabel("Add a document")
                            }
                        }
                }
                .sheet(isPresented: $showUpload) {
                    // `AuthStore` already owns the configured client, so the sheet
                    // does not need a second one threaded down from `AppRoot`.
                    UploadSheet(api: api, supabase: auth.supabase) { _ in
                        showUpload = false
                        // The library reloads on appear, so a newly-ready document
                        // shows up without a manual refresh.
                    }
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

#Preview("TabPlaceholder") {
    TabPlaceholder(kicker: "01 / TODAY", line: "Today's review queue lands here.")
}
