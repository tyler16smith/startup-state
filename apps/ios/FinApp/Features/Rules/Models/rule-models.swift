import Foundation

enum RuleField: String, Codable, CaseIterable, Identifiable {
    case merchant = "MERCHANT"
    case description = "DESCRIPTION"
    case amount = "AMOUNT"
    case category = "CATEGORY"
    case date = "DATE"
    case account = "ACCOUNT"
    case notes = "NOTES"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .merchant: "Merchant"
        case .description: "Description"
        case .amount: "Amount"
        case .category: "Category"
        case .date: "Date"
        case .account: "Account"
        case .notes: "Notes"
        }
    }

    var usesNumber: Bool { self == .amount }
    var usesDate: Bool { self == .date }
}

enum RuleOperator: String, Codable, CaseIterable, Identifiable {
    case contains = "CONTAINS"
    case notContains = "NOT_CONTAINS"
    case startsWith = "STARTS_WITH"
    case endsWith = "ENDS_WITH"
    case equals = "EQUALS"
    case notEquals = "NOT_EQUALS"
    case greaterThan = "GREATER_THAN"
    case greaterThanOrEqual = "GREATER_THAN_OR_EQUAL"
    case lessThan = "LESS_THAN"
    case lessThanOrEqual = "LESS_THAN_OR_EQUAL"
    case isEmpty = "IS_EMPTY"
    case isNotEmpty = "IS_NOT_EMPTY"
    case before = "BEFORE"
    case after = "AFTER"
    case on = "ON"
    case between = "BETWEEN"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .contains: "Contains"
        case .notContains: "Does not contain"
        case .startsWith: "Starts with"
        case .endsWith: "Ends with"
        case .equals: "Equals"
        case .notEquals: "Does not equal"
        case .greaterThan: "Greater than"
        case .greaterThanOrEqual: "Greater than or equal"
        case .lessThan: "Less than"
        case .lessThanOrEqual: "Less than or equal"
        case .isEmpty: "Is empty"
        case .isNotEmpty: "Is not empty"
        case .before: "Before"
        case .after: "After"
        case .on: "On"
        case .between: "Between"
        }
    }

    var needsValue: Bool {
        self != .isEmpty && self != .isNotEmpty
    }

    static let textOperators: [RuleOperator] = [.contains, .notContains, .startsWith, .endsWith, .equals, .notEquals, .isEmpty, .isNotEmpty]
    static let numberOperators: [RuleOperator] = [.equals, .notEquals, .greaterThan, .greaterThanOrEqual, .lessThan, .lessThanOrEqual, .between]
    static let dateOperators: [RuleOperator] = [.before, .after, .on, .between]
}

enum RuleActionType: String, Codable, CaseIterable, Identifiable {
    case setCategory = "SET_CATEGORY"
    case setDescription = "SET_DESCRIPTION"
    case setType = "SET_TYPE"
    case addHashtag = "ADD_HASHTAG"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .setCategory: "Set category"
        case .setDescription: "Set description"
        case .setType: "Set type"
        case .addHashtag: "Add hashtag"
        }
    }
}

enum RuleExecutionPreference: String, Codable, CaseIterable, Identifiable {
    case alwaysAsk = "ALWAYS_ASK"
    case applyHistorical = "APPLY_HISTORICAL"
    case futureOnly = "FUTURE_ONLY"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .alwaysAsk: "Always ask"
        case .applyHistorical: "Apply historical"
        case .futureOnly: "Future only"
        }
    }
}

struct TransactionRule: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let isActive: Bool
    let priority: Int
    let applyModePreference: String?
    let createdAt: Date?
    let updatedAt: Date?
    let conditions: [RuleCondition]
    let actions: [RuleAction]
}

struct RuleCondition: Decodable, Identifiable, Equatable {
    let id: String?
    let sortOrder: Int?
    let field: RuleField
    let operatorValue: RuleOperator
    let valueText: String?
    let valueNumber: Double?
    let valueDate: Date?
    let secondValueNumber: Double?
    let secondValueDate: Date?

    private enum CodingKeys: String, CodingKey {
        case id
        case sortOrder
        case field
        case operatorValue = "operator"
        case valueText
        case valueNumber
        case valueDate
        case secondValueNumber
        case secondValueDate
    }

    var displayValue: String {
        if let valueText, !valueText.isEmpty { return valueText }
        if let valueNumber { return CurrencyFormatter.formatCompact(valueNumber) }
        if let valueDate { return DateFormatterProvider.fullDate(valueDate) }
        return operatorValue.needsValue ? "-" : ""
    }
}

struct RuleAction: Decodable, Identifiable, Equatable {
    let id: String?
    let sortOrder: Int?
    let type: RuleActionType
    let valueText: String?
    let hashtagId: String?
    let hashtag: HashtagSummary?

    var displayValue: String {
        hashtag?.name ?? valueText ?? "-"
    }
}

struct RuleSettings: Decodable, Equatable {
    let ruleExecutionPreference: RuleExecutionPreference?
}

struct RulePreviewCount: Decodable, Equatable {
    let count: Int
}

struct RuleDraftPreview: Decodable, Equatable {
    let totalCount: Int
    let preview: [RulePreviewTransaction]
}

struct RulePreviewTransaction: Decodable, Identifiable, Equatable {
    let id: String
    let date: Date
    let description: String?
    let amount: Double
    let type: TransactionKind
    let category: String?
    let account: String?
    let hashtags: [String]

    var displayTitle: String {
        trimmed(description) ?? "Transaction"
    }

    var displaySubtitle: String {
        [trimmed(category), trimmed(account), DateFormatterProvider.fullDate(date)]
            .compactMap { $0 }
            .joined(separator: " - ")
    }
}

struct HistoricalApplyResult: Decodable, Equatable {
    let updated: Int?
    let count: Int?
    let success: Bool?

    var displayCount: Int { updated ?? count ?? 0 }
}

struct RulesLoadResult {
    let rules: [TransactionRule]
    let settings: RuleSettings?
    let categories: [CategoryItem]
}

struct RuleActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

struct EditableRuleDraft {
    var name: String
    var conditions: [EditableRuleConditionDraft]
    var actions: [EditableRuleActionDraft]

    init(rule: TransactionRule?) {
        name = rule?.name ?? ""
        conditions = rule?.conditions.map(EditableRuleConditionDraft.init(condition:)) ?? [EditableRuleConditionDraft()]
        actions = rule?.actions.map(EditableRuleActionDraft.init(action:)) ?? [EditableRuleActionDraft()]
    }

    init(name: String, conditions: [EditableRuleConditionDraft], actions: [EditableRuleActionDraft]) {
        self.name = name
        self.conditions = conditions
        self.actions = actions
    }
}

struct EditableRuleConditionDraft: Identifiable, Equatable {
    let id: String
    var field: RuleField
    var operatorValue: RuleOperator
    var conditionText: String
    var conditionNumber: String
    var secondConditionNumber: String
    var conditionDate: Date
    var secondConditionDate: Date

    init() {
        id = UUID().uuidString
        field = .merchant
        operatorValue = .contains
        conditionText = ""
        conditionNumber = ""
        secondConditionNumber = ""
        conditionDate = Date()
        secondConditionDate = Date()
    }

    init(condition: RuleCondition) {
        id = condition.id ?? UUID().uuidString
        field = condition.field
        operatorValue = condition.operatorValue
        conditionText = condition.valueText ?? ""
        conditionNumber = condition.valueNumber.map { String(format: "%.2f", $0) } ?? ""
        secondConditionNumber = condition.secondValueNumber.map { String(format: "%.2f", $0) } ?? ""
        conditionDate = condition.valueDate ?? Date()
        secondConditionDate = condition.secondValueDate ?? Date()
    }

    init(field: RuleField, operatorValue: RuleOperator, text: String) {
        id = UUID().uuidString
        self.field = field
        self.operatorValue = operatorValue
        conditionText = text
        conditionNumber = ""
        secondConditionNumber = ""
        conditionDate = Date()
        secondConditionDate = Date()
    }

    var conditionOperators: [RuleOperator] {
        if field.usesNumber { return RuleOperator.numberOperators }
        if field.usesDate { return RuleOperator.dateOperators }
        return RuleOperator.textOperators
    }
}

struct EditableRuleActionDraft: Identifiable, Equatable {
    let id: String
    var actionType: RuleActionType
    var actionText: String
    var transactionType: TransactionKind

    init() {
        id = UUID().uuidString
        actionType = .setCategory
        actionText = ""
        transactionType = .expense
    }

    init(action: RuleAction) {
        id = action.id ?? UUID().uuidString
        actionType = action.type
        actionText = action.hashtag?.name ?? action.valueText ?? ""
        transactionType = TransactionKind(rawValue: action.valueText ?? "EXPENSE") ?? .expense
    }

    init(actionType: RuleActionType, text: String) {
        id = UUID().uuidString
        self.actionType = actionType
        actionText = text
        transactionType = TransactionKind(rawValue: text) ?? .expense
    }
}

private func trimmed(_ value: String?) -> String? {
    guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
        return nil
    }

    return value
}
