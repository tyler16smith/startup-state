import SwiftUI

struct BudgetView: View {
    @StateObject private var viewModel = BudgetViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading budget...")
            case .loaded, .refreshing:
                if let pageData = viewModel.pageData {
                    loadedContent(pageData)
                }
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Budget")
        .refreshable {
            await viewModel.refresh()
        }
        .sheet(item: detailBinding) { detail in
            BudgetDetailSheet(
                detail: detail,
                onSave: { goal in
                    try await viewModel.saveBudget(detail: detail, monthlyGoal: goal)
                },
                onDelete: {
                    try await viewModel.deleteBudget(detail: detail)
                }
            )
        }
        .task {
            await viewModel.load()
        }
    }

    private var detailBinding: Binding<CategoryBudgetDetail?> {
        Binding(
            get: { viewModel.selectedDetail },
            set: { newValue in
                if newValue == nil {
                    viewModel.clearDetail()
                }
            }
        )
    }

    private func loadedContent(_ pageData: BudgetPageData) -> some View {
        ScrollView {
            VStack(spacing: FinTheme.Spacing.large) {
                BudgetOverviewCard(pageData: pageData)

                if let detailError = viewModel.detailError {
                    Text(detailError.localizedDescription)
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.destructive)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                LazyVStack(spacing: FinTheme.Spacing.small) {
                    if pageData.categories.isEmpty {
                        emptyBudget
                    } else {
                        ForEach(pageData.categories) { category in
                            Button {
                                Task { await viewModel.loadDetail(for: category) }
                            } label: {
                                BudgetCategoryRow(category: category)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
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

    private var emptyBudget: some View {
        VStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "chart.pie")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No budget categories yet")
                .font(.headline)
            Text("Categories appear once spending or a monthly goal exists.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FinTheme.Spacing.xxLarge)
    }
}

private struct BudgetOverviewCard: View {
    let pageData: BudgetPageData

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                        Text("Spent this month")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(CurrencyFormatter.formatCompact(pageData.actualSpent))
                            .font(.largeTitle.weight(.bold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }

                    Spacer()

                    Text(pageData.status.title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(pageData.status.color)
                        .padding(.horizontal, FinTheme.Spacing.medium)
                        .padding(.vertical, FinTheme.Spacing.small)
                        .background(pageData.status.color.opacity(0.12))
                        .clipShape(Capsule())
                }

                VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.secondary.opacity(0.16))
                            Capsule()
                                .fill(pageData.status.color)
                                .frame(width: proxy.size.width * min(1, pageData.progressPercent / 100))
                        }
                    }
                    .frame(height: 9)

                    Text(pageData.statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                HStack {
                    BudgetOverviewMetric(title: "Budget", value: CurrencyFormatter.formatCompact(pageData.totalBudget))
                    BudgetOverviewMetric(title: "Expected", value: CurrencyFormatter.formatCompact(pageData.expectedByNow))
                    BudgetOverviewMetric(title: "Remaining", value: CurrencyFormatter.formatCompact(pageData.remaining))
                }
            }
        }
    }
}

private struct BudgetOverviewMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct BudgetCategoryRow: View {
    let category: CategoryBudgetRow

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(category.categoryName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(category.monthlyGoal.map { "Goal \(CurrencyFormatter.formatCompact($0))" } ?? "No goal set")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 3) {
                    Text(CurrencyFormatter.formatCompact(category.spentThisMonth))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(category.status.title)
                        .font(.caption)
                        .foregroundStyle(category.status.color)
                }
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.secondary.opacity(0.14))
                    Capsule()
                        .fill(category.status.color)
                        .frame(width: proxy.size.width * category.progress)
                }
            }
            .frame(height: 7)

            HStack(spacing: FinTheme.Spacing.small) {
                BudgetInlineMetric(title: "Expected", value: CurrencyFormatter.formatCompact(category.expectedSpendToDate))
                BudgetInlineMetric(title: "Remaining", value: category.remaining.map(CurrencyFormatter.formatCompact) ?? "No goal")
                BudgetInlineMetric(title: "Used", value: category.usagePercent.map { "\($0)%" } ?? "-")
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct BudgetInlineMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, FinTheme.Spacing.small)
        .padding(.vertical, 7)
        .background(FinTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
    }
}

private struct BudgetDetailSheet: View {
    let detail: CategoryBudgetDetail
    let onSave: (Double) async throws -> Void
    let onDelete: () async throws -> Void

    @State private var goalText: String
    @State private var isDeleteConfirmationPresented = false
    @State private var isWorking = false
    @State private var errorMessage: String?

    init(
        detail: CategoryBudgetDetail,
        onSave: @escaping (Double) async throws -> Void,
        onDelete: @escaping () async throws -> Void
    ) {
        self.detail = detail
        self.onSave = onSave
        self.onDelete = onDelete
        _goalText = State(initialValue: detail.monthlyGoal.map { String(format: "%.0f", $0) } ?? "")
    }

    var body: some View {
        FinGlassSheet(title: detail.categoryName) {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                HStack(spacing: FinTheme.Spacing.medium) {
                    BudgetDetailMetric(title: "This month", value: CurrencyFormatter.formatCompact(detail.spentThisMonth), systemImage: "calendar")
                    BudgetDetailMetric(title: "Average", value: CurrencyFormatter.formatCompact(detail.sixMonthAverage), systemImage: "chart.line.uptrend.xyaxis")
                }

                BudgetDetailStatusCard(detail: detail)

                VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
                    Text("Monthly goal")
                        .font(.subheadline.weight(.semibold))
                    TextField("0", text: $goalText)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)

                    Button {
                        goalText = String(format: "%.0f", detail.suggestedBudget)
                    } label: {
                        Label("Use suggested \(CurrencyFormatter.formatCompact(detail.suggestedBudget))", systemImage: "sparkles")
                    }
                    .buttonStyle(.bordered)
                }

                VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
                    Text("Trend")
                        .font(.subheadline.weight(.semibold))

                    BudgetTrendChart(monthlyTrend: detail.monthlyTrend)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.destructive)
                }

                HStack(spacing: FinTheme.Spacing.medium) {
                    Button(role: .destructive) {
                        isDeleteConfirmationPresented = true
                    } label: {
                        Label("Remove", systemImage: "trash")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(detail.monthlyGoal == nil || isWorking)

                    Button {
                        Task { await performSave() }
                    } label: {
                        if isWorking {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Label("Save", systemImage: "checkmark")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWorking)
                }
            }
        }
        .sheet(isPresented: $isDeleteConfirmationPresented) {
            FinGlassSheet(title: "Remove budget") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text(detail.categoryName)
                        .font(.headline)
                    Text("This removes the monthly target. Spending history for the category stays unchanged.")
                        .font(.body)
                        .foregroundStyle(.secondary)

                    HStack(spacing: FinTheme.Spacing.medium) {
                        Button {
                            isDeleteConfirmationPresented = false
                        } label: {
                            Text("Cancel").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)

                        Button(role: .destructive) {
                            Task { await performDelete() }
                        } label: {
                            if isWorking {
                                ProgressView().frame(maxWidth: .infinity)
                            } else {
                                Label("Remove", systemImage: "trash").frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isWorking)
                    }
                }
            }
        }
    }

    private func performSave() async {
        guard let goal = Double(goalText), goal >= 0 else {
            errorMessage = "Enter a valid monthly goal."
            return
        }

        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onSave(goal)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func performDelete() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onDelete()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct BudgetDetailStatusCard: View {
    let detail: CategoryBudgetDetail

    private var remaining: Double? {
        detail.monthlyGoal.map { max(0, $0 - detail.spentThisMonth) }
    }

    private var progress: Double {
        guard let monthlyGoal = detail.monthlyGoal, monthlyGoal > 0 else { return 0 }
        return detail.spentThisMonth / monthlyGoal
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
            HStack {
                Text(detail.monthlyGoal.map { "Goal \(CurrencyFormatter.formatCompact($0))" } ?? "No monthly goal")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(Int(progress * 100))%")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(progress > 0.9 ? FinTheme.ColorToken.warning : FinTheme.ColorToken.accent)
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.secondary.opacity(0.14))
                    Capsule()
                        .fill(progress > 1 ? FinTheme.ColorToken.destructive : FinTheme.ColorToken.accent)
                        .frame(width: proxy.size.width * min(1, progress))
                }
            }
            .frame(height: 8)

            HStack(spacing: FinTheme.Spacing.small) {
                BudgetInlineMetric(title: "Remaining", value: remaining.map(CurrencyFormatter.formatCompact) ?? "Set goal")
                BudgetInlineMetric(title: "Last month", value: CurrencyFormatter.formatCompact(detail.lastMonthSpend))
                BudgetInlineMetric(title: "Suggested", value: CurrencyFormatter.formatCompact(detail.suggestedBudget))
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct BudgetTrendChart: View {
    let monthlyTrend: [MonthlySpend]

    private var maxAmount: Double {
        max(monthlyTrend.map(\.amount).max() ?? 0, 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack(alignment: .bottom, spacing: FinTheme.Spacing.small) {
                ForEach(monthlyTrend) { spend in
                    VStack(spacing: FinTheme.Spacing.xSmall) {
                        Text(CurrencyFormatter.formatCompact(spend.amount))
                            .font(.caption2.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        GeometryReader { proxy in
                            VStack {
                                Spacer(minLength: 0)
                                RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous)
                                    .fill(FinTheme.ColorToken.accent)
                                    .frame(height: max(4, proxy.size.height * (spend.amount / maxAmount)))
                            }
                        }
                        .frame(height: 112)
                        Text(DateFormatterProvider.shortMonth(spend.dateValue))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct BudgetDetailMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
            Image(systemName: systemImage)
                .foregroundStyle(FinTheme.ColorToken.accent)
            Text(value)
                .font(.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

#Preview {
    NavigationStack {
        BudgetView()
    }
}
