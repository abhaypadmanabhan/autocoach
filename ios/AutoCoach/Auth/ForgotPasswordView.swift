import SwiftUI
import Supabase

/// Password reset (PRD §5.3). Single field, single CTA, terminal sent-state.
///
/// The sent-state is deliberately terminal rather than auto-dismissing: the user
/// has to leave the app to open the link, and a screen that bounces back to the
/// form while they are in Mail reads as "it didn't work".
struct ForgotPasswordView: View {
    let auth: AuthStore
    var onBackToSignIn: () -> Void = {}

    @State private var email: String = ""
    @State private var emailProblem: String?
    @State private var sending = false
    @State private var sentTo: String?
    @State private var failure: String?
    @State private var throttled = false
    @FocusState private var focused: Bool

    private var isValid: Bool { AuthValidation.emailProblem(email) == nil }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let sentTo {
                    sentState(address: sentTo)
                } else {
                    form
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
        .onAppear { if sentTo == nil { focused = true } }
    }

    // MARK: - Form

    private var form: some View {
        VStack(alignment: .leading, spacing: 0) {
            header(kicker: "Reset password",
                   title: "Forgot your password?",
                   subtitle: "We'll email you a link to set a new one.")
                .padding(.bottom, 40)

            ACXField(label: "Email", text: $email, placeholder: "you@example.com",
                     keyboardType: .emailAddress, textContentType: .emailAddress,
                     isSecure: false, problem: emailProblem)
                .focused($focused)
                .submitLabel(.send)
                .onSubmit { Task { await submit() } }
                .onChange(of: focused) { previous, _ in
                    if previous { emailProblem = AuthValidation.emailProblem(email) }
                }

            if throttled {
                Text("Too many requests — wait a minute, then try again.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.ink)
                    .padding(.top, 16)
            }

            if let failure {
                Text(failure)
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.error)
                    .padding(.top, 16)
                    .accessibilityLabel("Error: \(failure)")
            }

            Button {
                Task { await submit() }
            } label: {
                Text(sending ? "Sending…" : "Send reset link")
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(sending || !isValid)
            .opacity(isValid ? 1 : 0.45)
            .padding(.top, 28)

            Button(action: onBackToSignIn) {
                Text("← BACK TO SIGN IN")
                    .font(ACXFont.bodySemibold(15))
                    .kerning(1.0)
                    .foregroundStyle(ACXColor.ink)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .padding(.top, 12)
        }
    }

    // MARK: - Terminal sent-state

    private func sentState(address: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            header(kicker: "Reset link sent",
                   title: "Check your email",
                   subtitle: "If an account exists for this address, a reset link is on its way.")
                .padding(.bottom, 32)

            Text(address)
                .font(ACXFont.monoBold(16))
                .foregroundStyle(ACXColor.ink)
                .textSelection(.enabled)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(Rectangle().stroke(ACXColor.surface, lineWidth: 1))

            Text("The link expires in one hour. Open it on this device to finish in the app.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 20)

            Button("Back to sign in", action: onBackToSignIn)
                .buttonStyle(GhostButtonStyle())
                .padding(.top, 32)
        }
    }

    private func header(kicker: String, title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(kicker)
            Hairline()
            Text(title)
                .font(ACXFont.display(30))
                .foregroundStyle(ACXColor.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)
            Text(subtitle)
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 24)
    }

    private func submit() async {
        guard !sending, isValid else { return }
        focused = false
        sending = true
        failure = nil
        throttled = false
        let address = AuthValidation.normalized(email)
        switch await auth.sendPasswordReset(email: address) {
        case .sent:        sentTo = address
        case .rateLimited: throttled = true
        case .failed(let message): failure = message
        }
        sending = false
    }
}

#Preview {
    ForgotPasswordView(auth: AuthStore(
        supabase: SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "demo"
        )
    ))
}
