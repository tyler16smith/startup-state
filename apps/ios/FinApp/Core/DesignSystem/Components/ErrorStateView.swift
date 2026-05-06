import SwiftUI

/// Displays an error state with optional retry action
struct ErrorStateView: View {
    let title: String
    let message: String
    let retryAction: (() -> Void)?
    
    init(
        title: String = "Something went wrong",
        message: String,
        retryAction: (() -> Void)? = nil
    ) {
        self.title = title
        self.message = message
        self.retryAction = retryAction
    }
    
    init(error: Error, retryAction: (() -> Void)? = nil) {
        self.title = "Something went wrong"
        self.message = error.localizedDescription
        self.retryAction = retryAction
    }
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            VStack(spacing: 8) {
                Text(title)
                    .font(.headline)
                
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            if let retryAction {
                Button(action: retryAction) {
                    Text("Try Again")
                        .font(.headline)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Preview

#Preview {
    VStack {
        ErrorStateView(
            message: "Unable to load your data. Please check your connection."
        ) {}
    }
}
