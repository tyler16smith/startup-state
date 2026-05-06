import SwiftUI

struct FinGlassTabBar: View {
    @Binding var selectedTab: AppTab
    let onMoreTapped: () -> Void

    var body: some View {
        HStack(spacing: FinTheme.Spacing.small) {
            ForEach(AppTab.allCases) { tab in
                Button {
                    if tab == .more {
                        onMoreTapped()
                    } else {
                        selectedTab = tab
                    }
                } label: {
                    FinGlassTabItem(
                        tab: tab,
                        isSelected: selectedTab == tab
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.title)
            }
        }
        .padding(FinTheme.Spacing.small)
        .finGlass(cornerRadius: 44)
        .padding(.horizontal, FinTheme.Spacing.large)
        .padding(.bottom, FinTheme.Spacing.small)
    }
}

private struct FinGlassTabItem: View {
    let tab: AppTab
    let isSelected: Bool

    var body: some View {
        VStack(spacing: FinTheme.Spacing.xSmall) {
            Image(systemName: tab.systemImage)
                .font(.system(size: 20, weight: .semibold))
                .symbolRenderingMode(.hierarchical)
                .padding(.vertical, tab == .more ? 5 : 0)

            Text(tab.title)
                .font(.caption2)
                .fontWeight(isSelected ? .semibold : .medium)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .foregroundStyle(isSelected ? FinTheme.ColorToken.textPrimary : FinTheme.ColorToken.textSecondary)
        .frame(maxWidth: .infinity, minHeight: 56)
        .padding(.horizontal, FinTheme.Spacing.xSmall)
        .background {
            if isSelected {
                Capsule(style: .continuous)
                    .fill(.regularMaterial)
                    .overlay {
                        Capsule(style: .continuous)
                            .stroke(.white.opacity(0.24), lineWidth: 1)
                    }
            }
        }
    }
}

#Preview {
    ZStack(alignment: .bottom) {
        LinearGradient(
            colors: [.blue.opacity(0.15), .green.opacity(0.12)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()

        FinGlassTabBar(selectedTab: .constant(.home)) {}
    }
}
