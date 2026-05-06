import SwiftUI

/// A card displaying the current net worth and change
struct SummaryCardView: View {
    
    let summary: DashboardSummary
    
    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Net Worth")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                Text(CurrencyFormatter.format(summary.currentNetWorth))
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                
                HStack(spacing: 8) {
                    // Change indicator
                    HStack(spacing: 4) {
                        Image(systemName: summary.isPositiveChange ? "arrow.up.right" : "arrow.down.right")
                        Text(summary.formattedAbsoluteChange)
                    }
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(summary.isPositiveChange ? .green : .red)
                    
                    Text("·")
                        .foregroundStyle(.secondary)
                    
                    Text(summary.formattedPercentChange)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    
                    Text("this month")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        SummaryCardView(
            summary: DashboardSummary(
                currentNetWorth: 145250.50,
                previousNetWorth: 140000,
                percentChange: 3.75,
                absoluteChange: 5250.50,
                dataPoints: []
            )
        )
        
        SummaryCardView(
            summary: DashboardSummary(
                currentNetWorth: 98000,
                previousNetWorth: 100000,
                percentChange: -2.0,
                absoluteChange: -2000,
                dataPoints: []
            )
        )
    }
    .padding()
}
