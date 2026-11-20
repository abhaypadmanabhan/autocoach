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
        // Same host requirement as `resolvedURL` — a hostless `https:` would
        // otherwise become the base URL and every request would build a
        // malformed URL.
        if let url = resolvedURL(forKey: "BACKEND_BASE_URL") {
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

    /// Reads an Info.plist string that must be an http(s) URL **with a host**.
    ///
    /// The host check is load-bearing: xcconfig treats `//` as a comment, so a
    /// value written `https://host` truncates to `https:` — which is a perfectly
    /// valid `URL` with an `https` scheme and no host. That slipped through the
    /// scheme-only check, reported `isConfigured == true`, and crashed inside
    /// `SupabaseClient` ("supabaseURL must have a valid host") instead of showing
    /// the config-missing screen this type exists to guarantee.
    private static func resolvedURL(forKey key: String) -> URL? {
        guard let raw = resolvedString(forKey: key) else { return nil }
        guard let url = URL(string: raw),
              url.scheme?.hasPrefix("http") == true,
              let host = url.host(), !host.isEmpty
        else { return nil }
        return url
    }
}
