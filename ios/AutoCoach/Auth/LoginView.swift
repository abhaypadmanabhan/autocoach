import SwiftUI
import Supabase

/// Email + password sign-in (M2). One primary CTA (accent + hard shadow), zero
/// radii, cream ground, mono kickers. No OAuth, no signup polish.
struct LoginView: View {
    let auth: AuthStore

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var signingIn = false
    @FocusState private var focused: Field?

    private enum Field { case email, password }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.bottom, 40)

                VStack(alignment: .leading, spacing: 20) {
                    ACXField(label: "EMAIL", text: $email, placeholder: "you@example.com",
                             keyboardType: .emailAddress, textContentType: .emailAddress,
                             isSecure: false)
                        .focused($focused, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focused = .password }

                    ACXField(label: "PASSWORD", text: $password, placeholder: "••••••••",
                             keyboardType: .default, textContentType: .password,
                             isSecure: true)
                        .focused($focused, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { Task { await submit() } }
                }

                if let err = auth.signInErrorMessage {
                    Text(err)
                        .font(ACXFont.mono(12))
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
                .disabled(signingIn)
                .padding(.top, 28)

                Spacer(minLength: 24)

                Text("Docs you've uploaded on the web appear here once you sign in.")
                    .font(ACXFont.mono(11))
                    .foregroundStyle(ACXColor.muted)
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
        guard !signingIn else { return }
        signingIn = true
        await auth.signIn(email: email, password: password)
        signingIn = false
    }
}

/// Brutalist form field — zero radius, ink hairline underline, mono label.
struct ACXField: View {
    let label: String
    @Binding var text: String
    let placeholder: String
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType = .name
    var isSecure: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(ACXFont.monoBold(11))
                .kerning(1.2)
                .foregroundStyle(ACXColor.muted)
            field
                .font(ACXFont.body(16))
                .foregroundStyle(ACXColor.ink)
                .padding(.vertical, 10)
                .overlay(alignment: .bottom) { Hairline() }
        }
    }

    /// Apply `textContentType` on the concrete field types (applying it on a
    /// `Group` of two different field types fails to type-check).
    @ViewBuilder
    private var field: some View {
        if isSecure {
            SecureField(placeholder, text: $text)
                .textContentType(textContentType)
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
