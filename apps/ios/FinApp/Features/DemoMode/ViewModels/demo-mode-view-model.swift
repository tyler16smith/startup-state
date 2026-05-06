import Foundation

@MainActor
final class DemoModeViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var status: DemoModeStatus?
    @Published private(set) var actionMessage: DemoModeActionMessage?

    private let service: DemoModeService

    init(service: DemoModeService = DemoModeService()) {
        self.service = service
    }

    var storedSessionKey: String? { get async { await service.storedSessionKey } }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false)
    }

    func enterDemoMode() async {
        await performAction(title: "Demo mode started") {
            let response = try await service.enterDemoMode()
            return "Expires \(DateFormatterProvider.fullDate(response.expiresAt))"
        }
        await refresh()
    }

    func exitDemoMode() async {
        await performAction(title: "Demo mode ended") {
            try await service.exitDemoMode()
            return "Live account context restored"
        }
        await refresh()
    }

    func resetDemoOverlay() async {
        await performAction(title: "Demo reset") {
            try await service.resetDemoOverlay()
            return "Demo changes cleared"
        }
        await refresh()
    }

    func dismissNotice() async {
        await performAction(title: "Notice dismissed") {
            try await service.dismissNotice()
            return "Demo notice will stay dismissed"
        }
        await refresh()
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            status = try await service.getStatus()
            state = .loaded
        } catch {
            state = .error(error)
        }
    }

    private func performAction(title: String, operation: () async throws -> String) async {
        state = .refreshing

        do {
            let message = try await operation()
            actionMessage = DemoModeActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            actionMessage = DemoModeActionMessage(title: title, message: error.localizedDescription)
            state = .loaded
        }
    }
}