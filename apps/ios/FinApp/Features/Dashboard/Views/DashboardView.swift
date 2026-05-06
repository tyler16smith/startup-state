import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var authManager: AuthManager

    var body: some View {
        NavigationStack {
            VStack(spacing: FinTheme.Spacing.large) {
                Image(systemName: "sparkles")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(FinTheme.ColorToken.accent)

                VStack(spacing: FinTheme.Spacing.small) {
                    Text("Hello world")
                        .font(.largeTitle.bold())
                    Text("This is the clean iOS skeleton. Auth, demo mode, household, settings, and Agent are still available for the next idea.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(FinTheme.Spacing.large)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let email = authManager.session?.email {
                            Text(email)
                        }
                        Button(role: .destructive) {
                            Task { await authManager.signOut() }
                        } label: {
                            Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "person.circle")
                            .font(.title3)
                    }
                }
            }
        }
    }
}

#Preview {
    DashboardView()
        .environmentObject(AuthManager())
}
