import SwiftUI

struct AppShellView: View {
    @State private var selectedTab: AppTab = .home
    @State private var selectedMoreDestination: AppDestination?
    @State private var pendingMoreDestination: AppDestination?
    @State private var isMorePresented = false

    var body: some View {
        ZStack(alignment: .bottom) {
            selectedTabView
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            VStack {
                DemoModeBanner()
                Spacer()
            }
            .allowsHitTesting(true)

            FinGlassTabBar(selectedTab: $selectedTab) {
                isMorePresented = true
            }
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .sheet(isPresented: $isMorePresented, onDismiss: presentPendingMoreDestination) {
            MoreMenuSheet { destination in
                handleMoreSelection(destination)
            }
        }
        .fullScreenCover(item: $selectedMoreDestination) { destination in
            NavigationStack {
                destinationView(destination)
                    .navigationTitle(destination.title)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button {
                                selectedMoreDestination = nil
                            } label: {
                                Image(systemName: "xmark")
                            }
                            .accessibilityLabel("Close \(destination.title)")
                        }
                    }
            }
        }
    }

    @ViewBuilder
    private var selectedTabView: some View {
        switch selectedTab {
        case .home:
            DashboardView()
        case .more:
            DashboardView()
        }
    }

    private func handleMoreSelection(_ destination: AppDestination) {
        isMorePresented = false

        if let tab = destination.tab {
            selectedTab = tab
            return
        }

        pendingMoreDestination = destination
    }

    private func presentPendingMoreDestination() {
        guard let destination = pendingMoreDestination else { return }

        pendingMoreDestination = nil
        selectedMoreDestination = destination
    }

    @ViewBuilder
    private func destinationView(_ destination: AppDestination) -> some View {
        switch destination {
        case .agent:
            FinAIView()
        case .demoMode:
            DemoModeView()
        case .accountSettings:
            AccountSettingsView()
        case .household:
            NavigationStack {
                ScrollView {
                    HouseholdSharingView()
                        .padding(.horizontal, FinTheme.Spacing.large)
                        .padding(.top, FinTheme.Spacing.large)
                        .padding(.bottom, 112)
                }
                .navigationTitle("Household")
            }
        }
    }
}

#Preview {
    AppShellView()
}

private extension View {
    @ViewBuilder
    func finAppShellSheetCornerRadius(_ radius: CGFloat) -> some View {
        if #available(iOS 16.4, *) {
            presentationCornerRadius(radius)
        } else {
            self
        }
    }
}
