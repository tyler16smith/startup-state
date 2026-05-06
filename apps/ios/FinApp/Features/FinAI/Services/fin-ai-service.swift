import Foundation

actor FinAIService {
    private let apiClient: APIClient
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder = JSONEncoder()

    init(apiClient: APIClient = .shared, session: URLSession = .shared) {
        self.apiClient = apiClient
        self.session = session
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            let fractionalFormatter = ISO8601DateFormatter()
            fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = fractionalFormatter.date(from: dateString) { return date }
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dateString) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date format: \(dateString)")
        }
    }

    func listConversations(limit: Int = 30) async throws -> [FinAIConversation] {
        let response: FinAIConversationListResponse = try await apiClient.post(
            path: "/api/v1/agent/listConversations",
            body: .object(["limit": .number(Double(limit))])
        )
        return response.conversations
    }

    func createConversation(title: String?) async throws -> FinAIConversation {
        var body: [String: JSONValue] = [:]
        if let title = title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty {
            body["title"] = .string(title)
        }

        let response: FinAIConversationResponse = try await apiClient.post(
            path: "/api/v1/agent/createConversation",
            body: .object(body)
        )
        return response.conversation
    }

    func renameConversation(id: String, title: String) async throws -> FinAIConversation {
        let response: FinAIConversationResponse = try await apiClient.post(
            path: "/api/v1/agent/renameConversation",
            body: .object([
                "conversationId": .string(id),
                "title": .string(title)
            ])
        )
        return response.conversation
    }

    func listMessages(conversationId: String, limit: Int = 100) async throws -> [FinAIMessage] {
        let response: FinAIMessageListResponse = try await apiClient.post(
            path: "/api/v1/agent/listMessages",
            body: .object([
                "conversationId": .string(conversationId),
                "limit": .number(Double(limit))
            ])
        )
        return response.messages
    }

    func listTimeline(conversationId: String, limit: Int = 200) async throws -> [FinAITimelineBlock] {
        let response: FinAITimelineResponse = try await apiClient.post(
            path: "/api/v1/agent/listTimeline",
            body: .object([
                "conversationId": .string(conversationId),
                "limit": .number(Double(limit))
            ])
        )
        return response.blocks
    }

    func streamMessage(
        conversationId: String?,
        message: String,
        onEvent: @escaping @Sendable (FinAIStreamEvent) async -> Void
    ) async throws {
        var body: [String: JSONValue] = [
            "message": .string(message),
            "clientRequestId": .string(UUID().uuidString),
            "clientContext": .object([
                "currentRoute": .string("/ios/agent"),
                "activePage": .string("ios_agent")
            ])
        ]
        if let conversationId { body["conversationId"] = .string(conversationId) }

        let url = URL(string: "/api/v1/agent/chat/stream", relativeTo: Environment.apiBaseURL)!.absoluteURL
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("FinApp-iOS/\(Environment.appVersion)", forHTTPHeaderField: "User-Agent")
        if let sessionKey = UserDefaults.standard.string(forKey: DemoModeDefaults.sessionKey), !sessionKey.isEmpty {
            request.setValue("demo", forHTTPHeaderField: "x-active-app-context")
            request.setValue(sessionKey, forHTTPHeaderField: "x-demo-overlay-session-key")
            if let accessToken = try? await AuthManager.shared.getValidAccessToken() {
                request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            }
        } else {
            let accessToken = try await AuthManager.shared.getValidAccessToken()
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try encoder.encode(JSONValue.object(body))

        let (bytes, response) = try await session.bytes(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw FinAIServiceError.invalidResponse }
        guard (200...299).contains(httpResponse.statusCode) else { throw FinAIServiceError.httpStatus(httpResponse.statusCode) }

        for try await line in bytes.lines {
            if Task.isCancelled { throw CancellationError() }
            guard line.hasPrefix("data:") else { continue }
            let payload = line.dropFirst(5).trimmingCharacters(in: .whitespacesAndNewlines)
            guard let data = payload.data(using: .utf8), !data.isEmpty else { continue }
            let event = try decoder.decode(FinAIStreamEvent.self, from: data)
            await onEvent(event)
        }
    }
}

enum FinAIServiceError: LocalizedError {
    case invalidResponse
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Agent returned an invalid response."
        case .httpStatus(let status):
            return "Agent request failed with status \(status)."
        }
    }
}