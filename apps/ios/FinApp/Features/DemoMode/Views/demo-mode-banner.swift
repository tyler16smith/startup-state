import SwiftUI

struct DemoModeBanner: View {
    @StateObject private var viewModel = DemoModeViewModel()

    var body: some View {
        Group {
            if viewModel.status?.isDemoMode == true {
                banner
            }
        }
        .task { await viewModel.load() }
    }

    private var banner: some View {
        HStack(spacing: FinTheme.Spacing.small) {
            Image(systemName: "play.circle.fill")
                .foregroundStyle(FinTheme.ColorToken.positive)

            VStack(alignment: .leading, spacing: 2) {
                Text("Demo mode")
                    .font(.caption.weight(.semibold))
                Text(statusText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: FinTheme.Spacing.small)

            Button {
                Task { await viewModel.resetDemoOverlay() }
            } label: {
                Image(systemName: "arrow.counterclockwise")
            }
            .buttonStyle(.bordered)
            .controlSize(.mini)
            .accessibilityLabel("Reset demo changes")

            Button(role: .destructive) {
                Task { await viewModel.exitDemoMode() }
            } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(.bordered)
            .controlSize(.mini)
            .accessibilityLabel("Exit demo mode")
        }
        .padding(.horizontal, FinTheme.Spacing.medium)
        .padding(.vertical, FinTheme.Spacing.small)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous)
                .stroke(FinTheme.ColorToken.positive.opacity(0.25), lineWidth: 1)
        }
        .padding(.horizontal, FinTheme.Spacing.large)
        .padding(.top, FinTheme.Spacing.small)
    }

    private var statusText: String {
        guard let status = viewModel.status else { return "Using sample data" }
        if status.hasUnsavedDemoChanges { return "Sample data with unsaved changes" }
        if let expiresAt = status.overlayExpiresAt { return "Expires \(DateFormatterProvider.fullDate(expiresAt))" }
        return "Using sample data"
    }
}