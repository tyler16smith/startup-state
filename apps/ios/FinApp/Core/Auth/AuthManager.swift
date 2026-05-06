import Foundation
import Combine
import UIKit

/// Manages authentication state and token lifecycle
@MainActor
final class AuthManager: ObservableObject {
    
    // MARK: - Published State
    
    @Published private(set) var state: AuthState = .loading
    @Published private(set) var session: Session?
    
    // MARK: - Dependencies
    
    private let credentialsStore: CredentialsStore
    private let apiClient: APIClient
    private var pendingTwoFactorRequest: AuthExchangeRequest?
    private var pendingTwoFactorEmail: String?
    
    // MARK: - Singleton
    
    static let shared = AuthManager()
    
    private init(
        credentialsStore: CredentialsStore = .shared,
        apiClient: APIClient = .shared
    ) {
        self.credentialsStore = credentialsStore
        self.apiClient = apiClient
    }
    
    // MARK: - Bootstrap
    
    /// Initializes auth state from stored credentials
    func bootstrap() async {
        state = .loading
        
        guard let storedSession = credentialsStore.loadSession() else {
            state = .signedOut
            return
        }
        
        // If token is expired or expiring soon, try to refresh
        if storedSession.isExpired || storedSession.expiresSoon {
            do {
                try await refreshToken(using: storedSession.refreshToken)
            } catch {
                // Refresh failed, clear session and require re-login
                credentialsStore.clearSession()
                state = .signedOut
            }
        } else {
            // Token is still valid
            session = storedSession
            state = .signedIn
        }
    }
    
    // MARK: - Sign In
    
    /// Signs in with email and password credentials
    func signIn(email: String, password: String) async throws {
        state = .loading
        
        do {
            let request = AuthExchangeRequest(type: "credentials", email: email, password: password)
            try await exchange(request, emailForSession: email)
        } catch {
            if !AuthError.isTwoFactorRequired(error) {
                state = .error(error)
            }
            throw error
        }
    }

    // MARK: - Registration

    func register(name: String, email: String, password: String, referralCode: String?) async throws {
        state = .loading

        do {
            let request = AuthRegisterRequest(
                name: name,
                email: email,
                password: password,
                referralCode: referralCode.nilIfBlank
            )
            let _: AuthRegisterResponse = try await apiClient.post(
                endpoint: .authRegister,
                body: request,
                authenticated: false
            )

            try await signIn(email: email, password: password)
        } catch {
            if !AuthError.isTwoFactorRequired(error) {
                state = .error(error)
            }
            throw error
        }
    }
    
    // MARK: - Sign In with Google
    
    /// Signs in with Google using ASWebAuthenticationSession with PKCE
    func signInWithGoogle() async throws {
        state = .loading
        
        do {
            // Get ID token from Google (PKCE flow handles token exchange locally)
            let googleResult = try await GoogleSignInManager.shared.signIn()
            
            // Send ID token to API for verification and session creation
            let request = AuthExchangeRequest(type: "google", idToken: googleResult.idToken)
            try await exchange(request, emailForSession: nil)
        } catch {
            if !AuthError.isTwoFactorRequired(error) {
                state = .error(error)
            }
            throw error
        }
    }

    func signInWithApple(idToken: String, name: String?) async throws {
        state = .loading

        do {
            let request = AuthExchangeRequest(type: "apple", idToken: idToken, name: name)
            try await exchange(request, emailForSession: nil)
        } catch {
            if !AuthError.isTwoFactorRequired(error) {
                state = .error(error)
            }
            throw error
        }
    }

    // MARK: - Two-Factor Challenge

    func verifyTwoFactor(token: String) async throws {
        guard let pendingTwoFactorRequest else {
            throw AuthError.noPendingTwoFactorChallenge
        }

        state = .loading

        do {
            let request = pendingTwoFactorRequest.withTwoFactorToken(token)
            try await exchange(request, emailForSession: pendingTwoFactorEmail)
        } catch {
            if !AuthError.isTwoFactorRequired(error) {
                state = .requiresTwoFactor(
                    AuthChallenge(
                        userId: pendingTwoFactorRequest.challengeUserId ?? "",
                        message: "Enter the current code from your authenticator app."
                    )
                )
            }
            throw error
        }
    }

    func cancelTwoFactorChallenge() {
        pendingTwoFactorRequest = nil
        pendingTwoFactorEmail = nil
        state = .signedOut
    }
    
    // MARK: - Sign Out
    
    /// Signs out the current user and clears credentials
    func signOut() async {
        // Attempt to revoke token on server (best effort)
        if let currentSession = session {
            do {
                let request = AuthRevokeRequest(refreshToken: currentSession.refreshToken)
                let _: EmptyResponse = try await apiClient.post(
                    endpoint: .authRevoke,
                    body: request,
                    authenticated: true
                )
            } catch {
                // Ignore revoke errors, proceed with local logout
                AppLogger.warn("Token revoke failed", metadata: ["operation": "auth.revoke"])
            }
        }
        
        credentialsStore.clearSession()
        session = nil
        pendingTwoFactorRequest = nil
        pendingTwoFactorEmail = nil
        state = .signedOut
    }
    
    // MARK: - Token Refresh
    
    /// Refreshes the access token using the refresh token
    func refreshToken(using refreshToken: String? = nil) async throws {
        let tokenToUse = refreshToken ?? session?.refreshToken
        
        guard let token = tokenToUse else {
            throw AuthError.noRefreshToken
        }
        
        let request = AuthRefreshRequest(refreshToken: token)
        let response: AuthTokenResponse = try await apiClient.post(
            endpoint: .authRefresh,
            body: request,
            authenticated: false
        )
        
        let newSession = Session(from: response, email: session?.email)
        try credentialsStore.saveSession(newSession)
        session = newSession
        state = .signedIn
    }
    
    // MARK: - Token Access
    
    /// Returns a valid access token, refreshing if necessary
    func getValidAccessToken() async throws -> String {
        guard let currentSession = session else {
            throw AuthError.notAuthenticated
        }
        
        if currentSession.isExpired || currentSession.expiresSoon {
            try await refreshToken()
        }
        
        guard let validSession = session else {
            throw AuthError.notAuthenticated
        }
        
        return validSession.accessToken
    }

    private func exchange(_ request: AuthExchangeRequest, emailForSession: String?) async throws {
        let response: AuthExchangeResponse = try await apiClient.post(
            endpoint: .authExchange,
            body: request.withDeviceInfo(Self.deviceInfo),
            authenticated: false
        )

        switch response {
        case .token(let tokenResponse):
            let newSession = Session(from: tokenResponse, email: emailForSession ?? tokenResponse.email)
            try credentialsStore.saveSession(newSession)
            session = newSession
            pendingTwoFactorRequest = nil
            pendingTwoFactorEmail = nil
            state = .signedIn
        case .requiresTwoFactor(let challenge):
            pendingTwoFactorRequest = request.withChallengeUserId(challenge.userId)
            pendingTwoFactorEmail = emailForSession
            state = .requiresTwoFactor(challenge)
            throw AuthError.twoFactorRequired
        }
    }

    private static var deviceInfo: String {
        "iOS \(UIDevice.current.systemVersion) (\(UIDevice.current.model))"
    }
}

// MARK: - Auth State

enum AuthState: Equatable {
    case loading
    case signedOut
    case signedIn
    case requiresTwoFactor(AuthChallenge)
    case error(Error)
    
    static func == (lhs: AuthState, rhs: AuthState) -> Bool {
        switch (lhs, rhs) {
        case (.loading, .loading): return true
        case (.signedOut, .signedOut): return true
        case (.signedIn, .signedIn): return true
        case (.requiresTwoFactor, .requiresTwoFactor): return true
        case (.error, .error): return true
        default: return false
        }
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError, Equatable {
    case notAuthenticated
    case noRefreshToken
    case invalidCredentials
    case twoFactorRequired
    case noPendingTwoFactorChallenge
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Not authenticated. Please sign in."
        case .noRefreshToken:
            return "No refresh token available."
        case .invalidCredentials:
            return "Invalid email or password."
        case .twoFactorRequired:
            return "Two-factor verification required."
        case .noPendingTwoFactorChallenge:
            return "No two-factor challenge is active. Please sign in again."
        }
    }

    static func isTwoFactorRequired(_ error: Error) -> Bool {
        guard let authError = error as? AuthError else { return false }
        return authError == .twoFactorRequired
    }
}

// MARK: - Request/Response Types

struct AuthExchangeRequest: Encodable {
    let type: String
    let email: String?
    let password: String?
    let idToken: String?
    let name: String?
    let authCode: String?
    let redirectUri: String?
    let twoFactorToken: String?
    let deviceInfo: String?
    let challengeUserId: String?
    
    init(
        type: String,
        email: String? = nil,
        password: String? = nil,
        idToken: String? = nil,
        name: String? = nil,
        authCode: String? = nil,
        redirectUri: String? = nil,
        twoFactorToken: String? = nil,
        deviceInfo: String? = nil,
        challengeUserId: String? = nil
    ) {
        self.type = type
        self.email = email
        self.password = password
        self.idToken = idToken
        self.name = name
        self.authCode = authCode
        self.redirectUri = redirectUri
        self.twoFactorToken = twoFactorToken
        self.deviceInfo = deviceInfo
        self.challengeUserId = challengeUserId
    }

    func withTwoFactorToken(_ token: String) -> AuthExchangeRequest {
        AuthExchangeRequest(
            type: type,
            email: email,
            password: password,
            idToken: idToken,
            name: name,
            authCode: authCode,
            redirectUri: redirectUri,
            twoFactorToken: token,
            deviceInfo: deviceInfo,
            challengeUserId: challengeUserId
        )
    }

    func withDeviceInfo(_ deviceInfo: String) -> AuthExchangeRequest {
        AuthExchangeRequest(
            type: type,
            email: email,
            password: password,
            idToken: idToken,
            name: name,
            authCode: authCode,
            redirectUri: redirectUri,
            twoFactorToken: twoFactorToken,
            deviceInfo: deviceInfo,
            challengeUserId: challengeUserId
        )
    }

    func withChallengeUserId(_ userId: String) -> AuthExchangeRequest {
        AuthExchangeRequest(
            type: type,
            email: email,
            password: password,
            idToken: idToken,
            name: name,
            authCode: authCode,
            redirectUri: redirectUri,
            twoFactorToken: twoFactorToken,
            deviceInfo: deviceInfo,
            challengeUserId: userId
        )
    }

    enum CodingKeys: String, CodingKey {
        case type
        case email
        case password
        case idToken
        case name
        case authCode
        case redirectUri
        case twoFactorToken
        case deviceInfo
    }
}

struct AuthRegisterRequest: Encodable {
    let name: String
    let email: String
    let password: String
    let referralCode: String?
}

struct AuthRegisterResponse: Decodable {
    let id: String
    let email: String
    let name: String
}

struct AuthRefreshRequest: Encodable {
    let refreshToken: String
}

struct AuthRevokeRequest: Encodable {
    let refreshToken: String
}

struct AuthTokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int // Seconds until access token expires
    let refreshExpiresIn: Int?
    let tokenType: String?
    let user: AuthUserResponse?
    
    struct AuthUserResponse: Decodable {
        let id: String
        let email: String?
    }
    
    /// Convenience property to get email from user object
    var email: String? {
        user?.email
    }
    
    /// Calculates the expiration date from expiresIn
    var expiresAt: Date {
        Date().addingTimeInterval(TimeInterval(expiresIn))
    }
}

struct AuthChallenge: Decodable, Equatable {
    let userId: String
    let message: String
}

enum AuthExchangeResponse: Decodable {
    case token(AuthTokenResponse)
    case requiresTwoFactor(AuthChallenge)

    private enum CodingKeys: String, CodingKey {
        case requires2FA
        case userId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if (try? container.decode(Bool.self, forKey: .requires2FA)) == true {
            let userId = try container.decode(String.self, forKey: .userId)
            let message = (try? container.decode(String.self, forKey: .message)) ?? "2FA verification required"
            self = .requiresTwoFactor(AuthChallenge(userId: userId, message: message))
            return
        }

        self = .token(try AuthTokenResponse(from: decoder))
    }
}

struct EmptyResponse: Decodable {}

private extension Optional where Wrapped == String {
    var nilIfBlank: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }

        return value
    }
}
