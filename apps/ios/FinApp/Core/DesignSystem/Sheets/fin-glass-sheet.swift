import SwiftUI

struct FinGlassSheet<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                content
                    .padding(.horizontal, FinTheme.Spacing.large)
                    .padding(.top, FinTheme.Spacing.medium)
                    .padding(.bottom, FinTheme.Spacing.xLarge)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .finSheetCornerRadius(32)
    }
}

private extension View {
    @ViewBuilder
    func finSheetCornerRadius(_ radius: CGFloat) -> some View {
        if #available(iOS 16.4, *) {
            presentationCornerRadius(radius)
        } else {
            self
        }
    }
}
