import Foundation

actor HouseholdService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load() async throws -> HouseholdState {
        try await apiClient.get(path: "/api/v1/household")
    }

    func createInvite(name: String, email: String) async throws -> HouseholdInviteResponse {
        try await apiClient.post(
            path: "/api/v1/household/invites",
            body: .object([
                "name": .string(name),
                "email": .string(email)
            ])
        )
    }

    func resendInvite(id: String) async throws -> HouseholdInviteResponse {
        try await apiClient.post(
            path: "/api/v1/household/invites/\(id)/resend",
            body: .object(["inviteId": .string(id)])
        )
    }

    func revokeInvite(id: String) async throws {
        let _: HouseholdSuccessResponse = try await apiClient.post(
            path: "/api/v1/household/invites/\(id)/revoke",
            body: .object(["inviteId": .string(id)])
        )
    }
}