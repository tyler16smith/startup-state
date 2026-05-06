import Foundation

enum TransactionKind: String, Codable, CaseIterable, Identifiable {
    case income = "INCOME"
    case expense = "EXPENSE"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .income: "Income"
        case .expense: "Expense"
        }
    }
}

enum TransactionSortField: String, CaseIterable, Identifiable {
    case date
    case amount
    case account

    var id: String { rawValue }

    var title: String {
        switch self {
        case .date: "Date"
        case .amount: "Amount"
        case .account: "Account"
        }
    }
}

struct TransactionFilterState: Equatable {
    var search: String = ""
    var category: String?
    var hashtag: String?
    var type: TransactionKind?
    var startDate: Date?
    var endDate: Date?
    var sortField: TransactionSortField = .date
    var sortDescending = true
    var limit = 100
    var cursor = 0

    var hasActiveFilters: Bool {
        !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || category != nil || hashtag != nil || type != nil || startDate != nil || endDate != nil
    }

    var sortTitle: String {
        "\(sortField.title) \(sortDescending ? "desc" : "asc")"
    }

    var dateRangeTitle: String {
        switch (startDate, endDate) {
        case (.some(let startDate), .some(let endDate)):
            return "\(DateFormatterProvider.fullDate(startDate)) - \(DateFormatterProvider.fullDate(endDate))"
        case (.some(let startDate), nil):
            return "From \(DateFormatterProvider.fullDate(startDate))"
        case (nil, .some(let endDate)):
            return "Until \(DateFormatterProvider.fullDate(endDate))"
        case (nil, nil):
            return "Date range"
        }
    }

    var requestBody: JSONValue {
        var body: [String: JSONValue] = [
            "limit": .number(Double(limit)),
            "cursor": .number(Double(cursor)),
            "sortField": .string(sortField.rawValue),
            "sortDir": .string(sortDescending ? "desc" : "asc")
        ]

        let trimmedSearch = search.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedSearch.isEmpty {
            body["search"] = .string(trimmedSearch)
        }

        if let category {
            body["category"] = .string(category)
        }

        if let hashtag {
            body["hashtag"] = .string(hashtag)
        }

        if let type {
            body["type"] = .string(type.rawValue)
        }

        if let startDate {
            body["startDate"] = .string(TransactionDateEncoding.string(from: startDate))
        }

        if let endDate {
            body["endDate"] = .string(TransactionDateEncoding.string(from: endDate))
        }

        return .object(body)
    }
}

struct TransactionListResponse: Decodable {
    let items: [TransactionItem]
    let nextCursor: Int?
}

struct TransactionItem: Decodable, Identifiable, Equatable {
    let id: String
    let date: Date
    let postedDate: Date?
    let amount: Double
    let type: TransactionKind
    let category: String?
    let categoryId: String?
    let description: String?
    let originalDescription: String?
    let merchantName: String?
    let account: String?
    let source: String?
    let pending: Bool?
    let appliedRuleId: String?
    let hashtags: [TransactionHashtagLink]?
    let categoryRef: TransactionCategoryRef?

    var displayTitle: String {
        merchantName.nonEmpty ?? description.nonEmpty ?? originalDescription.nonEmpty ?? "Transaction"
    }

    var displaySubtitle: String {
        let dateText = DateFormatterProvider.fullDate(postedDate ?? date)
        guard let account = account.nonEmpty else { return dateText }
        return "\(account) - \(dateText)"
    }

    var displayCategory: String {
        categoryRef?.name.nonEmpty ?? category.nonEmpty ?? "Uncategorized"
    }

    var signedAmount: Double {
        type == .expense ? -abs(amount) : abs(amount)
    }

    var canEditAmount: Bool {
        source?.uppercased() != "PLAID"
    }

    var hashtagNames: [String] {
        hashtags?.compactMap { $0.hashtag.name.nonEmpty } ?? []
    }
}

struct TransactionCategoryRef: Decodable, Equatable {
    let id: String
    let name: String
}

struct TransactionHashtagLink: Decodable, Equatable {
    let hashtag: HashtagSummary
}

struct HashtagSummary: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let normalizedName: String?
}

struct TransactionSummary: Decodable, Equatable {
    let income: [TransactionSummaryItem]
    let expenses: [TransactionSummaryItem]
    let incomeSum: Double
    let incomeCount: Int
    let expenseSum: Double
    let expenseCount: Int

    var net: Double { incomeSum - expenseSum }
    var totalCount: Int { incomeCount + expenseCount }
}

struct TransactionSummaryItem: Decodable, Equatable {
    let name: String?
    let amount: Double
    let count: Int
}

struct TransactionsLoadResult {
    let list: TransactionListResponse
    let totalCount: Int
    let summary: TransactionSummary
    let categories: [String]
    let hashtags: [HashtagSummary]
}

struct TransactionRulePrompt: Identifiable, Equatable {
    enum Mode: Equatable {
        case create
        case update(ruleId: String)
    }

    enum Action: Equatable {
        case setCategory(String)
        case addHashtag(String)

        var title: String {
            switch self {
            case .setCategory(let category):
                return "Set category to \(category)"
            case .addHashtag(let hashtag):
                return "Add #\(hashtag)"
            }
        }

        var ruleActionDraft: EditableRuleActionDraft {
            switch self {
            case .setCategory(let category):
                return EditableRuleActionDraft(actionType: .setCategory, text: category)
            case .addHashtag(let hashtag):
                return EditableRuleActionDraft(actionType: .addHashtag, text: hashtag)
            }
        }
    }

    let id = UUID()
    let transactionId: String
    let mode: Mode
    let originalDescription: String
    let action: Action

    var title: String {
        switch mode {
        case .create:
            return "Create a rule?"
        case .update:
            return "Update applied rule?"
        }
    }
}

private extension Optional where Wrapped == String {
    var nonEmpty: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}

extension Optional where Wrapped == String {
    var transactionNilIfBlank: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }

        return value
    }
}

private extension String {
    var nonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

private enum TransactionDateEncoding {
    private static let formatter = ISO8601DateFormatter()

    static func string(from date: Date) -> String {
        formatter.string(from: date)
    }
}
