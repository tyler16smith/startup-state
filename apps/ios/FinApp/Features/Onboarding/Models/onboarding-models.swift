import Foundation

struct OnboardingData: Decodable, Equatable {
    let hasCompletedInitialOnboarding: Bool
}

struct OnboardingSuccessResponse: Decodable, Equatable {
    let success: Bool
}
