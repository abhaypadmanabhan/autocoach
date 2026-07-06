import Foundation
import Supabase

/// Networking actor (research §2 attach pattern + §3 services layer).
///
/// - Attaches `Authorization: Bearer <jwt>` on every call, sourced from
///   `supabase.auth.session` (the SDK refreshes if expired — single source of
///   truth, never a cached stale token).
/// - On a backend **401**: force `refreshSession()` once and retry once; if the
///   retry is still 401, call `signOut()` (clears Keychain) and throw
///   `.unauthorized` — the `authStateChanges` stream then routes to login.
/// - Decodes the dual-shape `{"detail": string|object}` envelope via
///   ``APIErrorDecoder``.
/// - `timeoutIntervalForRequest = 15s` so a 10s server long-poll never trips the
///   client timeout (research §4).
actor APIClient {
    private let supabase: SupabaseClient
    private let baseURL: URL
    private let session: URLSession

    init(supabase: SupabaseClient, baseURL: URL) {
        self.supabase = supabase
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 20
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
    }

    // MARK: - Typed helpers

    /// `GET` a decodable response.
    func get<T: Decodable & Sendable>(
        _ path: String,
        query: [URLQueryItem] = []
    ) async throws -> T {
        try await send(path: path, method: "GET", query: query, body: nil)
    }

    /// `POST` an encodable body, decode the response.
    func post<Req: Encodable & Sendable, T: Decodable & Sendable>(
        _ path: String,
        body: Req,
        query: [URLQueryItem] = []
    ) async throws -> T {
        let data = try JSONEncoder().encode(body)
        return try await send(path: path, method: "POST", query: query, body: data)
    }

    // MARK: - Core

    /// One request, with a single 401 → refresh → retry cycle baked in.
    private func send<T: Decodable & Sendable>(
        path: String,
        method: String,
        query: [URLQueryItem],
        body: Data?
    ) async throws -> T {
        var refreshed = false
        while true {
            let (data, response): (Data, URLResponse)
            do {
                (data, response) = try await perform(path: path, method: method, query: query, body: body)
            } catch let err as URLError {
                throw APIError.network(err.localizedDescription)
            } catch {
                throw APIError.network(error.localizedDescription)
            }
            let http = response as! HTTPURLResponse

            if http.statusCode == 401 {
                if !refreshed {
                    refreshed = true
                    // Defense in depth: the SDK refreshes automatically, but a
                    // backend 401 means our JWT was rejected — force one refresh
                    // and retry the *same* request once.
                    try? await supabase.auth.refreshSession()
                    continue
                }
                // Still 401 after refresh — give up and route to login.
                try? await supabase.auth.signOut()
                throw APIError.unauthorized
            }

            guard (200..<300).contains(http.statusCode) else {
                throw APIErrorDecoder.decode(status: http.statusCode, body: data)
            }

            if data.isEmpty {
                throw APIError.decoding("Empty response body")
            }
            do {
                return try JSONDecoder().decode(T.self, from: data)
            } catch {
                throw APIError.decoding("Could not decode response: \(error.localizedDescription)")
            }
        }
    }

    /// Build + fire one URLRequest with the bearer attached.
    private func perform(
        path: String,
        method: String,
        query: [URLQueryItem],
        body: Data?
    ) async throws -> (Data, URLResponse) {
        var components = URLComponents()
        components.scheme = baseURL.scheme
        components.host = baseURL.host
        components.port = baseURL.port
        // baseURL may carry a path (e.g. trailing component); join safely.
        let base = baseURL.path.hasSuffix("/") ? String(baseURL.path.dropLast()) : baseURL.path
        components.path = base + path
        if !query.isEmpty { components.queryItems = query }

        guard let url = components.url else {
            throw APIError.configMissing("Invalid backend URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }

        // Attach bearer from the live session (SDK refreshes if expired).
        if let session = try? await supabase.auth.session {
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        }

        return try await session.data(for: request)
    }
}
