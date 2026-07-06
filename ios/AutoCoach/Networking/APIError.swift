import Foundation

/// Typed client error decoding FastAPI's dual-shape `{"detail": <string|object>}`
/// envelope (research §1, 429 table). `detail` may be a plain string (per-minute
/// rate limit, document quota, 401/400/404/500…) or a structured object (the
/// daily quiz quota carries `{error, type, limit, message}`).
enum APIError: Error, Sendable, LocalizedError {
    /// 401 after the one refresh-retry failed; the user has been signed out.
    case unauthorized
    /// 429 with a string `detail` — per-minute quiz limiter or document quota.
    case rateLimited(String)
    /// 429 with an object `detail` — daily quiz quota. Server deletes the
    /// just-created session on this path; treat as "no session created".
    case dailyQuota(limit: Int, message: String)
    /// Any other non-2xx with a string detail.
    case http(status: Int, detail: String)
    /// Body could not be decoded into the expected type.
    case decoding(String)
    /// Transport failure (no network, timeout, DNS…).
    case network(String)
    /// Local config missing (no Supabase URL/key).
    case configMissing(String)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Session expired. Please sign in again."
        case .rateLimited(let m), .http(_, let m), .network(let m), .configMissing(let m), .decoding(let m):
            return m
        case .dailyQuota(_, let m):
            return m
        }
    }

    /// True for errors that the verdict-poll loop must swallow (transient).
    var isTransient: Bool {
        switch self {
        case .rateLimited, .network:
            return true
        case .http(let status, _):
            return status >= 500
        default:
            return false
        }
    }
}

/// Helper decoders for the dual-shape `detail` field.
private struct ErrorEnvelope: Decodable {
    let detail: DetailPayload
}

private enum DetailPayload: Decodable {
    case string(String)
    case object(DailyQuotaDetail)
    case unknown

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { self = .string(s); return }
        if let o = try? c.decode(DailyQuotaDetail.self) { self = .object(o); return }
        self = .unknown
    }
}

private struct DailyQuotaDetail: Decodable {
    let error: String?
    let type: String?
    let limit: Int?
    let message: String?
}

enum APIErrorDecoder {
    /// Build an `APIError` from a non-2xx response body (best-effort).
    static func decode(status: Int, body: Data) -> APIError {
        guard let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: body) else {
            // No JSON body or unrecognised shape — synthesize from status.
            return .http(status: status, detail: fallbackMessage(for: status))
        }
        switch envelope.detail {
        case .string(let s):
            if status == 401 { return .unauthorized }
            if status == 429 { return .rateLimited(s) }
            return .http(status: status, detail: s)
        case .object(let o):
            if status == 429 {
                let msg = o.message ?? "You've reached your daily quiz limit."
                return .dailyQuota(limit: o.limit ?? 0, message: msg)
            }
            return .http(status: status, detail: o.message ?? o.error ?? fallbackMessage(for: status))
        case .unknown:
            return .http(status: status, detail: fallbackMessage(for: status))
        }
    }

    private static func fallbackMessage(for status: Int) -> String {
        switch status {
        case 401: return "Unauthorized"
        case 403: return "Forbidden"
        case 404: return "Not found"
        case 429: return "Rate limit exceeded. Please slow down and try again."
        case 500...599: return "The server had a problem. Please try again."
        default: return "HTTP \(status) error"
        }
    }
}
