import Foundation

@MainActor
final class FinAIViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var conversations: [FinAIConversation] = []
    @Published private(set) var selectedConversation: FinAIConversation?
    @Published private(set) var timeline: [FinAITimelineBlock] = []
    @Published private(set) var chatMessages: [FinAIChatMessage] = []
    @Published private(set) var status = "Ready"
    @Published private(set) var isStreaming = false
    @Published private(set) var actionMessage: FinAIActionMessage?
    @Published private(set) var lastSubmittedPrompt: String?
    @Published var composerText = ""

    private let service: FinAIService
    private var assistantMessageId: String?
    private var streamTask: Task<Void, Never>?
    private var didRequestCancellation = false

    var canRetryResponse: Bool {
        lastSubmittedPrompt != nil && !isStreaming
    }

    init(service: FinAIService = FinAIService()) {
        self.service = service
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        guard !isStreaming else { return }
        await reload(showLoading: false)
    }

    func select(_ conversation: FinAIConversation) async {
        guard !isStreaming else { return }
        selectedConversation = conversation
        state = .refreshing

        do {
            timeline = try await service.listTimeline(conversationId: conversation.id)
            chatMessages = timeline.map(\.chatMessage)
            state = .loaded
        } catch {
            state = .error(error)
        }
    }

    func startNewConversation() {
        guard !isStreaming else { return }
        selectedConversation = nil
        timeline = []
        chatMessages = []
        status = "Ready"
    }

    func renameSelectedConversation(to title: String) async {
        guard let selectedConversation else { return }
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { return }
        state = .refreshing

        do {
            let conversation = try await service.renameConversation(id: selectedConversation.id, title: trimmedTitle)
            self.selectedConversation = conversation
            await reload(showLoading: false)
            actionMessage = FinAIActionMessage(title: "Conversation renamed", message: conversation.displayTitle)
        } catch {
            actionMessage = FinAIActionMessage(title: "Rename failed", message: error.localizedDescription)
            state = .loaded
        }
    }

    func sendMessage() async {
        let trimmed = composerText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isStreaming else { return }

        composerText = ""
        await submit(prompt: trimmed, appendUserMessage: true, clearAssistantTail: false)
    }

    func retryLastMessage() async {
        guard let lastSubmittedPrompt, !isStreaming else { return }
        removeResponseAfterLastUser()
        await submit(prompt: lastSubmittedPrompt, appendUserMessage: false, clearAssistantTail: false)
    }

    func regenerateLastResponse() async {
        guard let lastUser = chatMessages.last(where: { $0.role == .user }), !isStreaming else { return }
        removeResponseAfterLastUser()
        await submit(prompt: lastUser.text, appendUserMessage: false, clearAssistantTail: false)
    }

    func cancelStreaming() {
        guard isStreaming else { return }
        didRequestCancellation = true
        status = "Cancelling..."
        streamTask?.cancel()
    }

    private func submit(prompt: String, appendUserMessage: Bool, clearAssistantTail: Bool) async {
        if clearAssistantTail { removeResponseAfterLastUser() }
        status = "Thinking..."
        isStreaming = true
        didRequestCancellation = false
        lastSubmittedPrompt = prompt
        assistantMessageId = nil
        if appendUserMessage {
            chatMessages.append(FinAIChatMessage(id: UUID().uuidString, role: .user, text: prompt))
        }

        let task = Task { [weak self] in
            guard let self else { return }
            do {
                try await service.streamMessage(conversationId: selectedConversation?.id, message: prompt) { [weak self] event in
                    await self?.handle(event)
                }
                if Task.isCancelled { throw CancellationError() }
                isStreaming = false
                status = "Ready"
                await reload(showLoading: false)
            } catch is CancellationError {
                isStreaming = false
                status = "Ready"
                let message = didRequestCancellation ? "Response cancelled." : "Agent stopped responding."
                chatMessages.append(FinAIChatMessage(id: UUID().uuidString, role: .status, text: message))
            } catch {
                isStreaming = false
                status = "Ready"
                chatMessages.append(FinAIChatMessage(id: UUID().uuidString, role: .error, text: error.localizedDescription))
            }
        }
        streamTask = task
        await task.value
        streamTask = nil
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            conversations = try await service.listConversations()
            if let selectedConversation,
               let refreshed = conversations.first(where: { $0.id == selectedConversation.id }) {
                self.selectedConversation = refreshed
            }
            state = .loaded
        } catch {
            state = .error(error)
        }
    }

    private func handle(_ event: FinAIStreamEvent) {
        switch event.type {
        case "run_started":
            if let conversationId = event.conversationId {
                let timestamp = Date()
                selectedConversation = FinAIConversation(
                    id: conversationId,
                    title: event.title,
                    householdId: nil,
                    createdAt: timestamp,
                    updatedAt: timestamp
                )
            }
        case "status":
            status = event.content ?? status
        case "message_delta":
            appendAssistantDelta(event.content ?? "")
            status = "Responding..."
        case "tool_call_started":
            let label = event.displayName ?? event.toolName ?? "Working"
            status = label
            chatMessages.append(FinAIChatMessage(id: UUID().uuidString, role: .tool, text: label, subtitle: "Running"))
        case "tool_call_done", "action_done":
            if let summary = event.summary ?? event.displayName ?? event.toolName ?? event.widget?.displayValue {
                chatMessages.append(FinAIChatMessage(id: UUID().uuidString, role: .tool, text: summary, subtitle: event.stepType, widget: event.widget))
            }
        case "message_done":
            status = "Ready"
        case "run_cancelled":
            status = "Ready"
            chatMessages.append(FinAIChatMessage(id: UUID().uuidString, role: .status, text: "Response cancelled."))
        case "error":
            chatMessages.append(FinAIChatMessage(id: UUID().uuidString, role: .error, text: event.error?.message ?? "Agent failed."))
        default:
            break
        }
    }

    private func appendAssistantDelta(_ delta: String) {
        guard !delta.isEmpty else { return }

        if let assistantMessageId,
           let index = chatMessages.firstIndex(where: { $0.id == assistantMessageId }) {
            chatMessages[index].text += delta
        } else {
            let messageId = UUID().uuidString
            assistantMessageId = messageId
            chatMessages.append(FinAIChatMessage(id: messageId, role: .assistant, text: delta))
        }
    }

    private func removeResponseAfterLastUser() {
        guard let lastUserIndex = chatMessages.lastIndex(where: { $0.role == .user }) else { return }
        chatMessages = Array(chatMessages.prefix(lastUserIndex + 1))
        assistantMessageId = nil
    }
}

private extension FinAITimelineBlock {
    var chatMessage: FinAIChatMessage {
        let role: FinAIChatMessage.Role
        if isUser {
            role = .user
        } else if type == "tool_call" || type == "run_step" || type == "action_result" {
            role = .tool
        } else if tone == "error" {
            role = .error
        } else {
            role = .assistant
        }

        return FinAIChatMessage(id: id, role: role, text: displayText, subtitle: stepType ?? status ?? toolName, widget: widget)
    }
}