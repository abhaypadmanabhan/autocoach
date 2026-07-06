import Foundation

/// Build-time configuration resolved from `Config.xcconfig` → `Info.plist`.
///
/// `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` are injected via `$(...)` in the
/// generated `Info.plist`. In a fresh clone without `Config.xcconfig` those
/// variables resolve to the empty string (or stay as the literal `$(…)`) — both
/// cases are treated as "not configured" and the app surfaces a config-missing
/// screen instead of crashing. The backend base URL has a hard-coded public
/// fallback (it is not a secret — it is the public Railway endpoint).
enum AppConfig {
    /// True only when both Supabase values are present and resolved.
    static var isConfigured: Bool { supabaseURL != nil && supabaseKey != nil }

    static let supabaseURL: URL? = resolvedURL(forKey: "SUPABASE_URL")
    static let supabaseKey: String? = resolvedString(forKey: "SUPABASE_PUBLISHABLE_KEY")

    static let backendBaseURL: URL = {
        let raw = resolvedString(forKey: "BACKEND_BASE_URL")
        if let raw, let url = URL(string: raw), url.scheme?.hasPrefix("http") == true {
            return url
        }
        return URL(string: "https://autocoach-production.up.railway.app")!
    }()

    /// Reads an Info.plist string; rejects empty values and unresolved `$(…)`.
    private static func resolvedString(forKey key: String) -> String? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
            return nil
        }
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty || trimmed.hasPrefix("$(") { return nil }
        return trimmed
    }

    /// Reads an Info.plist string that must be an http(s) URL.
    private static func resolvedURL(forKey key: String) -> URL? {
        guard let raw = resolvedString(forKey: key) else { return nil }
        guard let url = URL(string: raw), url.scheme?.hasPrefix("http") == true else { return nil }
        return url
    }
}
