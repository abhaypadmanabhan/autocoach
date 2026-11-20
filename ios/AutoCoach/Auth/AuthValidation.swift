import Foundation

/// Shared field validation for the auth lane (PRD §5.2).
///
/// Deliberately permissive on email: the authoritative check is Supabase's, and a
/// client regex that rejects a legitimate address is a worse failure than one that
/// lets a typo through to a server error. This only catches the obviously-wrong
/// shapes so the CTA can stay disabled until the form is plausibly submittable.
enum AuthValidation {
    /// Returns a human-readable problem, or `nil` when the value is acceptable.
    static func emailProblem(_ raw: String) -> String? {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty { return "Enter your email address." }
        // One `@`, something either side, and a dot in the domain.
        let parts = value.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, parts[1].contains("."),
              !parts[1].hasPrefix("."), !parts[1].hasSuffix("."),
              !value.contains(" ")
        else {
            return "That doesn't look like an email address."
        }
        return nil
    }

    static func passwordProblem(_ raw: String) -> String? {
        if raw.isEmpty { return "Enter a password." }
        // Supabase's own default minimum. Kept in sync manually — the SDK does not
        // expose the project's password policy, so a shorter password fails server-side.
        if raw.count < 8 { return "Use at least 8 characters." }
        return nil
    }

    static func isValidSignup(email: String, password: String) -> Bool {
        emailProblem(email) == nil && passwordProblem(password) == nil
    }

    static func isValidLogin(email: String, password: String) -> Bool {
        emailProblem(email) == nil && !password.isEmpty
    }

    static func normalized(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
