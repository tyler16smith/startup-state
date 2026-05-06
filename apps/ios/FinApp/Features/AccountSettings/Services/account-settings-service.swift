import Foundation

actor AccountSettingsService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load() async throws -> AccountSettingsSnapshot {
        async let billingStatus = getBillingStatus()
        async let billingPlans = getBillingPlans()
        async let twoFactorStatus = getTwoFactorStatus()
        return try await AccountSettingsSnapshot(
            billingStatus: billingStatus,
            billingPlans: billingPlans,
            twoFactorStatus: twoFactorStatus
        )
    }

    func updateProfile(name: String) async throws -> ProfileUpdateResponse {
        try await apiClient.post(
            path: "/api/v1/account/updateProfile",
            body: .object(["name": .string(name)])
        )
    }

    func exportData() async throws -> JSONValue {
        try await apiClient.get(path: "/api/v1/account/exportData")
    }

    func deleteAccount(email: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/account/deleteAccount",
            body: .object([
                "email": .string(email),
                "confirmation": .bool(true)
            ])
        )
    }

    func getBillingStatus() async throws -> BillingStatus {
        try await apiClient.get(path: "/api/v1/billing/getStatus")
    }

    func getBillingPlans() async throws -> [BillingPlan] {
        let response: BillingPlanListResponse = try await apiClient.get(path: "/api/v1/billing/getPlans")
        return response.plans
    }

    func applyReferralCode(_ code: String) async throws -> ReferralApplyResponse {
        try await apiClient.post(
            path: "/api/v1/billing/applyReferralCode",
            body: .object(["referralCode": .string(code)])
        )
    }

    func createCheckoutSession(plan: String) async throws -> CheckoutSessionResponse {
        try await apiClient.post(
            path: "/api/v1/billing/createCheckoutSession",
            body: .object(["plan": .string(plan)])
        )
    }

    func syncCheckoutSession(sessionId: String) async throws -> CheckoutSessionSyncResponse {
        try await apiClient.post(
            path: "/api/v1/billing/syncCheckoutSession",
            body: .object(["sessionId": .string(sessionId)])
        )
    }

    func createPortalSession() async throws -> BillingPortalResponse {
        try await apiClient.post(path: "/api/v1/billing/createPortalSession")
    }

    func getTwoFactorStatus() async throws -> TwoFactorStatus {
        try await apiClient.get(path: "/api/v1/twoFactor/getStatus")
    }

    func generateTwoFactorSecret() async throws -> TwoFactorSecretResponse {
        try await apiClient.post(path: "/api/v1/twoFactor/generateSecret")
    }

    func enableTwoFactor(secret: String, token: String) async throws -> TwoFactorEnableResponse {
        try await apiClient.post(
            path: "/api/v1/twoFactor/enable",
            body: .object([
                "secret": .string(secret),
                "token": .string(token)
            ])
        )
    }

    func disableTwoFactor(password: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/twoFactor/disable",
            body: .object(["password": .string(password)])
        )
    }
}