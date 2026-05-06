import SwiftUI

struct SpendingView: View {
    @StateObject private var viewModel = SpendingViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading spending...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Spending")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach([3, 6, 12, 24], id: \.self) { months in
                        Button("\(months) months") {
                            Task { await viewModel.updateMonths(months) }
                        }
                    }
                } label: {
                    Label("Range", systemImage: "calendar")
                }
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .task {
            await viewModel.load()
        }
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: FinTheme.Spacing.large) {
                SpendingSummaryCard(
                    totalSpend: viewModel.totalSpend,
                    monthlyAverage: viewModel.monthlyAverage,
                    topCategory: viewModel.topCategory,
                    selectedMonths: viewModel.selectedMonths
                )

                SpendingTrendCard(months: viewModel.trends.months)

                CategoryBreakdownSection(rows: viewModel.breakdown)

                RecurringExpensesSection(rows: viewModel.recurring)

                SpendingAnomaliesSection(rows: viewModel.anomalies)
            }
            .padding(.horizontal, FinTheme.Spacing.large)
            .padding(.top, FinTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .overlay(alignment: .top) {
            if case .refreshing = viewModel.state {
                ProgressView()
                    .padding(FinTheme.Spacing.small)
                    .finGlass(cornerRadius: FinTheme.Radius.pill)
                    .padding(.top, FinTheme.Spacing.small)
            }
        }
    }
}

private struct SpendingSummaryCard: View {
    let totalSpend: Double
    let monthlyAverage: Double
    let topCategory: SpendingCategoryBreakdown?
    let selectedMonths: Int

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                    Text("Total spend")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(CurrencyFormatter.formatCompact(totalSpend))
                        .font(.largeTitle.weight(.bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                HStack {
                    SpendingMetric(title: "Monthly avg", value: CurrencyFormatter.formatCompact(monthlyAverage), systemImage: "calendar")
                    SpendingMetric(title: "Range", value: "\(selectedMonths)m", systemImage: "clock")
                    SpendingMetric(title: "Top", value: topCategory?.category ?? "-", systemImage: "chart.bar.fill")
                }
            }
        }
    }
}

private struct SpendingMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Image(systemName: systemImage)
                .foregroundStyle(FinTheme.ColorToken.accent)
            Text(value)
                .font(.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct SpendingTrendCard: View {
    let months: [SpendingTrendMonth]

    private var maxTotal: Double { max(months.map(\.total).max() ?? 1, 1) }

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                Text("Monthly trend")
                    .font(.headline)

                if months.isEmpty {
                    emptyText("No trend data yet")
                } else {
                    HStack(alignment: .bottom, spacing: FinTheme.Spacing.small) {
                        ForEach(months.suffix(12)) { month in
                            VStack(spacing: FinTheme.Spacing.xSmall) {
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(FinTheme.ColorToken.accent)
                                    .frame(height: max(8, CGFloat(month.total / maxTotal) * 120))
                                Text(DateFormatterProvider.formatYearMonth(month.month).prefix(3))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .frame(height: 152, alignment: .bottom)
                }
            }
        }
    }
}

private struct CategoryBreakdownSection: View {
    let rows: [SpendingCategoryBreakdown]

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            Text("Categories")
                .font(.headline)

            if rows.isEmpty {
                emptyText("No category spending yet")
            } else {
                ForEach(rows.prefix(12)) { row in
                    NavigationLink {
                        TransactionsView(
                            initialFilters: TransactionFilterState(category: row.category, type: .expense),
                            title: row.category
                        )
                    } label: {
                        SpendingBreakdownRow(row: row)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct SpendingBreakdownRow: View {
    let row: SpendingCategoryBreakdown

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.category)
                        .font(.subheadline.weight(.semibold))
                    Text("\(String(format: "%.0f", row.percentage))% of spend")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(CurrencyFormatter.formatCompact(row.total))
                        .font(.subheadline.weight(.semibold))
                    Text(CurrencyFormatter.formatCompact(row.monthlyAvg) + "/mo")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.secondary.opacity(0.14))
                    Capsule()
                        .fill(FinTheme.ColorToken.accent)
                        .frame(width: proxy.size.width * min(1, row.percentOfTop / 100))
                }
            }
            .frame(height: 7)
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct RecurringExpensesSection: View {
    let rows: [RecurringExpense]

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            Text("Recurring")
                .font(.headline)

            if rows.isEmpty {
                emptyText("No recurring expenses detected")
            } else {
                ForEach(rows.prefix(8)) { row in
                    NavigationLink {
                        TransactionsView(
                            initialFilters: TransactionFilterState(search: row.description, type: .expense),
                            title: row.description.capitalized
                        )
                    } label: {
                        RecurringExpenseRow(row: row)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct RecurringExpenseRow: View {
    let row: RecurringExpense

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.description.capitalized)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text("Seen \(row.occurrences) months")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(CurrencyFormatter.formatCompact(row.monthlyAmount))
                    .font(.subheadline.weight(.semibold))
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct SpendingAnomaliesSection: View {
    let rows: [SpendingAnomaly]

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            Text("Anomalies")
                .font(.headline)

            if rows.isEmpty {
                emptyText("No unusual spending detected")
            } else {
                ForEach(rows.prefix(8)) { row in
                    NavigationLink {
                        TransactionsView(
                            initialFilters: TransactionFilterState(category: row.category, type: .expense),
                            title: "\(row.category) Anomaly"
                        )
                    } label: {
                        SpendingAnomalyRow(row: row)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct SpendingAnomalyRow: View {
    let row: SpendingAnomaly

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(FinTheme.ColorToken.warning)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.category)
                    .font(.subheadline.weight(.semibold))
                Text("\(String(format: "%.0f", row.increasePercent))% above average")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(CurrencyFormatter.formatCompact(row.currentAmount))
                    .font(.subheadline.weight(.semibold))
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.warning.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private func emptyText(_ title: String) -> some View {
    Text(title)
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(FinTheme.Spacing.large)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
}

#Preview {
    NavigationStack {
        SpendingView()
    }
}