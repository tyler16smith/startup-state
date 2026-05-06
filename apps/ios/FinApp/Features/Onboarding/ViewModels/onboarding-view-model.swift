import Foundation

@MainActor
final class OnboardingViewModel: ObservableObject {
    enum ViewState {
        case idle
        case saving
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var completed = false

    private let service: OnboardingService

    init(service: OnboardingService = OnboardingService()) {
        self.service = service
    }

    var isBusy: Bool {
        if case .saving = state { return true }
        return false
    }

    func complete() async {
        state = .saving
        do {
            try await service.complete()
            completed = true
            state = .idle
        } catch {
            state = .error(error)
        }
    }

    func retryAfterError() {
        state = .idle
    }
}
