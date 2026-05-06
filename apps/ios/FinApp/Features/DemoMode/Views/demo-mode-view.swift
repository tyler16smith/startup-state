import SwiftUI

struct DemoModeView: View {
    @StateObject private var viewModel = DemoModeViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading demo mode...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Demo Mode")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await viewModel.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .refreshable { await viewModel.refresh() }
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

    private var actionMessageBinding: Binding<DemoModeActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: FinTheme.Spacing.large) {
                DemoModeStatusCard(status: viewModel.status)

                VStack(spacing: FinTheme.Spacing.medium) {
                    Button {
                        Task { await viewModel.enterDemoMode() }
                    } label: {
                        Label("Enter demo mode", systemImage: "play.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    Button {
                        Task { await viewModel.resetDemoOverlay() }
                    } label: {
                        Label("Reset demo changes", systemImage: "arrow.counterclockwise.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .disabled(viewModel.status?.isDemoMode != true)

                    Button {
                        Task { await viewModel.dismissNotice() }
                    } label: {
                        Label("Dismiss notice", systemImage: "bell.slash")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .disabled(viewModel.status?.isDemoMode != true)

                    Button(role: .destructive) {
                        Task { await viewModel.exitDemoMode() }
                    } label: {
                        Label("Exit demo mode", systemImage: "xmark.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .disabled(viewModel.status?.isDemoMode != true)
                }
                .padding(FinTheme.Spacing.large)
                .background(FinTheme.ColorToken.surface)
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
            }
            .padding(.horizontal, FinTheme.Spacing.large)
            .padding(.top, FinTheme.Spacing.large)
            .padding(.bottom, 112)
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

private struct DemoModeStatusCard: View {
    let status: DemoModeStatus?

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                HStack {
                    Image(systemName: status?.isDemoMode == true ? "checkmark.seal.fill" : "person.crop.circle")
                        .foregroundStyle(status?.isDemoMode == true ? FinTheme.ColorToken.positive : FinTheme.ColorToken.textSecondary)
                    Text(status?.isDemoMode == true ? "Demo mode is active" : "Demo mode is inactive")
                        .font(.headline)
                }

                DemoModeFact(title: "Expires", value: status?.overlayExpiresAt.map(DateFormatterProvider.fullDate) ?? "-")
                DemoModeFact(title: "Unsaved changes", value: status?.hasUnsavedDemoChanges == true ? "Yes" : "No")
                DemoModeFact(title: "Notice dismissed", value: status?.noticeDismissed == true ? "Yes" : "No")
            }
        }
    }
}

private struct DemoModeFact: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
        }
    }
}