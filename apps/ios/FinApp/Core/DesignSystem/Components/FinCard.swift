import SwiftUI

/// A styled card container for dashboard content
struct FinCard<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding()
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        FinCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Net Worth")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("$125,000")
                    .font(.title)
                    .fontWeight(.bold)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        
        FinCard {
            HStack {
                Text("Investments")
                Spacer()
                Text("5 accounts")
                    .foregroundStyle(.secondary)
            }
        }
    }
    .padding()
}
