import SwiftUI
import Supabase

/// First launch, signed out (PRD §5.1). Establishes the value proposition before
/// asking for anything.
///
/// Hierarchy is lifted from the Brilliant account-creation flow — social button
/// above a rule above email, existing-user link de-emphasised in the footer — with
/// its pill shapes dropped entirely.
///
/// Accent budget: the three bullet ticks are the only accent in this view. The
/// Apple button is Apple-black by mandate, the email CTA is a ghost.
struct WelcomeView: View {
    let auth: AuthStore
    var onEmailSignup: () -> Void = {}
    var onSignIn: () -> Void = {}

    @State private var appleError: String?
    @State private var appleWorking = false

    private static let bullets = ["Your documents", "Adaptive questions", "Spaced review"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                SectionLabel("Autocoach")
                Hairline()
                    .padding(.top, 10)

                Text("Turn your notes into a tutor that knows what you forgot.")
                    .font(ACXFont.display(32))
                    .foregroundStyle(ACXColor.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 24)

                VStack(alignment: .leading, spacing: 14) {
                    ForEach(Self.bullets, id: \.self) { bullet in
                        HStack(spacing: 12) {
                            Rectangle()
                                .fill(ACXColor.accent)
                                .frame(width: 2, height: 16)
                            Text(bullet)
                                .font(ACXFont.body(15))
                                .kerning(1.0)
                                .foregroundStyle(ACXColor.ink)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .padding(.top, 32)

                Spacer(minLength: 48)

                actions
                    .padding(.top, 48)
            }
            .padding(.horizontal, 24)
            .padding(.top, 24)
            .padding(.bottom, 32)
        }
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
    }

    private var actions: some View {
        VStack(alignment: .leading, spacing: 16) {
            AppleSignInButton(
                auth: auth,
                errorMessage: $appleError,
                onStart: { appleWorking = true },
                onFinish: { appleWorking = false }
            )
            .disabled(appleWorking)

            if let appleError {
                Text(appleError)
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.error)
                    .accessibilityLabel("Error: \(appleError)")
            }

            Button("Continue with email", action: onEmailSignup)
                .buttonStyle(GhostButtonStyle())

            Button(action: onSignIn) {
                Text("ALREADY HAVE AN ACCOUNT? → SIGN IN")
                    .font(ACXFont.bodySemibold(15))
                    .kerning(1.0)
                    .foregroundStyle(ACXColor.ink)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }

            Hairline()

            Text("BY CONTINUING YOU AGREE TO OUR TERMS / PRIVACY")
                .font(ACXFont.body(15))
                .kerning(0.6)
                .foregroundStyle(ACXColor.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

#Preview {
    WelcomeView(auth: AuthStore(
        supabase: SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "demo"
        )
    ))
}
