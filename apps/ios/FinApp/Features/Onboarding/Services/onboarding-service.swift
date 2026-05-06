import Foundation

actor OnboardingService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func shouldShowOnboarding() async throws -> Bool {
        let data = try await loadSavedData()
        return !data.hasCompletedInitialOnboarding
    }

    func loadSavedData() async throws -> OnboardingData {
        try await apiClient.get(path: "/api/v1/onboarding/getOnboardingData")
    }

    func complete() async throws {
        let _: OnboardingSuccessResponse = try await apiClient.post(
            path: "/api/v1/onboarding/completeInitialOnboarding",
            body: .object(["acknowledged": .bool(true)])
        )
    }
}
