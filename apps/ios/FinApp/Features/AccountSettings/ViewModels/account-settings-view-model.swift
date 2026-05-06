import Foundation

@MainActor
final class AccountSettingsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var snapshot: AccountSettingsSnapshot?
    @Published private(set) var actionMessage: AccountSettingsActionMessage?
    @Published private(set) var generatedTwoFactorSecret: TwoFactorSecretResponse?
    @Published private(set) var backupCodes: [String] = []
    @Published private(set) var exportedDataText: String?
    @Published private(set) var checkoutSession: CheckoutSessionResponse?

    private let service: AccountSettingsService
    private let authManager: AuthManager

    init(service: AccountSettingsService = AccountSettingsService()) {
        self.service = service
        authManager = .shared
    }

    var email: String { authManager.session?.email ?? "" }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false)
    }

    func updateProfile(name: String) async throws {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw AccountSettingsValidationError.emptyName }
        let response = try await service.updateProfile(name: trimmedName)
        actionMessage = AccountSettingsActionMessage(title: "Profile updated", message: response.name)
    }

    func applyReferralCode(_ code: String) async {
        let trimmedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedCode.isEmpty else { return }
        await performAction(title: "Referral code") {
            let response = try await service.applyReferralCode(trimmedCode)
            return response.message ?? (response.applied == true ? "Referral applied" : "Referral checked")
        }
        await refresh()
    }

    func createCheckoutSession(plan: String) async -> Bool {
        do {
            checkoutSession = try await service.createCheckoutSession(plan: plan)
            return true
        } catch {
            actionMessage = AccountSettingsActionMessage(title: "Checkout", message: error.localizedDescription)
            return false
        }
    }

    func syncCheckoutSession(sessionId: String) async {
        let trimmedSessionId = sessionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedSessionId.isEmpty else { return }

        await performAction(title: "Checkout sync") {
            let response = try await service.syncCheckoutSession(sessionId: trimmedSessionId)
            return response.displayMessage
        }
        await refresh()
    }

    func createPortalSession() async -> URL? {
        do {
            let response = try await service.createPortalSession()
            return URL(string: response.url)
        } catch {
            actionMessage = AccountSettingsActionMessage(title: "Billing portal", message: error.localizedDescription)
            return nil
        }
    }

    func exportData() async -> Bool {
        do {
            let data = try await service.exportData()
            exportedDataText = data.prettyPrintedJSON
            return true
        } catch {
            actionMessage = AccountSettingsActionMessage(title: "Export", message: error.localizedDescription)
            return false
        }
    }

    func generateTwoFactorSecret() async {
        do {
            generatedTwoFactorSecret = try await service.generateTwoFactorSecret()
        } catch {
            actionMessage = AccountSettingsActionMessage(title: "Two-factor secret", message: error.localizedDescription)
        }
    }

    func enableTwoFactor(token: String) async throws {
        let trimmedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedToken.isEmpty else { throw AccountSettingsValidationError.emptyToken }
        guard let secret = generatedTwoFactorSecret?.secret else { return }
        let response = try await service.enableTwoFactor(secret: secret, token: trimmedToken)
        backupCodes = response.backupCodes
        generatedTwoFactorSecret = nil
        await refresh()
    }

    func disableTwoFactor(password: String) async throws {
        let trimmedPassword = password.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPassword.isEmpty else { throw AccountSettingsValidationError.emptyPassword }
        try await service.disableTwoFactor(password: trimmedPassword)
        actionMessage = AccountSettingsActionMessage(title: "Two-factor disabled", message: "Password verification completed")
        await refresh()
    }

    func deleteAccount(confirmationEmail: String) async throws {
        let trimmedEmail = confirmationEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedEmail.caseInsensitiveCompare(email) == .orderedSame else { throw AccountSettingsValidationError.emailMismatch }
        try await service.deleteAccount(email: trimmedEmail)
        await authManager.signOut()
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    func clearCheckoutSession() {
        checkoutSession = nil
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            snapshot = try await service.load()
            state = .loaded
        } catch {
            state = .error(error)
        }
    }

    private func performAction(title: String, operation: () async throws -> String) async {
        state = .refreshing

        do {
            let message = try await operation()
            actionMessage = AccountSettingsActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            actionMessage = AccountSettingsActionMessage(title: title, message: error.localizedDescription)
            state = .loaded
        }
    }
}

private extension JSONValue {
    var prettyPrintedJSON: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        guard let data = try? encoder.encode(self),
              let text = String(data: data, encoding: .utf8)
        else {
            return displayValue
        }

        return text
    }

    var exportSummary: String {
        guard let object = objectValue else { return displayValue }
        let auth = object["auth"]?.objectValue
        let household = object["household"]?.objectValue
        let mcp = object["mcp"]?.objectValue

        let accounts = auth?["accounts"]?.arrayValue?.count ?? 0
        let sessions = auth?["sessions"]?.arrayValue?.count ?? 0
        let memberships = household?["memberships"]?.arrayValue?.count ?? 0
        let tokens = mcp?["personalAccessTokens"]?.arrayValue?.count ?? 0

        return "\(accounts) auth accounts, \(sessions) sessions, \(memberships) household memberships, \(tokens) MCP tokens"
    }
}