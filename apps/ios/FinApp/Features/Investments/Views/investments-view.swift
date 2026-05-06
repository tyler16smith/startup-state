import SwiftUI

struct InvestmentsView: View {
    @StateObject private var viewModel = InvestmentsViewModel()
    @State private var investmentSheet: InvestmentSheetMode?
    @State private var propertySheet: PropertySheetMode?
    @State private var propertyDetailSheet: RealEstateProperty?
    @State private var investmentDetailSheet: InvestmentItem?

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading investments...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Investments")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        investmentSheet = .create
                    } label: {
                        Label("Add investment", systemImage: "plus.circle")
                    }

                    Button {
                        propertySheet = .create
                    } label: {
                        Label("Add property", systemImage: "house.fill")
                    }

                    Divider()

                    Button {
                        Task { await viewModel.refresh() }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                } label: {
                    Image(systemName: "plus.circle")
                }
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .sheet(item: $investmentSheet) { mode in
            InvestmentEditorSheet(
                mode: mode,
                onSave: { type, name, balance, contribution, returnPercent in
                    try await viewModel.saveInvestment(
                        investment: mode.investment,
                        type: type,
                        name: name,
                        startingBalance: balance,
                        monthlyContribution: contribution,
                        returnPercent: returnPercent
                    )
                    investmentSheet = nil
                },
                onDelete: {
                    if let investment = mode.investment {
                        try await viewModel.deleteInvestment(investment)
                    }
                    investmentSheet = nil
                }
            )
        }
        .sheet(item: $propertySheet) { mode in
            PropertyEditorSheet(
                mode: mode,
                onSave: { name, propertyType, usageType, value, loan, mortgage, rent, expenses, appreciation, scenario, linkedAccountId in
                    try await viewModel.saveProperty(
                        property: mode.property,
                        name: name,
                        propertyType: propertyType,
                        usageType: usageType,
                        currentEstimatedValue: value,
                        currentLoanBalance: loan,
                        monthlyMortgagePayment: mortgage,
                        monthlyRent: rent,
                        totalMonthlyExpenses: expenses,
                        appreciationPercent: appreciation,
                        forecastScenario: scenario,
                        linkedPlaidAccountId: linkedAccountId
                    )
                    propertySheet = nil
                },
                onDelete: {
                    if let property = mode.property {
                        try await viewModel.deleteProperty(property)
                    }
                    propertySheet = nil
                },
                mortgageAccounts: viewModel.mortgageAccountCandidates
            )
        }
        .sheet(item: $investmentDetailSheet) { investment in
            InvestmentDetailSheet(
                investment: investment,
                onEdit: {
                    investmentDetailSheet = nil
                    investmentSheet = .edit(investment)
                }
            )
        }
        .sheet(item: $propertyDetailSheet) { property in
            PropertyDetailSheet(
                property: property,
                linkedMortgageAccount: viewModel.linkedAccount(for: property),
                onEdit: {
                    propertyDetailSheet = nil
                    propertySheet = .edit(property)
                },
                onLoadProjection: {
                    try await viewModel.loadProjection(for: property)
                }
            )
        }
        .sheet(item: actionMessageBinding) { message in
            FinGlassSheet(title: message.title) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 44, weight: .semibold))
                        .foregroundStyle(FinTheme.ColorToken.positive)
                    Text(message.message)
                        .font(.body)
                        .foregroundStyle(.secondary)
                    Button {
                        viewModel.clearActionMessage()
                    } label: {
                        Text("Done").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
        }
        .task {
            await viewModel.load()
        }
    }

    private var actionMessageBinding: Binding<InvestmentActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: FinTheme.Spacing.large) {
                if let summary = viewModel.summary {
                    InvestmentSummaryCard(summary: summary)
                }

                if let activeScenario = viewModel.activeScenario {
                    InvestmentScenarioCard(scenario: activeScenario)
                }

                if !viewModel.forecast.isEmpty {
                    InvestmentForecastSection(forecast: viewModel.forecast)
                }

                if !viewModel.allocation.sections.isEmpty {
                    AllocationSectionView(sections: viewModel.allocation.sections)
                }

                InvestmentsListSection(
                    investments: viewModel.investments,
                    onAdd: { investmentSheet = .create },
                    onSelect: { investmentDetailSheet = $0 }
                )

                PropertiesListSection(
                    properties: viewModel.properties,
                    onAdd: { propertySheet = .create },
                    onSelect: { propertyDetailSheet = $0 }
                )
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

private struct InvestmentSummaryCard: View {
    let summary: InvestmentSummary

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                    Text("Portfolio")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(CurrencyFormatter.formatCompact(summary.totalCurrentPortfolio))
                        .font(.largeTitle.weight(.bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: FinTheme.Spacing.medium) {
                    InvestmentMetric(title: "Invested", value: CurrencyFormatter.formatCompact(summary.totalBalance), systemImage: "chart.line.uptrend.xyaxis")
                    InvestmentMetric(title: "Real estate", value: CurrencyFormatter.formatCompact(summary.totalRealEstateEquity), systemImage: "house.fill")
                    InvestmentMetric(title: "Monthly", value: CurrencyFormatter.formatCompact(summary.totalMonthly), systemImage: "calendar.badge.plus")
                    InvestmentMetric(title: "5-year", value: CurrencyFormatter.formatCompact(summary.forecastedPortfolio), systemImage: "sparkles")
                }
            }
        }
    }
}

private struct InvestmentMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        HStack(spacing: FinTheme.Spacing.small) {
            Image(systemName: systemImage)
                .foregroundStyle(FinTheme.ColorToken.accent)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct InvestmentScenarioCard: View {
    let scenario: ForecastScenario

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "sparkles")
                .foregroundStyle(FinTheme.ColorToken.accent)
                .frame(width: 36, height: 36)
                .background(FinTheme.ColorToken.accent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text("Active scenario")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(scenario.name) forecast uses \(scenario.investmentReturn.scenarioPercentDisplay) returns")
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }

            Spacer()
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct InvestmentForecastSection: View {
    let forecast: [InvestmentForecast]

    private var totalPoints: [InvestmentForecastPoint] {
        guard let firstForecast = forecast.first else { return [] }
        return firstForecast.projections.map { point in
            let total = forecast.reduce(0) { sum, item in
                sum + (item.projections.first { $0.month == point.month }?.balance ?? 0)
            }
            return InvestmentForecastPoint(month: point.month, balance: total)
        }
    }

    private var sampledPoints: [InvestmentForecastPoint] {
        let points = totalPoints
        guard points.count > 6 else { return points }
        let step = max(1, points.count / 6)
        let sampled = stride(from: 0, to: points.count, by: step).map { points[$0] }
        return Array(sampled.prefix(6))
    }

    private var maxBalance: Double {
        max(sampledPoints.map(\.balance).max() ?? 0, 1)
    }

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                HStack {
                    Text("Forecast")
                        .font(.headline)
                    Spacer()
                    if let last = totalPoints.last {
                        Text(CurrencyFormatter.formatCompact(last.balance))
                            .font(.subheadline.weight(.semibold))
                    }
                }

                HStack(alignment: .bottom, spacing: FinTheme.Spacing.small) {
                    ForEach(sampledPoints) { point in
                        VStack(spacing: FinTheme.Spacing.xSmall) {
                            Text(CurrencyFormatter.formatCompact(point.balance))
                                .font(.caption2.weight(.semibold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                            GeometryReader { proxy in
                                VStack {
                                    Spacer(minLength: 0)
                                    RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous)
                                        .fill(FinTheme.ColorToken.accent)
                                        .frame(height: max(4, proxy.size.height * (point.balance / maxBalance)))
                                }
                            }
                            .frame(height: 112)
                            Text(DateFormatterProvider.shortMonth(point.dateValue))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }
}

private struct AllocationSectionView: View {
    let sections: [PortfolioAllocationSection]

    var total: Double { sections.reduce(0) { $0 + $1.value } }

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                Text("Allocation")
                    .font(.headline)

                ForEach(sections) { section in
                    VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                        HStack {
                            Text(section.label)
                                .font(.subheadline.weight(.medium))
                            Spacer()
                            Text(CurrencyFormatter.formatCompact(section.value))
                                .font(.subheadline.weight(.semibold))
                        }

                        GeometryReader { proxy in
                            Capsule()
                                .fill(FinTheme.ColorToken.elevatedSurface)
                                .overlay(alignment: .leading) {
                                    Capsule()
                                        .fill(FinTheme.ColorToken.accent)
                                        .frame(width: proxy.size.width * progress(for: section))
                                }
                        }
                        .frame(height: 7)
                    }
                }
            }
        }
    }

    private func progress(for section: PortfolioAllocationSection) -> Double {
        guard total > 0 else { return 0 }
        return min(1, section.value / total)
    }
}

private struct InvestmentsListSection: View {
    let investments: [InvestmentItem]
    let onAdd: () -> Void
    let onSelect: (InvestmentItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            sectionHeader(title: "Manual investments", systemImage: "plus.circle", action: onAdd)

            if investments.isEmpty {
                emptyState("No manual investments yet")
            } else {
                ForEach(investments) { investment in
                    Button { onSelect(investment) } label: {
                        InvestmentRow(investment: investment)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct PropertiesListSection: View {
    let properties: [RealEstateProperty]
    let onAdd: () -> Void
    let onSelect: (RealEstateProperty) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            sectionHeader(title: "Real estate", systemImage: "house.fill", action: onAdd)

            if properties.isEmpty {
                emptyState("No properties yet")
            } else {
                ForEach(properties) { property in
                    Button { onSelect(property) } label: {
                        PropertyRow(property: property)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private func sectionHeader(title: String, systemImage: String, action: @escaping () -> Void) -> some View {
    HStack {
        Text(title)
            .font(.headline)
        Spacer()
        Button(action: action) {
            Image(systemName: systemImage)
        }
        .buttonStyle(.bordered)
        .clipShape(Circle())
    }
}

private func emptyState(_ title: String) -> some View {
    Text(title)
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(FinTheme.Spacing.large)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
}

private struct InvestmentRow: View {
    let investment: InvestmentItem

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: investment.isPlaidBacked ? "building.columns.fill" : "chart.line.uptrend.xyaxis")
                .foregroundStyle(FinTheme.ColorToken.accent)
                .frame(width: 38, height: 38)
                .background(FinTheme.ColorToken.accent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(investment.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(rowSubtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(CurrencyFormatter.formatCompact(investment.startingBalance))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text("+\(CurrencyFormatter.formatCompact(investment.monthlyContribution))/mo")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }

    private var rowSubtitle: String {
        if investment.isPlaidBacked {
            return [investment.institutionName, investment.accountSubtype?.capitalized]
                .compactMap { $0 }
                .joined(separator: " - ")
        }
        return "\(investment.type.title) - \(String(format: "%.1f", investment.returnPercent))% return"
    }
}

private struct PropertyRow: View {
    let property: RealEstateProperty

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "house.fill")
                .foregroundStyle(FinTheme.ColorToken.accent)
                .frame(width: 38, height: 38)
                .background(FinTheme.ColorToken.accent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(property.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text("\(property.propertyType.title) - \(property.usageType.title)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(CurrencyFormatter.formatCompact(property.equity))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(CurrencyFormatter.formatCompact(property.currentEstimatedValue))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private enum InvestmentSheetMode: Identifiable {
    case create
    case edit(InvestmentItem)

    var id: String {
        switch self {
        case .create: "create-investment"
        case .edit(let investment): investment.id
        }
    }

    var investment: InvestmentItem? {
        if case .edit(let investment) = self { return investment }
        return nil
    }
}

private enum PropertySheetMode: Identifiable {
    case create
    case edit(RealEstateProperty)

    var id: String {
        switch self {
        case .create: "create-property"
        case .edit(let property): property.id
        }
    }

    var property: RealEstateProperty? {
        if case .edit(let property) = self { return property }
        return nil
    }
}

private struct InvestmentDetailSheet: View {
    let investment: InvestmentItem
    let onEdit: () -> Void

    var body: some View {
        FinGlassSheet(title: investment.name) {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                HStack(spacing: FinTheme.Spacing.medium) {
                    Image(systemName: investment.isPlaidBacked ? "building.columns.fill" : "chart.line.uptrend.xyaxis")
                        .font(.title2)
                        .foregroundStyle(FinTheme.ColorToken.accent)
                        .frame(width: 46, height: 46)
                        .background(FinTheme.ColorToken.accent.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))

                    VStack(alignment: .leading, spacing: 3) {
                        Text(investment.isPlaidBacked ? "Plaid investment account" : "Manual investment")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(CurrencyFormatter.formatCompact(investment.startingBalance))
                            .font(.largeTitle.weight(.bold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: FinTheme.Spacing.medium) {
                    DetailMetric(title: "Type", value: investment.type.title, systemImage: "chart.pie.fill")
                    DetailMetric(title: "Monthly", value: CurrencyFormatter.formatCompact(investment.monthlyContribution), systemImage: "calendar.badge.plus")
                    DetailMetric(title: "Return", value: "\(String(format: "%.1f", investment.returnPercent))%", systemImage: "percent")
                    DetailMetric(title: "Source", value: investment.isPlaidBacked ? "Plaid" : "Manual", systemImage: investment.isPlaidBacked ? "link" : "pencil")
                }

                if investment.isPlaidBacked {
                    VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                        Text("Account details")
                            .font(.headline)
                        DetailLine(title: "Institution", value: investment.institutionName ?? "Connected account")
                        DetailLine(title: "Subtype", value: investment.accountSubtype?.capitalized ?? "Investment")
                        DetailLine(title: "Mask", value: investment.accountMask.map { "...\($0)" } ?? "Not reported")
                        DetailLine(title: "Last balance sync", value: investment.lastBalanceSyncAt.map(DateFormatterProvider.fullDate) ?? "Not synced yet")
                    }
                    .padding(FinTheme.Spacing.medium)
                    .background(FinTheme.ColorToken.surface)
                    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
                }

                Button(action: onEdit) {
                    Label(investment.isPlaidBacked ? "Edit forecast assumptions" : "Edit investment", systemImage: "slider.horizontal.3")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
        }
    }
}

private struct DetailMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        HStack(spacing: FinTheme.Spacing.small) {
            Image(systemName: systemImage)
                .foregroundStyle(FinTheme.ColorToken.accent)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct DetailLine: View {
    let title: String
    let value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.caption.weight(.semibold))
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct PropertyDetailSheet: View {
    let property: RealEstateProperty
    let linkedMortgageAccount: LinkedPlaidAccountSummary?
    let onEdit: () -> Void
    let onLoadProjection: () async throws -> RealEstateProjection

    @State private var projection: RealEstateProjection?
    @State private var isLoadingProjection = true
    @State private var errorMessage: String?

    var body: some View {
        FinGlassSheet(title: property.name) {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                PropertyDetailSummary(property: property)

                if let linkedMortgageAccount {
                    LinkedMortgageAccountCard(account: linkedMortgageAccount)
                }

                PropertyCashFlowSection(property: property)

                VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                    HStack {
                        Text("Projection")
                            .font(.headline)
                        Spacer()
                        Text(property.forecastScenario?.title ?? "Standard")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    if isLoadingProjection {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, FinTheme.Spacing.large)
                    } else if let projection {
                        RealEstateProjectionChart(projection: projection)
                    } else if let errorMessage {
                        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(FinTheme.ColorToken.destructive)
                            Button {
                                Task { await loadProjection() }
                            } label: {
                                Label("Retry", systemImage: "arrow.clockwise")
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }

                Button(action: onEdit) {
                    Label("Edit property", systemImage: "pencil")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
        }
        .task { await loadProjection() }
    }

    private func loadProjection() async {
        isLoadingProjection = true
        errorMessage = nil
        defer { isLoadingProjection = false }

        do {
            projection = try await onLoadProjection()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct PropertyDetailSummary: View {
    let property: RealEstateProperty

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack(spacing: FinTheme.Spacing.medium) {
                InvestmentMetric(title: "Value", value: CurrencyFormatter.formatCompact(property.currentEstimatedValue), systemImage: "house.fill")
                InvestmentMetric(title: "Equity", value: CurrencyFormatter.formatCompact(property.equity), systemImage: "chart.pie.fill")
            }
            HStack(spacing: FinTheme.Spacing.medium) {
                InvestmentMetric(title: "Loan", value: CurrencyFormatter.formatCompact(property.currentLoanBalance), systemImage: "building.columns.fill")
                InvestmentMetric(title: "Cash flow", value: CurrencyFormatter.formatCompact(property.monthlyCashFlow), systemImage: "arrow.left.arrow.right")
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct LinkedMortgageAccountCard: View {
    let account: LinkedPlaidAccountSummary

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack(spacing: FinTheme.Spacing.medium) {
                Image(systemName: "link.circle.fill")
                    .foregroundStyle(FinTheme.ColorToken.accent)
                    .frame(width: 36, height: 36)
                    .background(FinTheme.ColorToken.accent.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text("Linked mortgage account")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(account.maskedName)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                }

                Spacer()
            }

            DetailLine(title: "Institution", value: account.institutionName)
            DetailLine(title: "Balance", value: CurrencyFormatter.formatCompact(abs(account.balance)))
            DetailLine(title: "Last sync", value: account.lastBalanceSyncAt.map(DateFormatterProvider.fullDate) ?? "Not synced yet")
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct PropertyCashFlowSection: View {
    let property: RealEstateProperty

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            Text("Cash flow")
                .font(.headline)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: FinTheme.Spacing.medium) {
                DetailMetric(title: "Income", value: CurrencyFormatter.formatCompact(property.totalMonthlyIncome), systemImage: "arrow.down.circle.fill")
                DetailMetric(title: "Mortgage", value: CurrencyFormatter.formatCompact(property.monthlyMortgagePayment ?? 0), systemImage: "building.columns.fill")
                DetailMetric(title: "Expenses", value: CurrencyFormatter.formatCompact(property.effectiveMonthlyExpenses), systemImage: "wrench.and.screwdriver.fill")
                DetailMetric(title: "Net", value: CurrencyFormatter.formatCompact(property.monthlyCashFlow), systemImage: "equal.circle.fill")
            }

            if let interestRate = property.interestRate {
                DetailLine(title: "Interest rate", value: "\(String(format: "%.2f", interestRate * 100))%")
            }
            if let remainingTermMonths = property.remainingTermMonths {
                DetailLine(title: "Remaining term", value: "\(remainingTermMonths) months")
            }
            if let appreciationRate = property.appreciationRate {
                DetailLine(title: "Appreciation", value: "\(String(format: "%.1f", appreciationRate * 100))%")
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.elevatedSurface.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct RealEstateProjectionChart: View {
    let projection: RealEstateProjection

    private var maxEquity: Double {
        max(projection.projections.map(\.equity).max() ?? 0, 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack(spacing: FinTheme.Spacing.small) {
                InvestmentMetric(title: "Final equity", value: CurrencyFormatter.formatCompact(projection.summary.finalEquity), systemImage: "checkmark.seal.fill")
                InvestmentMetric(title: "Appreciation", value: CurrencyFormatter.formatCompact(projection.summary.totalAppreciation), systemImage: "arrow.up.right.circle.fill")
            }

            HStack(alignment: .bottom, spacing: FinTheme.Spacing.small) {
                ForEach(projection.projections) { point in
                    VStack(spacing: FinTheme.Spacing.xSmall) {
                        Text(CurrencyFormatter.formatCompact(point.equity))
                            .font(.caption2.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        GeometryReader { proxy in
                            VStack {
                                Spacer(minLength: 0)
                                RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous)
                                    .fill(FinTheme.ColorToken.positive)
                                    .frame(height: max(4, proxy.size.height * (point.equity / maxEquity)))
                            }
                        }
                        .frame(height: 112)
                        Text("Y\(point.year)")
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

private struct InvestmentEditorSheet: View {
    let mode: InvestmentSheetMode
    let onSave: (InvestmentType, String, Double, Double, Double) async throws -> Void
    let onDelete: () async throws -> Void

    @State private var type: InvestmentType
    @State private var name: String
    @State private var balance: String
    @State private var monthlyContribution: String
    @State private var returnPercent: String
    @State private var isDeleteConfirmationPresented = false
    @State private var isWorking = false
    @State private var errorMessage: String?

    init(
        mode: InvestmentSheetMode,
        onSave: @escaping (InvestmentType, String, Double, Double, Double) async throws -> Void,
        onDelete: @escaping () async throws -> Void
    ) {
        self.mode = mode
        self.onSave = onSave
        self.onDelete = onDelete
        let investment = mode.investment
        _type = State(initialValue: investment?.type ?? .stocks)
        _name = State(initialValue: investment?.name ?? "")
        _balance = State(initialValue: investment.map { String(format: "%.0f", $0.startingBalance) } ?? "")
        _monthlyContribution = State(initialValue: investment.map { String(format: "%.0f", $0.monthlyContribution) } ?? "0")
        _returnPercent = State(initialValue: investment.map { String(format: "%.1f", $0.returnPercent) } ?? "7.0")
    }

    var body: some View {
        FinGlassSheet(title: mode.investment == nil ? "Add investment" : "Edit investment") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                TextField("Name", text: $name)
                    .textFieldStyle(.roundedBorder)

                Picker("Type", selection: $type) {
                    ForEach(InvestmentType.allCases.filter { $0 != .realEstate }) { type in
                        Text(type.title).tag(type)
                    }
                }
                .pickerStyle(.menu)
                .disabled(mode.investment?.isPlaidBacked == true)

                currencyField("Starting balance", text: $balance)
                    .disabled(mode.investment?.isPlaidBacked == true)
                if mode.investment?.isPlaidBacked == true {
                    Text("Plaid account balances stay synced from the connected institution.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                currencyField("Monthly contribution", text: $monthlyContribution)
                percentField("Annual return", text: $returnPercent)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.destructive)
                }

                HStack(spacing: FinTheme.Spacing.medium) {
                    if mode.investment != nil {
                        Button(role: .destructive) {
                            isDeleteConfirmationPresented = true
                        } label: {
                            Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }

                    Button {
                        Task { await performSave() }
                    } label: {
                        if isWorking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label("Save", systemImage: "checkmark").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWorking)
                }
            }
        }
        .sheet(isPresented: $isDeleteConfirmationPresented) {
            FinGlassSheet(title: "Delete investment") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text(name.isEmpty ? "Investment" : name)
                        .font(.headline)
                    Text("This removes the manual investment from portfolio totals and forecast charts.")
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
                                Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
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
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty,
              let balanceValue = Double(balance),
              let contributionValue = Double(monthlyContribution),
              let returnValue = Double(returnPercent)
        else {
            errorMessage = "Fill out the investment details."
            return
        }

        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onSave(type, trimmedName, balanceValue, contributionValue, returnValue)
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

private struct PropertyEditorSheet: View {
    let mode: PropertySheetMode
    let onSave: (String, RealEstatePropertyType, RealEstateUsageType, Double, Double, Double, Double, Double, Double, RealEstateForecastScenario, String?) async throws -> Void
    let onDelete: () async throws -> Void
    let mortgageAccounts: [LinkedPlaidAccountSummary]

    @State private var name: String
    @State private var propertyType: RealEstatePropertyType
    @State private var usageType: RealEstateUsageType
    @State private var currentValue: String
    @State private var loanBalance: String
    @State private var mortgagePayment: String
    @State private var monthlyRent: String
    @State private var monthlyExpenses: String
    @State private var appreciationPercent: String
    @State private var forecastScenario: RealEstateForecastScenario
    @State private var linkedPlaidAccountId: String?
    @State private var isDeleteConfirmationPresented = false
    @State private var isWorking = false
    @State private var errorMessage: String?

    init(
        mode: PropertySheetMode,
        onSave: @escaping (String, RealEstatePropertyType, RealEstateUsageType, Double, Double, Double, Double, Double, Double, RealEstateForecastScenario, String?) async throws -> Void,
        onDelete: @escaping () async throws -> Void,
        mortgageAccounts: [LinkedPlaidAccountSummary]
    ) {
        self.mode = mode
        self.onSave = onSave
        self.onDelete = onDelete
        self.mortgageAccounts = mortgageAccounts
        let property = mode.property
        _name = State(initialValue: property?.name ?? "")
        _propertyType = State(initialValue: property?.propertyType ?? .singleFamily)
        _usageType = State(initialValue: property?.usageType ?? .primaryResidence)
        _currentValue = State(initialValue: property.map { String(format: "%.0f", $0.currentEstimatedValue) } ?? "")
        _loanBalance = State(initialValue: property.map { String(format: "%.0f", $0.currentLoanBalance) } ?? "0")
        _mortgagePayment = State(initialValue: property?.monthlyMortgagePayment.map { String(format: "%.0f", $0) } ?? "0")
        _monthlyRent = State(initialValue: property?.monthlyRent.map { String(format: "%.0f", $0) } ?? "0")
        _monthlyExpenses = State(initialValue: property?.totalMonthlyExpenses.map { String(format: "%.0f", $0) } ?? "0")
        _appreciationPercent = State(initialValue: property?.appreciationRate.map { String(format: "%.1f", $0 * 100) } ?? "3.0")
        _forecastScenario = State(initialValue: property?.forecastScenario ?? .standard)
        _linkedPlaidAccountId = State(initialValue: property?.linkedPlaidAccountId)
    }

    var body: some View {
        FinGlassSheet(title: mode.property == nil ? "Add property" : "Edit property") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                TextField("Property name", text: $name)
                    .textFieldStyle(.roundedBorder)

                Picker("Property type", selection: $propertyType) {
                    ForEach(RealEstatePropertyType.allCases) { type in
                        Text(type.title).tag(type)
                    }
                }

                Picker("Usage", selection: $usageType) {
                    ForEach(RealEstateUsageType.allCases) { type in
                        Text(type.title).tag(type)
                    }
                }

                Picker("Forecast", selection: $forecastScenario) {
                    ForEach(RealEstateForecastScenario.allCases) { scenario in
                        Text(scenario.title).tag(scenario)
                    }
                }

                currencyField("Estimated value", text: $currentValue)
                currencyField("Loan balance", text: $loanBalance)
                MortgageAccountLinkPicker(
                    accounts: mortgageAccounts,
                    selectedAccountId: $linkedPlaidAccountId,
                    onLink: { account in
                        loanBalance = String(format: "%.0f", abs(account.balance))
                    }
                )
                currencyField("Mortgage payment", text: $mortgagePayment)
                currencyField("Monthly rent", text: $monthlyRent)
                currencyField("Monthly expenses", text: $monthlyExpenses)
                percentField("Appreciation", text: $appreciationPercent)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.destructive)
                }

                HStack(spacing: FinTheme.Spacing.medium) {
                    if mode.property != nil {
                        Button(role: .destructive) {
                            isDeleteConfirmationPresented = true
                        } label: {
                            Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }

                    Button {
                        Task { await performSave() }
                    } label: {
                        if isWorking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label("Save", systemImage: "checkmark").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWorking)
                }
            }
        }
        .sheet(isPresented: $isDeleteConfirmationPresented) {
            FinGlassSheet(title: "Delete property") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text(name.isEmpty ? "Property" : name)
                        .font(.headline)
                    Text("This removes the property from real-estate equity, allocation, and forecast totals.")
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
                                Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
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
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty,
              let value = Double(currentValue),
              let loan = Double(loanBalance),
              let mortgage = Double(mortgagePayment),
              let rent = Double(monthlyRent),
              let expenses = Double(monthlyExpenses),
              let appreciation = Double(appreciationPercent)
        else {
            errorMessage = "Fill out the property details."
            return
        }

        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onSave(trimmedName, propertyType, usageType, value, loan, mortgage, rent, expenses, appreciation, forecastScenario, linkedPlaidAccountId ?? "")
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

private struct MortgageAccountLinkPicker: View {
    let accounts: [LinkedPlaidAccountSummary]
    @Binding var selectedAccountId: String?
    let onLink: (LinkedPlaidAccountSummary) -> Void

    private var selectedAccount: LinkedPlaidAccountSummary? {
        guard let selectedAccountId else { return nil }
        return accounts.first { $0.id == selectedAccountId }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
            HStack {
                Text("Linked mortgage account")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                if selectedAccount != nil {
                    Button(role: .destructive) {
                        selectedAccountId = nil
                    } label: {
                        Label("Unlink", systemImage: "link.badge.minus")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.mini)
                }
            }

            Menu {
                if accounts.isEmpty {
                    Button("No connected accounts") {}
                        .disabled(true)
                } else {
                    ForEach(accounts) { account in
                        Button {
                            selectedAccountId = account.id
                            onLink(account)
                        } label: {
                            Label(account.maskedName, systemImage: account.isMortgageCandidate ? "building.columns.fill" : "creditcard.fill")
                        }
                    }
                }
            } label: {
                HStack {
                    Label(selectedAccount?.maskedName ?? "Select connected account", systemImage: selectedAccount == nil ? "link" : "link.circle.fill")
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(FinTheme.Spacing.medium)
                .background(FinTheme.ColorToken.surface)
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
            }

            Text(selectedAccount == nil ? "Link a loan or mortgage account to sync the loan balance." : "Loan balance is seeded from the linked account and updates when Plaid syncs.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

private func currencyField(_ title: String, text: Binding<String>) -> some View {
    VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
        Text(title)
            .font(.subheadline.weight(.semibold))
        TextField("0", text: text)
            .keyboardType(.decimalPad)
            .textFieldStyle(.roundedBorder)
    }
}

private func percentField(_ title: String, text: Binding<String>) -> some View {
    VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
        Text(title)
            .font(.subheadline.weight(.semibold))
        TextField("0", text: text)
            .keyboardType(.decimalPad)
            .textFieldStyle(.roundedBorder)
    }
}

#Preview {
    NavigationStack {
        InvestmentsView()
    }
}
