import Foundation

/// Represents the user's authentication session
struct Session: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
    let userId: String?
    let email: String?
    
    /// Whether the access token has expired
    var isExpired: Bool {
        Date() >= expiresAt
    }
    
    /// Whether the access token will expire soon (within 5 minutes)
    var expiresSoon: Bool {
        Date().addingTimeInterval(300) >= expiresAt
    }
}

// MARK: - API Response Mapping

extension Session {
    /// Creates a Session from the API auth exchange response
    init(from response: AuthTokenResponse, email: String? = nil) {
        self.accessToken = response.accessToken
        self.refreshToken = response.refreshToken
        self.expiresAt = response.expiresAt
        self.userId = response.user?.id
        self.email = email ?? response.email
    }
}
