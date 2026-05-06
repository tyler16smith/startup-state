import SwiftUI

struct MoreMenuSheet: View {
    let onSelect: (AppDestination) -> Void
    private let rowIconSize: CGFloat = 32
    private let rowHorizontalPadding = FinTheme.Spacing.large
    private let rowContentSpacing = FinTheme.Spacing.medium
    private let rowIconColor = Color(.black)
    private let rowIconBackground = Color(.systemGray5)
    private let groupedCardBackground = Color(.systemGray6)

    var body: some View {
        FinGlassSheet(title: "More") {
            let destinations = AppDestination.allCases

            VStack(spacing: 0) {
                ForEach(Array(destinations.enumerated()), id: \.element.id) { index, destination in
                    Button {
                        onSelect(destination)
                    } label: {
                        HStack(spacing: rowContentSpacing) {
                            Image(systemName: destination.systemImage)
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(rowIconColor)
                                .frame(width: rowIconSize, height: rowIconSize)
                                .background(rowIconBackground, in: RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))

                            Text(destination.title)
                                .font(.body)
                                .fontWeight(.medium)
                                .foregroundStyle(FinTheme.ColorToken.textPrimary)

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(FinTheme.ColorToken.textSecondary)
                        }
                        .padding(.horizontal, rowHorizontalPadding)
                        .padding(.vertical, FinTheme.Spacing.small)
                        .frame(minHeight: 56)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(destination.title)

                    if index < destinations.count - 1 {
                        Divider()
                            .padding(.leading, rowHorizontalPadding + rowIconSize + rowContentSpacing)
                    }
                }
            }
            .background(groupedCardBackground, in: RoundedRectangle(cornerRadius: FinTheme.Radius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FinTheme.Radius.large, style: .continuous)
                    .stroke(Color(.separator).opacity(0.35), lineWidth: 0.5)
            }
        }
    }
}

#Preview {
    MoreMenuSheet { _ in }
}
