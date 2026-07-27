import SwiftUI
import Supabase

/// Create an account without leaving the app (PRD §5.2).
///
/// Two states matter more than the form itself:
///
/// - **confirmation pending** — when the Supabase project requires email
///   confirmation, `signUp` returns a user and no session. Without a dedicated
///   screen the user sits on a form that looks like it failed. This one echoes the
///   address in mono, offers Resend, and always leaves a way out.
/// - **duplicate account** — Supabase hides this behind an empty `identities`
///   array (see `AuthStore.signUp`). Surfacing "Sign in instead" turns a dead end
///   into the one-tap route the user actually wanted.
struct SignupView: View {
    let auth: AuthStore
    var onSignIn: () -> Void = {}

    private enum Phase: Equatable { case form, checkInbox }

    @State private var phase: Phase = .form
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var emailProblem: String?
    @State private var passwordProblem: String?
    @State private var submitting = false
    @State private var duplicate = false
    @State private var failure: String?
    @State private var pendingAddress: String = ""
    @State private var resendState: ResendState = .idle
    @FocusState private var focused: Field?

    private enum Field { case email, password }

    private enum ResendState: Equatable {
        case idle, sending, sent, throttled, failed(String)
    }

    private var isValid: Bool { AuthValidation.isValidSignup(email: email, password: password) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                switch phase {
                case .form:       form
                case .checkInbox: checkInbox
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
        .onAppear { if phase == .form { focused = .email } }
    }

    // MARK: - Form

    private var form: some View {
        VStack(alignment: .leading, spacing: 0) {
            header(kicker: "02 / CREATE ACCOUNT",
                   title: "Create your account",
                   subtitle: "Upload a document, get questions that adapt to what you miss.")
                .padding(.bottom, 40)

            VStack(alignment: .leading, spacing: 20) {
                ACXField(label: "Email", text: $email, placeholder: "you@example.com",
                         keyboardType: .emailAddress, textContentType: .emailAddress,
                         isSecure: false, problem: emailProblem)
                    .focused($focused, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focused = .password }

                ACXField(label: "Password", text: $password, placeholder: "AT LEAST 8 CHARACTERS",
                         keyboardType: .default, textContentType: .newPassword,
                         isSecure: true, revealToggle: true, problem: passwordProblem)
                    .focused($focused, equals: .password)
                    .submitLabel(.go)
                    .onSubmit { Task { await submit() } }
            }
            // Validate on blur, never on keystroke: the parent owns focus, so it
            // owns the moment a field is "finished".
            .onChange(of: focused) { previous, _ in
                switch previous {
                case .email:    emailProblem = AuthValidation.emailProblem(email)
                case .password: passwordProblem = AuthValidation.passwordProblem(password)
                case nil:       break
                }
            }

            if duplicate { duplicateBlock.padding(.top, 24) }

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
                Text(submitting ? "Creating…" : "Create account")
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(submitting || !isValid)
            .opacity(isValid ? 1 : 0.45)
            .padding(.top, 28)

            Button(action: onSignIn) {
                Text("ALREADY HAVE AN ACCOUNT? → SIGN IN")
                    .font(ACXFont.bodySemibold(15))
                    .kerning(1.0)
                    .foregroundStyle(ACXColor.ink)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .padding(.top, 12)
        }
    }

    /// Duplicate account — a route, not an error string.
    private var duplicateBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("That email already has an account.")
                .font(ACXFont.bodySemibold(15))
                .kerning(0.8)
                .foregroundStyle(ACXColor.ink)
            Button("Sign in instead", action: onSignIn)
                .buttonStyle(GhostButtonStyle())
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
        .accessibilityElement(children: .contain)
    }

    // MARK: - Confirmation pending

    private var checkInbox: some View {
        VStack(alignment: .leading, spacing: 0) {
            header(kicker: "02 / CHECK YOUR INBOX",
                   title: "Confirm your email",
                   subtitle: "We sent a confirmation link to:")
                .padding(.bottom, 24)

            Text(pendingAddress)
                .font(ACXFont.monoBold(16))
                .foregroundStyle(ACXColor.ink)
                .textSelection(.enabled)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(Rectangle().stroke(ACXColor.surface, lineWidth: 1))

            Text("Open the link on this device and you'll land straight back here, signed in.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 20)

            resendRow
                .padding(.top, 28)

            Hairline()
                .padding(.top, 28)

            // The escape hatch. Without it this screen is a trap for anyone who
            // mistyped their address or already had an account.
            VStack(alignment: .leading, spacing: 8) {
                Button("Use a different email") {
                    phase = .form
                    resendState = .idle
                    focused = .email
                }
                .buttonStyle(GhostButtonStyle())

                Button(action: onSignIn) {
                    Text("← BACK TO SIGN IN")
                        .font(ACXFont.bodySemibold(15))
                        .kerning(1.0)
                        .foregroundStyle(ACXColor.ink)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
            }
            .padding(.top, 20)
        }
    }

    private var resendRow: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(resendState == .sending ? "Sending…" : "Resend confirmation") {
                Task { await resend() }
            }
            .buttonStyle(GhostButtonStyle())
            .disabled(resendState == .sending)

            switch resendState {
            case .idle, .sending:
                EmptyView()
            case .sent:
                Text("Sent — check your inbox and spam folder.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.ink)
            case .throttled:
                Text("Too many requests — wait a minute, then try again.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.ink)
            case .failed(let message):
                Text(message)
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.error)
                    .accessibilityLabel("Error: \(message)")
            }
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

    // MARK: - Actions

    private func submit() async {
        guard !submitting, isValid else { return }
        focused = nil
        submitting = true
        duplicate = false
        failure = nil
        let address = AuthValidation.normalized(email)

        switch await auth.signUp(email: address, password: password) {
        case .signedIn:
            // `AuthStore.state` flipped; the root router takes it from here.
            break
        case .confirmationRequired:
            pendingAddress = address
            resendState = .idle
            phase = .checkInbox
        case .duplicateAccount:
            duplicate = true
        case .failed(let message):
            failure = message
        }
        submitting = false
    }

    private func resend() async {
        guard resendState != .sending else { return }
        resendState = .sending
        switch await auth.resendConfirmation(email: pendingAddress) {
        case .sent:        resendState = .sent
        case .rateLimited: resendState = .throttled
        case .failed(let message): resendState = .failed(message)
        }
    }
}

#Preview {
    SignupView(auth: AuthStore(
        supabase: SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "demo"
        )
    ))
}
