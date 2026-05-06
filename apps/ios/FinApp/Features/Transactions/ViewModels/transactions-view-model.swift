import Foundation

@MainActor
final class TransactionsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var transactions: [TransactionItem] = []
    @Published private(set) var totalCount: Int = 0
    @Published private(set) var summary: TransactionSummary?
    @Published private(set) var categories: [String] = []
    @Published private(set) var hashtags: [HashtagSummary] = []
    @Published var searchText = ""
    @Published private(set) var filters = TransactionFilterState()
    @Published private(set) var nextCursor: Int?
    @Published private(set) var isLoadingMore = false
    @Published private(set) var isBulkEditing = false
    @Published private(set) var selectedTransactionIds: Set<String> = []

    private let service: TransactionsService
    private let rulesService: RulesService

    init(
        service: TransactionsService = TransactionsService(),
        rulesService: RulesService = RulesService(),
        initialFilters: TransactionFilterState = TransactionFilterState()
    ) {
        self.service = service
        self.rulesService = rulesService
        filters = initialFilters
        searchText = initialFilters.search
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        filters.cursor = 0
        await reload(showLoading: false)
    }

    func applySearch() async {
        filters.search = searchText
        filters.cursor = 0
        await reload(showLoading: false)
    }

    func setTypeFilter(_ type: TransactionKind?) async {
        filters.type = type
        filters.cursor = 0
        await reload(showLoading: false)
    }

    func setCategoryFilter(_ category: String?) async {
        filters.category = category
        filters.cursor = 0
        await reload(showLoading: false)
    }

    func setHashtagFilter(_ hashtag: String?) async {
        filters.hashtag = hashtag
        filters.cursor = 0
        await reload(showLoading: false)
    }

    func clearFilters() async {
        searchText = ""
        filters = TransactionFilterState()
        await reload(showLoading: false)
    }

    func applyFilters(_ nextFilters: TransactionFilterState) async {
        filters = nextFilters
        filters.cursor = 0
        searchText = filters.search
        await reload(showLoading: false)
    }

    func loadNextPage() async {
        guard let nextCursor, !isLoadingMore else { return }

        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            var nextFilters = filters
            nextFilters.cursor = nextCursor
            let result = try await service.load(filters: nextFilters)
            transactions.append(contentsOf: result.list.items)
            totalCount = result.totalCount
            summary = result.summary
            categories = result.categories
            hashtags = result.hashtags
            filters = nextFilters
            self.nextCursor = result.list.nextCursor
        } catch {
            state = .error(error)
        }
    }

    func toggleBulkEditing() {
        isBulkEditing.toggle()
        selectedTransactionIds.removeAll()
    }

    func toggleSelection(for transaction: TransactionItem) {
        if selectedTransactionIds.contains(transaction.id) {
            selectedTransactionIds.remove(transaction.id)
        } else {
            selectedTransactionIds.insert(transaction.id)
        }
    }

    func selectVisibleTransactions() {
        selectedTransactionIds = Set(transactions.map(\.id))
    }

    func clearSelection() {
        selectedTransactionIds.removeAll()
    }

    func bulkUpdateType(_ type: TransactionKind) async throws {
        let ids = Array(selectedTransactionIds)
        guard !ids.isEmpty else { return }
        try await service.bulkUpdateType(transactionIds: ids, type: type)
        isBulkEditing = false
        selectedTransactionIds.removeAll()
        await refresh()
    }

    func bulkDelete() async throws {
        let ids = Array(selectedTransactionIds)
        guard !ids.isEmpty else { return }
        try await service.bulkDelete(transactionIds: ids)
        isBulkEditing = false
        selectedTransactionIds.removeAll()
        await refresh()
    }

    func save(transaction: TransactionItem, description: String, amount: Double?, category: String, type: TransactionKind, hashtags: [String]? = nil) async throws -> TransactionRulePrompt? {
        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCategory = category.trimmingCharacters(in: .whitespacesAndNewlines)
        let prompt = makeRulePrompt(transaction: transaction, category: trimmedCategory, hashtags: hashtags)

        var updatedDescription: String?
        var updatedAmount: Double?

        if trimmedDescription != (transaction.description ?? "") {
            updatedDescription = trimmedDescription
        }

        if transaction.canEditAmount, let amount, amount != transaction.amount {
            updatedAmount = amount
        }

        if updatedDescription != nil || updatedAmount != nil {
            try await service.update(transactionId: transaction.id, description: updatedDescription, amount: updatedAmount)
        }

        if !trimmedCategory.isEmpty, trimmedCategory != transaction.displayCategory {
            try await service.updateCategory(transactionId: transaction.id, categoryName: trimmedCategory)
        }

        if type != transaction.type {
            try await service.updateType(transactionId: transaction.id, type: type)
        }

        if let hashtags {
            let normalized = hashtags.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            let existing = transaction.hashtagNames.sorted()
            if normalized.sorted() != existing {
                try await service.setHashtags(transactionId: transaction.id, names: normalized)
            }
        }

        await refresh()
        return prompt
    }

    func applyRulePrompt(_ prompt: TransactionRulePrompt) async throws {
        switch prompt.mode {
        case .create:
            let draft = EditableRuleDraft(
                name: ruleName(for: prompt),
                conditions: [
                    EditableRuleConditionDraft(
                        field: .description,
                        operatorValue: .contains,
                        text: prompt.originalDescription
                    )
                ],
                actions: [prompt.action.ruleActionDraft]
            )
            let rule = try await rulesService.save(rule: nil, draft: draft)
            try await rulesService.linkToTransaction(transactionId: prompt.transactionId, ruleId: rule.id)
        case .update(let ruleId):
            let rule = try await rulesService.getById(id: ruleId)
            var draft = EditableRuleDraft(rule: rule)
            draft.actions.append(prompt.action.ruleActionDraft)
            _ = try await rulesService.save(rule: rule, draft: draft)
            try await rulesService.linkToTransaction(transactionId: prompt.transactionId, ruleId: rule.id)
        }

        await refresh()
    }

    func delete(_ transaction: TransactionItem) async throws {
        try await service.delete(transactionId: transaction.id)
        await refresh()
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            let result = try await service.load(filters: filters)
            transactions = result.list.items
            totalCount = result.totalCount
            summary = result.summary
            categories = result.categories
            hashtags = result.hashtags
            nextCursor = result.list.nextCursor
            selectedTransactionIds.formIntersection(Set(transactions.map(\.id)))
            state = .loaded
        } catch {
            state = .error(error)
        }
    }

    private func makeRulePrompt(transaction: TransactionItem, category: String, hashtags: [String]?) -> TransactionRulePrompt? {
        let originalDescription = transaction.originalDescription.transactionNilIfBlank
            ?? transaction.description.transactionNilIfBlank
            ?? transaction.merchantName.transactionNilIfBlank
            ?? transaction.displayTitle
        guard !originalDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }

        let mode: TransactionRulePrompt.Mode = transaction.appliedRuleId.map { .update(ruleId: $0) } ?? .create

        if !category.isEmpty, category != transaction.displayCategory {
            return TransactionRulePrompt(
                transactionId: transaction.id,
                mode: mode,
                originalDescription: originalDescription,
                action: .setCategory(category)
            )
        }

        guard let hashtags else { return nil }
        let existing = Set(transaction.hashtagNames.map { $0.lowercased() })
        if let added = hashtags.first(where: { !existing.contains($0.lowercased()) }) {
            return TransactionRulePrompt(
                transactionId: transaction.id,
                mode: mode,
                originalDescription: originalDescription,
                action: .addHashtag(added)
            )
        }

        return nil
    }

    private func ruleName(for prompt: TransactionRulePrompt) -> String {
        switch prompt.action {
        case .setCategory:
            return "Categorize \(prompt.originalDescription)"
        case .addHashtag:
            return "Tag \(prompt.originalDescription)"
        }
    }
}
