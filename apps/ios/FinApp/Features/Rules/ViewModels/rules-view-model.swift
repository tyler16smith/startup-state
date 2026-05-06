import Foundation

@MainActor
final class RulesViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var rules: [TransactionRule] = []
    @Published private(set) var settings: RuleSettings?
    @Published private(set) var categories: [CategoryItem] = []
    @Published private(set) var actionMessage: RuleActionMessage?

    private let service: RulesService

    init(service: RulesService = RulesService()) {
        self.service = service
    }

    var activeCount: Int { rules.filter(\.isActive).count }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false)
    }

    func save(rule: TransactionRule?, draft: EditableRuleDraft) async throws {
        try validate(draft)
        let result = try await service.save(rule: rule, draft: draft)
        actionMessage = RuleActionMessage(title: rule == nil ? "Rule created" : "Rule updated", message: result.name)
        await refresh()
    }

    func delete(_ rule: TransactionRule) async throws {
        try await service.delete(id: rule.id)
        actionMessage = RuleActionMessage(title: "Rule deleted", message: rule.name)
        await refresh()
    }

    func toggleActive(_ rule: TransactionRule) async {
        await performAction(title: rule.isActive ? "Rule disabled" : "Rule enabled") {
            try await service.toggleActive(id: rule.id, isActive: !rule.isActive)
            return rule.name
        }
        await refresh()
    }

    func preview(_ rule: TransactionRule) async {
        await performAction(title: "Matching transactions") {
            let result = try await service.previewConditions(draft: EditableRuleDraft(rule: rule))
            let samples = result.preview.map(\.displayTitle).joined(separator: ", ")
            if samples.isEmpty {
                return "\(result.totalCount) transactions match \(rule.name)."
            }

            return "\(result.totalCount) transactions match \(rule.name). Samples: \(samples)."
        }
    }

    func previewDraft(rule: TransactionRule?, draft: EditableRuleDraft) async throws -> RuleDraftPreview {
        try validate(draft)
        return try await service.previewConditions(draft: draft, appliedRuleId: rule?.id)
    }

    func move(_ rule: TransactionRule, direction: RuleMoveDirection) async {
        guard let index = rules.firstIndex(where: { $0.id == rule.id }) else { return }

        let targetIndex: Int
        switch direction {
        case .up:
            targetIndex = index - 1
        case .down:
            targetIndex = index + 1
        }

        guard rules.indices.contains(targetIndex) else { return }

        var ordered = rules
        ordered.swapAt(index, targetIndex)
        rules = ordered

        await performAction(title: "Rule order updated") {
            try await service.reorder(orderedIds: ordered.map(\.id))
            return rule.name
        }
        await refresh()
    }

    func applyHistorical(_ rule: TransactionRule) async {
        await performAction(title: "Historical apply complete") {
            let result = try await service.applyHistorical(id: rule.id)
            return "Updated \(result.displayCount) transactions for \(rule.name)."
        }
        await refresh()
    }

    func updatePreference(_ preference: RuleExecutionPreference) async {
        await performAction(title: "Preference updated") {
            settings = try await service.updateSettings(preference)
            return preference.title
        }
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            let result = try await service.load()
            rules = result.rules
            settings = result.settings
            categories = result.categories
            state = .loaded
        } catch {
            state = .error(error)
        }
    }

    private func performAction(title: String, operation: () async throws -> String) async {
        state = .refreshing

        do {
            let message = try await operation()
            actionMessage = RuleActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            actionMessage = RuleActionMessage(title: title, message: error.localizedDescription)
            state = .loaded
        }
    }

    private func validate(_ draft: EditableRuleDraft) throws {
        if draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw RuleValidationError.emptyName
        }

        for condition in draft.conditions where condition.operatorValue.needsValue {
            if condition.field.usesNumber {
                if Double(condition.conditionNumber) == nil {
                    throw RuleValidationError.invalidCondition
                }
                if condition.operatorValue == .between, Double(condition.secondConditionNumber) == nil {
                    throw RuleValidationError.invalidCondition
                }
            }

            if !condition.field.usesNumber && !condition.field.usesDate && condition.conditionText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                throw RuleValidationError.invalidCondition
            }
        }

        for action in draft.actions where action.actionType != .setType {
            if action.actionText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                throw RuleValidationError.invalidAction
            }
        }
    }
}

enum RuleMoveDirection {
    case up
    case down
}

enum RuleValidationError: LocalizedError {
    case emptyName
    case invalidCondition
    case invalidAction

    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Enter a rule name."
        case .invalidCondition:
            return "Fill out the condition."
        case .invalidAction:
            return "Fill out the action."
        }
    }
}