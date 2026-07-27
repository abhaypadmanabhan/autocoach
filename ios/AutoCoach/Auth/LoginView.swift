import SwiftUI
import Supabase

/// Email + password sign-in. One primary CTA (accent + hard shadow), zero radii,
/// cream ground, mono kickers.
///
/// The two callbacks default to no-ops so the existing `AppRoot` call site
/// (`LoginView(auth:)`) keeps compiling; `AuthFlowView` supplies real routes.
struct LoginView: View {
    let auth: AuthStore
    var onForgotPassword: () -> Void = {}
    var onSignUp: () -> Void = {}

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var signingIn = false
    /// Populated on blur only — never on keystroke. Typing a valid email one
    /// character at a time otherwise means being told it is malformed six times.
    @State private var emailProblem: String?
    @FocusState private var focused: Field?

    private enum Field { case email, password }

    private var isValid: Bool { AuthValidation.isValidLogin(email: email, password: password) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.bottom, 40)

                VStack(alignment: .leading, spacing: 20) {
                    ACXField(label: "EMAIL", text: $email, placeholder: "you@example.com",
                             keyboardType: .emailAddress, textContentType: .emailAddress,
                             isSecure: false, problem: emailProblem)
                        .focused($focused, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focused = .password }

                    ACXField(label: "PASSWORD", text: $password, placeholder: "••••••••",
                             keyboardType: .default, textContentType: .password,
                             isSecure: true, revealToggle: true)
                        .focused($focused, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { Task { await submit() } }
                }
                .onChange(of: focused) { previous, _ in
                    if previous == .email { emailProblem = AuthValidation.emailProblem(email) }
                }

                if let err = auth.signInErrorMessage {
                    Text(err)
                        .font(ACXFont.mono(13))
                        .foregroundStyle(ACXColor.error)
                        .padding(.top, 16)
                        .accessibilityLabel("Error: \(err)")
                }

                Button {
                    Task { await submit() }
                } label: {
                    Text(signingIn ? "SIGNING IN…" : "SIGN IN")
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(signingIn || !isValid)
                .opacity(isValid ? 1 : 0.45)
                .padding(.top, 28)

                Button("FORGOT YOUR PASSWORD?", action: onForgotPassword)
                    .font(ACXFont.monoBold(13))
                    .kerning(1.0)
                    .foregroundStyle(ACXColor.ink)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .padding(.top, 12)

                Spacer(minLength: 24)

                Hairline()
                Button(action: onSignUp) {
                    Text("NO ACCOUNT YET? → CREATE ONE")
                        .font(ACXFont.monoBold(13))
                        .kerning(1.0)
                        .foregroundStyle(ACXColor.ink)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                }
                .padding(.top, 12)
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
        }
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
        .onAppear { focused = .email }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker("01 / SIGN IN")
            Hairline()
            Text("AutoCoach")
                .font(ACXFont.display(34))
                .foregroundStyle(ACXColor.ink)
                .padding(.top, 6)
            Text("Adaptive quizzes from your own documents.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
        }
        .padding(.top, 24)
    }

    private func submit() async {
        guard !signingIn, isValid else { return }
        focused = nil
        signingIn = true
        await auth.signIn(email: email, password: password)
        signingIn = false
    }
}

/// Brutalist form field — zero radius, ink hairline underline, mono label.
///
/// `revealToggle` renders a mono `SHOW` / `HIDE` word rather than an eye glyph:
/// the glyph is ambiguous (does the open eye mean "currently visible" or "tap to
/// reveal"?) and it is one of the flagged generated-UI tells. The word says which.
///
/// `problem` is rendered by the field but *decided* by the parent, because the
/// house rule is validate-on-blur: a field cannot know when focus left it, so the
/// owning form drives the message and this only draws it.
struct ACXField: View {
    let label: String
    @Binding var text: String
    let placeholder: String
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType = .name
    var isSecure: Bool = false
    /// Adds the mono SHOW/HIDE control. Only meaningful when `isSecure`.
    var revealToggle: Bool = false
    /// Validation message; shown only once the parent decides the field blurred.
    var problem: String?

    @State private var revealed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(ACXFont.monoBold(11))
                    .kerning(1.2)
                    .foregroundStyle(ACXColor.muted)
                if isSecure && revealToggle {
                    Spacer(minLength: 12)
                    Button(revealed ? "HIDE" : "SHOW") { revealed.toggle() }
                        .font(ACXFont.monoBold(11))
                        .kerning(1.2)
                        .foregroundStyle(ACXColor.ink)
                        .frame(minWidth: 44, minHeight: 44, alignment: .trailing)
                        .accessibilityLabel(revealed ? "Hide password" : "Show password")
                }
            }
            .frame(minHeight: isSecure && revealToggle ? 44 : 0)

            field
                .font(ACXFont.body(16))
                .foregroundStyle(ACXColor.ink)
                .padding(.vertical, 10)
                .frame(minHeight: 44)
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(problem == nil ? ACXColor.surface : ACXColor.error)
                        .frame(height: problem == nil ? 1 : 2)
                }

            if let problem {
                Text(problem)
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.error)
                    .accessibilityLabel("\(label) error: \(problem)")
            }
        }
    }

    /// Apply `textContentType` on the concrete field types (applying it on a
    /// `Group` of two different field types fails to type-check).
    @ViewBuilder
    private var field: some View {
        if isSecure && !revealed {
            SecureField(placeholder, text: $text)
                .textContentType(textContentType)
        } else if isSecure {
            // Revealed password: a plain TextField, with autocorrect off so iOS
            // does not "fix" the password while it is visible.
            TextField(placeholder, text: $text)
                .textContentType(textContentType)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
        } else {
            TextField(placeholder, text: $text)
                .keyboardType(keyboardType)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
                .textContentType(textContentType)
        }
    }
}

#Preview {
    LoginView(auth: AuthStore(
        supabase: SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "demo"
        )
    ))
}
