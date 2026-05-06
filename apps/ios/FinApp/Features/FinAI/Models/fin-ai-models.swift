import Foundation

struct FinAIConversation: Decodable, Identifiable, Equatable {
    let id: String
    let title: String?
    let householdId: String?
    let createdAt: Date
    let updatedAt: Date

    var displayTitle: String { title?.nonEmptyText ?? "New chat" }
}

struct FinAIConversationListResponse: Decodable, Equatable {
    let conversations: [FinAIConversation]
}

struct FinAIConversationResponse: Decodable, Equatable {
    let conversation: FinAIConversation
}

struct FinAIMessage: Decodable, Identifiable, Equatable {
    let id: String
    let role: String
    let content: String
    let createdAt: Date
}

struct FinAIMessageListResponse: Decodable, Equatable {
    let messages: [FinAIMessage]
}

struct FinAITimelineResponse: Decodable, Equatable {
    let blocks: [FinAITimelineBlock]
}

struct FinAITimelineBlock: Decodable, Identifiable, Equatable {
    let id: String
    let type: String
    let role: String?
    let content: String?
    let tone: String?
    let widget: JSONValue?
    let actionType: String?
    let summary: String?
    let stepType: String?
    let stepIndex: Int?
    let status: String?
    let toolName: String?
    let displayName: String?

    var displayText: String {
        if let content = content?.nonEmptyText { return content }
        if let summary = summary?.nonEmptyText { return summary }
        if let displayName = displayName?.nonEmptyText { return displayName }
        if let toolName = toolName?.nonEmptyText { return toolName.replacingOccurrences(of: "_", with: " ").capitalized }
        if let stepType = stepType?.nonEmptyText { return stepType.replacingOccurrences(of: "_", with: " ").capitalized }
        if let widget { return widget.displayValue }
        return type.replacingOccurrences(of: "_", with: " ").capitalized
    }

    var isUser: Bool { role == "user" }
}

struct FinAIActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

struct FinAIStreamEvent: Decodable, Equatable {
    let type: String
    let conversationId: String?
    let runId: String?
    let title: String?
    let content: String?
    let messageId: String?
    let toolName: String?
    let displayName: String?
    let summary: String?
    let stepType: String?
    let stepIndex: Int?
    let widget: JSONValue?
    let error: FinAIStreamError?
}

struct FinAIStreamError: Decodable, Equatable {
    let code: String?
    let message: String
}

struct FinAIChatMessage: Identifiable, Equatable {
    enum Role: Equatable {
        case user
        case assistant
        case status
        case tool
        case error
    }

    let id: String
    var role: Role
    var text: String
    var subtitle: String? = nil
    var widget: JSONValue? = nil

    var isTimelineCard: Bool {
        role == .tool || widget != nil
    }
}

private extension String {
    var nonEmptyText: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}