import Foundation

@MainActor
final class ScenariosViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var scenarios: [ForecastScenario] = []
    @Published private(set) var actionMessage: ScenarioActionMessage?

    private let service: ScenariosService

    init(service: ScenariosService = ScenariosService()) {
        self.service = service
    }

    var activeScenario: ForecastScenario? { scenarios.first(where: \.isActive) }

    var averageInvestmentReturn: Double {
        guard !scenarios.isEmpty else { return 0 }
        return scenarios.map(\.investmentReturn).reduce(0, +) / Double(scenarios.count)
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false)
    }

    func save(_ draft: EditableScenarioDraft) async throws {
        let trimmedName = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw ScenarioValidationError.emptyName }

        var normalizedDraft = draft
        normalizedDraft.name = trimmedName

        if draft.sourceId == nil {
            let scenario = try await service.create(normalizedDraft)
            actionMessage = ScenarioActionMessage(title: "Scenario created", message: scenario.name)
        } else {
            let scenario = try await service.update(normalizedDraft)
            actionMessage = ScenarioActionMessage(title: "Scenario updated", message: scenario.name)
        }

        await refresh()
    }

    func delete(_ scenario: ForecastScenario) async throws {
        let deleted = try await service.delete(id: scenario.id)
        actionMessage = ScenarioActionMessage(title: "Scenario deleted", message: deleted.name)
        await refresh()
    }

    func setActive(_ scenario: ForecastScenario?) async {
        await performAction(title: scenario == nil ? "Active scenario cleared" : "Active scenario changed") {
            try await service.setActive(id: scenario?.id)
            return scenario?.name ?? "No active scenario"
        }
        await refresh()
    }

    func seedDefaults() async {
        await performAction(title: "Default scenarios") {
            let result = try await service.seedDefaults()
            return result.seeded ? "Defaults created" : "Defaults already exist"
        }
        await refresh()
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            var loadedScenarios = try await service.load()
            if loadedScenarios.isEmpty {
                let result = try await service.seedDefaults()
                if result.seeded {
                    loadedScenarios = try await service.load()
                }
            }
            scenarios = loadedScenarios
            state = .loaded
        } catch {
            state = .error(error)
        }
    }

    private func performAction(title: String, operation: () async throws -> String) async {
        state = .refreshing

        do {
            let message = try await operation()
            actionMessage = ScenarioActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            actionMessage = ScenarioActionMessage(title: title, message: error.localizedDescription)
            state = .loaded
        }
    }
}

// MARK: - What If

@MainActor
final class WhatIfViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var baseline: WhatIfBaseline?
    @Published private(set) var adjustments: [WhatIfAdjustment] = []

    private let service: ScenariosService

    init(service: ScenariosService = ScenariosService()) {
        self.service = service
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        guard !hasUnsavedChanges else { return }
        await reload(showLoading: false)
    }

    /// Adjust a baseline item (e.g. salary, rent). Resets to baseline when removed.
    func adjustBaseline(_ item: WhatIfBaselineItem, monthlyAmount: Double) {
        if let index = adjustments.firstIndex(where: { $0.id == item.id }) {
            adjustments[index].monthlyAmount = monthlyAmount
        } else {
            adjustments.append(WhatIfAdjustment(
                id: item.id,
                name: item.name,
                type: item.type,
                monthlyAmount: monthlyAmount,
                isCustom: false
            ))
        }
    }

    func clearAdjustment(for item: WhatIfBaselineItem) {
        adjustments.removeAll { $0.id == item.id }
    }

    func addCustomItem(name: String, type: WhatIfItemType, monthlyAmount: Double) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, monthlyAmount > 0 else { return }
        adjustments.append(WhatIfAdjustment(
            id: "custom:\(UUID().uuidString)",
            name: trimmed,
            type: type,
            monthlyAmount: monthlyAmount,
            isCustom: true
        ))
    }

    func removeAdjustment(_ adjustment: WhatIfAdjustment) {
        adjustments.removeAll { $0.id == adjustment.id }
    }

    func resetAllAdjustments() {
        adjustments.removeAll()
    }

    var hasUnsavedChanges: Bool {
        !adjustments.isEmpty
    }

    func adjustment(for item: WhatIfBaselineItem) -> WhatIfAdjustment? {
        adjustments.first { $0.id == item.id }
    }

    /// Effective monthly amount for an item after applying any adjustment.
    func effectiveAmount(for item: WhatIfBaselineItem) -> Double {
        adjustment(for: item)?.monthlyAmount ?? item.monthlyAmount
    }

    /// Adjusted totals across baseline + custom items.
    var projection: WhatIfProjection {
        guard let baseline else {
            return WhatIfProjection(income: 0, expenses: 0, savings: 0, debt: 0)
        }

        var totals = WhatIfProjection(income: 0, expenses: 0, savings: 0, debt: 0)

        for item in baseline.baselineItems {
            let amount = effectiveAmount(for: item)
            totals.add(amount: amount, type: item.type)
        }

        for adj in adjustments where adj.isCustom {
            totals.add(amount: adj.monthlyAmount, type: adj.type)
        }

        return totals
    }

    var customAdjustments: [WhatIfAdjustment] {
        adjustments.filter(\.isCustom)
    }

    var monthlyPlanGroups: [WhatIfMonthlyPlanGroup] {
        guard let baseline else { return [] }

        let order: [WhatIfItemType] = [.income, .expense, .savings, .debt]
        return order.flatMap { type in
            Dictionary(grouping: baseline.baselineItems.filter { $0.type == type }) { item in
                item.category?.trimmingCharacters(in: .whitespacesAndNewlines).whatIfNilIfBlank ?? "Uncategorized"
            }
            .map { category, items in
                let baselineTotal = items.reduce(0) { $0 + $1.monthlyAmount }
                let adjustedTotal = items.reduce(0) { $0 + effectiveAmount(for: $1) }
                return WhatIfMonthlyPlanGroup(
                    id: "\(type.rawValue):\(category)",
                    type: type,
                    category: category,
                    baselineTotal: baselineTotal,
                    adjustedTotal: adjustedTotal,
                    items: items.sorted { $0.name < $1.name }
                )
            }
            .sorted { $0.category < $1.category }
        }
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            baseline = try await service.loadWhatIfBaseline()
            state = .loaded
        } catch {
            state = .error(error)
        }
    }
}

private extension String {
    var whatIfNilIfBlank: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

struct WhatIfProjection: Equatable {
    var income: Double
    var expenses: Double
    var savings: Double
    var debt: Double

    var net: Double { income - expenses - savings - debt }

    mutating func add(amount: Double, type: WhatIfItemType) {
        switch type {
        case .income: income += amount
        case .expense: expenses += amount
        case .savings: savings += amount
        case .debt: debt += amount
        }
    }
}