import SwiftUI

struct FinAIView: View {
    @StateObject private var viewModel = FinAIViewModel()
    @State private var renameTitle = ""
    @State private var isRenamePresented = false
    @FocusState private var composerFocused: Bool

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading Agent...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Agent")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        viewModel.startNewConversation()
                    } label: {
                        Label("New chat", systemImage: "square.and.pencil")
                    }
                    Button {
                        renameTitle = viewModel.selectedConversation?.displayTitle ?? ""
                        isRenamePresented = true
                    } label: {
                        Label("Rename", systemImage: "pencil")
                    }
                    .disabled(viewModel.selectedConversation == nil)
                    Button {
                        Task { await viewModel.refresh() }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                    .disabled(viewModel.isStreaming)
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel("Agent actions")
            }
        }
        .refreshable { await viewModel.refresh() }
        .sheet(isPresented: $isRenamePresented) {
            FinGlassSheet(title: "Rename Chat") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    TextField("Title", text: $renameTitle)
                        .textFieldStyle(.roundedBorder)
                    Button {
                        Task {
                            await viewModel.renameSelectedConversation(to: renameTitle)
                            isRenamePresented = false
                        }
                    } label: {
                        Text("Save title").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
        }
        .sheet(item: actionMessageBinding) { message in
            FinGlassSheet(title: message.title) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text(message.message)
                        .font(.body)
                        .foregroundStyle(.secondary)
                    Button {
                        viewModel.clearActionMessage()
                    } label: {
                        Text("Done").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
        }
        .task { await viewModel.load() }
    }

    private var actionMessageBinding: Binding<FinAIActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var loadedContent: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: FinTheme.Spacing.small) {
                    Button {
                        viewModel.startNewConversation()
                    } label: {
                        Label("New", systemImage: "plus")
                    }
                    .buttonStyle(.bordered)

                    ForEach(viewModel.conversations) { conversation in
                        Button {
                            Task { await viewModel.select(conversation) }
                        } label: {
                            Text(conversation.displayTitle)
                                .lineLimit(1)
                        }
                        .buttonStyle(.bordered)
                        .tint(viewModel.selectedConversation?.id == conversation.id ? FinTheme.ColorToken.accent : nil)
                        .disabled(viewModel.isStreaming)
                        .accessibilityLabel("Open chat \(conversation.displayTitle)")
                    }
                }
                .padding(.horizontal, FinTheme.Spacing.large)
                .padding(.vertical, FinTheme.Spacing.medium)
            }

            Divider()

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                        if viewModel.chatMessages.isEmpty {
                            FinAIEmptyState()
                        } else {
                            ForEach(viewModel.chatMessages) { message in
                                FinAIMessageBubble(message: message)
                                    .id(message.id)
                            }
                        }
                    }
                    .padding(.horizontal, FinTheme.Spacing.large)
                    .padding(.top, FinTheme.Spacing.large)
                    .padding(.bottom, FinTheme.Spacing.large)
                }
                .onChange(of: viewModel.chatMessages.count) { _ in
                    if let last = viewModel.chatMessages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
                HStack {
                    Text(viewModel.status)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if viewModel.isStreaming {
                        ProgressView()
                            .accessibilityLabel("Agent is responding")
                    }
                }

                FinAIResponseActions(
                    isStreaming: viewModel.isStreaming,
                    canRetry: viewModel.canRetryResponse,
                    onCancel: viewModel.cancelStreaming,
                    onRetry: { Task { await viewModel.retryLastMessage() } },
                    onRegenerate: { Task { await viewModel.regenerateLastResponse() } }
                )

                HStack(spacing: FinTheme.Spacing.small) {
                    TextField("Ask Agent", text: $viewModel.composerText, axis: .vertical)
                        .lineLimit(1...4)
                        .textFieldStyle(.roundedBorder)
                        .disabled(viewModel.isStreaming)
                        .focused($composerFocused)
                        .submitLabel(.send)
                        .onSubmit {
                            let trimmed = viewModel.composerText.trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !trimmed.isEmpty, !viewModel.isStreaming else { return }
                            Task { await viewModel.sendMessage() }
                        }
                        .accessibilityLabel("Ask Agent")

                    Button {
                        Task { await viewModel.sendMessage() }
                    } label: {
                        Image(systemName: "paperplane.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(viewModel.composerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isStreaming)
                    .accessibilityLabel("Send message")
                }
            }
            .padding(FinTheme.Spacing.large)
            .finGlass(cornerRadius: FinTheme.Radius.large)
            .padding(.horizontal, FinTheme.Spacing.large)
            .padding(.bottom, FinTheme.Spacing.large)
        }
        .overlay(alignment: .top) {
            if case .refreshing = viewModel.state {
                ProgressView()
                    .padding(FinTheme.Spacing.small)
                    .finGlass(cornerRadius: FinTheme.Radius.pill)
                    .padding(.top, FinTheme.Spacing.small)
            }
        }
    }
}

private struct FinAIResponseActions: View {
    let isStreaming: Bool
    let canRetry: Bool
    let onCancel: () -> Void
    let onRetry: () -> Void
    let onRegenerate: () -> Void

    var body: some View {
        HStack(spacing: FinTheme.Spacing.small) {
            if isStreaming {
                Button(action: onCancel) {
                    Label("Cancel", systemImage: "stop.circle")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            } else if canRetry {
                Button(action: onRetry) {
                    Label("Retry", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

                Button(action: onRegenerate) {
                    Label("Regenerate", systemImage: "sparkles")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            Spacer()
        }
        .animation(.snappy, value: isStreaming)
        .animation(.snappy, value: canRetry)
    }
}

private struct FinAIEmptyState: View {
    var body: some View {
        VStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "sparkles")
                .font(.system(size: 44))
                .foregroundStyle(FinTheme.ColorToken.accent)
            Text("Start an Agent chat")
                .font(.headline)
            Text("Ask for hello_world or test the skeleton app wiring.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FinTheme.Spacing.xxLarge)
    }
}

private struct FinAIMessageBubble: View {
    let message: FinAIChatMessage

    var body: some View {
        HStack {
            if message.role == .user { Spacer(minLength: 32) }

            messageContent
                .padding(FinTheme.Spacing.medium)
                .background(backgroundStyle)
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
                .frame(maxWidth: message.isTimelineCard ? .infinity : 360, alignment: message.role == .user ? .trailing : .leading)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(accessibilityLabel)

            if message.role != .user { Spacer(minLength: 32) }
        }
    }

    @ViewBuilder
    private var messageContent: some View {
        if message.isTimelineCard {
            FinAITimelineCard(message: message)
        } else {
            Text(markdownText)
                .font(.body)
                .foregroundStyle(foregroundStyle)
                .textSelection(.enabled)
        }
    }

    private var markdownText: AttributedString {
        guard message.role == .assistant else { return AttributedString(message.text) }
        return (try? AttributedString(markdown: message.text)) ?? AttributedString(message.text)
    }

    private var accessibilityLabel: String {
        switch message.role {
        case .user:
            return "You said: \(message.text)"
        case .assistant:
            return "Agent said: \(message.text)"
        case .tool:
            return "Agent timeline update: \(message.text)"
        case .status:
            return "Agent status: \(message.text)"
        case .error:
            return "Agent error: \(message.text)"
        }
    }

    private var backgroundStyle: Color {
        switch message.role {
        case .user:
            return FinTheme.ColorToken.accent.opacity(0.18)
        case .error:
            return FinTheme.ColorToken.destructive.opacity(0.14)
        case .tool:
            return FinTheme.ColorToken.elevatedSurface
        case .assistant, .status:
            return FinTheme.ColorToken.surface
        }
    }

    private var foregroundStyle: Color {
        switch message.role {
        case .error:
            return FinTheme.ColorToken.destructive
        case .tool:
            return FinTheme.ColorToken.textSecondary
        default:
            return FinTheme.ColorToken.textPrimary
        }
    }
}

private struct FinAITimelineCard: View {
    let message: FinAIChatMessage

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
            HStack(spacing: FinTheme.Spacing.small) {
                Image(systemName: iconName)
                    .foregroundStyle(iconColor)
                VStack(alignment: .leading, spacing: 2) {
                    Text(message.text)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FinTheme.ColorToken.textPrimary)
                    if let subtitle = message.subtitle, !subtitle.isEmpty {
                        Text(subtitle.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }

            if let widget = message.widget {
                Text(widget.displayValue)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(4)
            }
        }
        .textSelection(.enabled)
    }

    private var iconName: String {
        switch message.role {
        case .error:
            return "exclamationmark.triangle.fill"
        case .status:
            return "info.circle"
        default:
            return "timeline.selection"
        }
    }

    private var iconColor: Color {
        message.role == .error ? FinTheme.ColorToken.destructive : FinTheme.ColorToken.accent
    }
}