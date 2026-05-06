import SwiftUI

struct OnboardingView: View {
    @StateObject private var viewModel = OnboardingViewModel()
    let onComplete: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: FinTheme.Spacing.large) {
                Image(systemName: "sparkles")
                    .font(.system(size: 48, weight: .semibold))
                    .foregroundStyle(FinTheme.ColorToken.accent)

                VStack(spacing: FinTheme.Spacing.small) {
                    Text("Hello world")
                        .font(.largeTitle.bold())
                    Text("The base app shell is ready. Continue to keep auth, settings, demo mode, household, and Agent available.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                Button {
                    Task { await viewModel.complete() }
                } label: {
                    Text(viewModel.isBusy ? "Saving..." : "Enter dashboard")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(viewModel.isBusy)
            }
            .padding(FinTheme.Spacing.large)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle("Setup")
        }
        .onChange(of: viewModel.completed) { completed in
            if completed {
                onComplete()
            }
        }
        .alert("Unable to complete setup", isPresented: errorBinding) {
            Button("OK") { viewModel.retryAfterError() }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: {
                if case .error = viewModel.state { return true }
                return false
            },
            set: { isPresented in
                if !isPresented { viewModel.retryAfterError() }
            }
        )
    }
}

#Preview {
    OnboardingView {}
}
