import SwiftUI

struct FeaturePlaceholderView: View {
    let title: String
    let systemImage: String
    let message: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.xLarge) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                    Image(systemName: systemImage)
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(FinTheme.ColorToken.accent)
                        .frame(width: 56, height: 56)
                        .background(FinTheme.ColorToken.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))

                    Text(title)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundStyle(FinTheme.ColorToken.textPrimary)

                    Text(message)
                        .font(.body)
                        .foregroundStyle(FinTheme.ColorToken.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                    Text("Implementation surface")
                        .font(.headline)

                    Label("Native SwiftUI screen", systemImage: "iphone")
                    Label("Server-backed data and actions", systemImage: "network")
                    Label("Reusable design-system controls", systemImage: "square.grid.2x2.fill")
                }
                .font(.subheadline)
                .foregroundStyle(FinTheme.ColorToken.textSecondary)
                .padding(FinTheme.Spacing.large)
                .background(FinTheme.ColorToken.surface, in: RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
            }
            .padding(FinTheme.Spacing.large)
            .padding(.bottom, 96)
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
    }
}

#Preview {
    NavigationStack {
        FeaturePlaceholderView(
            title: "Budget",
            systemImage: "chart.pie.fill",
            message: "Budgeting will mirror the web app with API-backed category targets, progress, and detail sheets."
        )
    }
}
