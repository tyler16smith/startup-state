import Foundation

@MainActor
final class HouseholdViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var household: HouseholdState?
    @Published private(set) var actionMessage: HouseholdActionMessage?

    private let service: HouseholdService

    init(service: HouseholdService = HouseholdService()) {
        self.service = service
    }

    var canInvite: Bool {
        household?.membership == nil && household?.pendingInvite == nil
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false)
    }

    func invite(name: String, email: String) async {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        guard !trimmedName.isEmpty else {
            actionMessage = HouseholdActionMessage(title: "Invite", message: HouseholdValidationError.emptyName.localizedDescription)
            return
        }

        guard trimmedEmail.contains("@"), trimmedEmail.contains(".") else {
            actionMessage = HouseholdActionMessage(title: "Invite", message: HouseholdValidationError.invalidEmail.localizedDescription)
            return
        }

        await performAction(title: "Invite sent") {
            let response = try await service.createInvite(name: trimmedName, email: trimmedEmail)
            return "\(response.invite.inviteeName) has until \(DateFormatterProvider.fullDate(response.invite.expiresAt)) to accept."
        }
        await refresh()
    }

    func resendInvite() async {
        guard let invite = household?.pendingInvite else { return }
        await performAction(title: "Invite resent") {
            let response = try await service.resendInvite(id: invite.id)
            return "Sent to \(response.invite.inviteeEmail)."
        }
        await refresh()
    }

    func revokeInvite() async {
        guard let invite = household?.pendingInvite else { return }
        await performAction(title: "Invite revoked") {
            try await service.revokeInvite(id: invite.id)
            return "The pending invite was revoked."
        }
        await refresh()
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            household = try await service.load()
            state = .loaded
        } catch {
            state = .error(error)
        }
    }

    private func performAction(title: String, operation: () async throws -> String) async {
        state = .refreshing

        do {
            let message = try await operation()
            actionMessage = HouseholdActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            actionMessage = HouseholdActionMessage(title: title, message: error.localizedDescription)
            state = .loaded
        }
    }
}