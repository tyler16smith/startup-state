import SwiftUI

struct TransactionsView: View {
    @StateObject private var viewModel = TransactionsViewModel()
    @State private var activeSheet: TransactionSheet?
    private let title: String

    init(initialFilters: TransactionFilterState = TransactionFilterState(), title: String = "Transactions") {
        _viewModel = StateObject(wrappedValue: TransactionsViewModel(initialFilters: initialFilters))
        self.title = title
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading transactions...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle(title)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    viewModel.toggleBulkEditing()
                } label: {
                    Image(systemName: viewModel.isBulkEditing ? "checkmark.circle.fill" : "checkmark.circle")
                }

                Button {
                    activeSheet = .filters
                } label: {
                    Image(systemName: viewModel.filters.hasActiveFilters ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                }
            }
        }
        .searchable(text: $viewModel.searchText, prompt: "Search transactions")
        .onSubmit(of: .search) {
            Task { await viewModel.applySearch() }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .edit(let transaction):
                TransactionDetailSheet(
                    transaction: transaction,
                    categories: viewModel.categories,
                    allHashtags: viewModel.hashtags,
                    onSave: { description, amount, category, type, hashtags in
                        let prompt = try await viewModel.save(
                            transaction: transaction,
                            description: description,
                            amount: amount,
                            category: category,
                            type: type,
                            hashtags: hashtags
                        )
                        activeSheet = prompt.map(TransactionSheet.rulePrompt)
                    },
                    onDelete: {
                        try await viewModel.delete(transaction)
                        activeSheet = nil
                    }
                )
            case .filters:
                TransactionFilterSheet(
                    filters: viewModel.filters,
                    categories: viewModel.categories,
                    hashtags: viewModel.hashtags,
                    onApply: { filters in
                        await viewModel.applyFilters(filters)
                        activeSheet = nil
                    },
                    onClear: {
                        await viewModel.clearFilters()
                        activeSheet = nil
                    }
                )
            case .bulkActions:
                BulkTransactionsSheet(
                    selectedCount: viewModel.selectedTransactionIds.count,
                    onUpdateType: { type in
                        try await viewModel.bulkUpdateType(type)
                        activeSheet = nil
                    },
                    onDelete: {
                        try await viewModel.bulkDelete()
                        activeSheet = nil
                    }
                )
            case .rulePrompt(let prompt):
                TransactionRulePromptSheet(
                    prompt: prompt,
                    onDismiss: { activeSheet = nil },
                    onApply: {
                        try await viewModel.applyRulePrompt(prompt)
                        activeSheet = nil
                    }
                )
            }
        }
        .task {
            await viewModel.load()
        }
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: FinTheme.Spacing.large) {
                if let summary = viewModel.summary {
                    TransactionsSummaryGrid(summary: summary, totalCount: viewModel.totalCount)
                }

                filterChips

                if viewModel.isBulkEditing {
                    BulkSelectionBar(
                        selectedCount: viewModel.selectedTransactionIds.count,
                        visibleCount: viewModel.transactions.count,
                        onSelectVisible: viewModel.selectVisibleTransactions,
                        onClear: viewModel.clearSelection,
                        onActions: { activeSheet = .bulkActions }
                    )
                }

                LazyVStack(spacing: FinTheme.Spacing.small) {
                    if viewModel.transactions.isEmpty {
                        emptyTransactions
                    } else {
                        ForEach(Array(viewModel.transactions.enumerated()), id: \.element.id) { index, transaction in
                            Button {
                                if viewModel.isBulkEditing {
                                    viewModel.toggleSelection(for: transaction)
                                } else {
                                    activeSheet = .edit(transaction)
                                }
                            } label: {
                                TransactionRow(
                                    transaction: transaction,
                                    isSelecting: viewModel.isBulkEditing,
                                    isSelected: viewModel.selectedTransactionIds.contains(transaction.id)
                                )
                            }
                            .buttonStyle(.plain)

                            if index < viewModel.transactions.count - 1 {
                                Divider()
                                    .padding(.horizontal, FinTheme.Spacing.medium)
                            }
                        }

                        if viewModel.nextCursor != nil {
                            Button {
                                Task { await viewModel.loadNextPage() }
                            } label: {
                                if viewModel.isLoadingMore {
                                    ProgressView().frame(maxWidth: .infinity)
                                } else {
                                    Label("Load more", systemImage: "arrow.down.circle")
                                        .frame(maxWidth: .infinity)
                                }
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.large)
                            .disabled(viewModel.isLoadingMore)
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

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: FinTheme.Spacing.small) {
                FilterChip(
                    title: viewModel.filters.type?.title ?? "All types",
                    systemImage: "arrow.up.arrow.down.circle",
                    isActive: viewModel.filters.type != nil
                ) {
                    activeSheet = .filters
                }

                FilterChip(
                    title: viewModel.filters.category ?? "Category",
                    systemImage: "folder",
                    isActive: viewModel.filters.category != nil
                ) {
                    activeSheet = .filters
                }

                FilterChip(
                    title: viewModel.filters.hashtag.map { "#\($0)" } ?? "Hashtag",
                    systemImage: "number",
                    isActive: viewModel.filters.hashtag != nil
                ) {
                    activeSheet = .filters
                }

                FilterChip(
                    title: viewModel.filters.dateRangeTitle,
                    systemImage: "calendar",
                    isActive: viewModel.filters.startDate != nil || viewModel.filters.endDate != nil
                ) {
                    activeSheet = .filters
                }

                FilterChip(
                    title: viewModel.filters.sortTitle,
                    systemImage: "arrow.up.arrow.down",
                    isActive: viewModel.filters.sortField != .date || !viewModel.filters.sortDescending
                ) {
                    activeSheet = .filters
                }

                if viewModel.filters.hasActiveFilters {
                    FilterChip(title: "Clear", systemImage: "xmark", isActive: true) {
                        Task { await viewModel.clearFilters() }
                    }
                }
            }
            .padding(.vertical, FinTheme.Spacing.xSmall)
        }
    }

    private var emptyTransactions: some View {
        VStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No transactions found")
                .font(.headline)
            Text("Try changing the search or filters.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FinTheme.Spacing.xxLarge)
    }

}

private enum TransactionSheet: Identifiable {
    case edit(TransactionItem)
    case filters
    case bulkActions
    case rulePrompt(TransactionRulePrompt)

    var id: String {
        switch self {
        case .edit(let transaction): "edit-\(transaction.id)"
        case .filters: "filters"
        case .bulkActions: "bulk-actions"
        case .rulePrompt(let prompt): "rule-prompt-\(prompt.id)"
        }
    }
}

private struct TransactionsSummaryGrid: View {
    let summary: TransactionSummary
    let totalCount: Int

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: FinTheme.Spacing.medium) {
            MetricTile(title: "Income", value: CurrencyFormatter.formatCompact(summary.incomeSum), systemImage: "arrow.down.circle.fill", tint: FinTheme.ColorToken.positive)
            MetricTile(title: "Expenses", value: CurrencyFormatter.formatCompact(summary.expenseSum), systemImage: "arrow.up.circle.fill", tint: FinTheme.ColorToken.destructive)
            MetricTile(title: "Net", value: CurrencyFormatter.formatCompact(summary.net), systemImage: "equal.circle.fill", tint: summary.net >= 0 ? FinTheme.ColorToken.positive : FinTheme.ColorToken.warning)
            MetricTile(title: "Items", value: "\(totalCount)", systemImage: "list.bullet.circle.fill", tint: FinTheme.ColorToken.accent)
        }
    }
}

private struct TransactionRulePromptSheet: View {
    let prompt: TransactionRulePrompt
    let onDismiss: () -> Void
    let onApply: () async throws -> Void

    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        FinGlassSheet(title: prompt.title) {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
                    Label(prompt.action.title, systemImage: "wand.and.stars")
                        .font(.headline)
                    Text(prompt.originalDescription)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Text(message)
                    .font(.body)
                    .foregroundStyle(.secondary)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.destructive)
                }

                HStack(spacing: FinTheme.Spacing.medium) {
                    Button {
                        onDismiss()
                    } label: {
                        Text("Not now").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isWorking)

                    Button {
                        Task { await apply() }
                    } label: {
                        if isWorking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label(actionTitle, systemImage: "checkmark").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWorking)
                }
            }
        }
    }

    private var message: String {
        switch prompt.mode {
        case .create:
            return "Save this as a rule so similar future transactions are updated automatically."
        case .update:
            return "Add this edit to the rule already linked to the transaction."
        }
    }

    private var actionTitle: String {
        switch prompt.mode {
        case .create:
            return "Create rule"
        case .update:
            return "Update rule"
        }
    }

    private func apply() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onApply()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct MetricTile: View {
    let title: String
    let value: String
    let systemImage: String
    let tint: Color

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
                Image(systemName: systemImage)
                    .font(.title3)
                    .foregroundStyle(tint)
                Text(value)
                    .font(.title3.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct TransactionRow: View {
    let transaction: TransactionItem
    let isSelecting: Bool
    let isSelected: Bool

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            if isSelecting {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? FinTheme.ColorToken.accent : .secondary)
            }

            ZStack {
                Circle()
                    .fill(transaction.type == .income ? Color.green.opacity(0.14) : Color.red.opacity(0.14))
                Image(systemName: transaction.type == .income ? "arrow.down" : "arrow.up")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(transaction.type == .income ? FinTheme.ColorToken.positive : FinTheme.ColorToken.destructive)
            }
            .frame(width: 38, height: 38)

            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.displayTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(transaction.displaySubtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                HStack(spacing: FinTheme.Spacing.xSmall) {
                    Text(transaction.displayCategory)
                        .font(.caption2.weight(.medium))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(FinTheme.ColorToken.elevatedSurface)
                        .clipShape(Capsule())
                    ForEach(transaction.hashtagNames.prefix(2), id: \.self) { hashtag in
                        Text("#\(hashtag)")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer(minLength: FinTheme.Spacing.small)

            Text(CurrencyFormatter.format(transaction.signedAmount))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(transaction.type == .income ? FinTheme.ColorToken.positive : FinTheme.ColorToken.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .padding(FinTheme.Spacing.medium)
        .background(isSelected ? FinTheme.ColorToken.accent.opacity(0.12) : FinTheme.ColorToken.surface)
        .overlay {
            RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous)
                .stroke(isSelected ? FinTheme.ColorToken.accent : Color.clear, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct BulkSelectionBar: View {
    let selectedCount: Int
    let visibleCount: Int
    let onSelectVisible: () -> Void
    let onClear: () -> Void
    let onActions: () -> Void

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                HStack {
                    Label("\(selectedCount) selected", systemImage: "checkmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Button("Clear", action: onClear)
                        .disabled(selectedCount == 0)
                }

                HStack(spacing: FinTheme.Spacing.small) {
                    Button("Select visible", action: onSelectVisible)
                        .buttonStyle(.bordered)
                        .disabled(visibleCount == 0)
                    Button {
                        onActions()
                    } label: {
                        Label("Actions", systemImage: "ellipsis.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(selectedCount == 0)
                }
            }
        }
    }
}

private struct TransactionFilterSheet: View {
    let categories: [String]
    let hashtags: [HashtagSummary]
    let onApply: (TransactionFilterState) async -> Void
    let onClear: () async -> Void

    @State private var draft: TransactionFilterState
    @State private var startDateEnabled: Bool
    @State private var endDateEnabled: Bool
    @State private var startDate: Date
    @State private var endDate: Date
    @State private var isWorking = false

    init(
        filters: TransactionFilterState,
        categories: [String],
        hashtags: [HashtagSummary],
        onApply: @escaping (TransactionFilterState) async -> Void,
        onClear: @escaping () async -> Void
    ) {
        self.categories = categories
        self.hashtags = hashtags
        self.onApply = onApply
        self.onClear = onClear
        _draft = State(initialValue: filters)
        _startDateEnabled = State(initialValue: filters.startDate != nil)
        _endDateEnabled = State(initialValue: filters.endDate != nil)
        _startDate = State(initialValue: filters.startDate ?? Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date())
        _endDate = State(initialValue: filters.endDate ?? Date())
    }

    var body: some View {
        FinGlassSheet(title: "Filter transactions") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                filterSection("Search") {
                    TextField("Search transactions", text: $draft.search)
                        .textFieldStyle(.roundedBorder)
                }

                filterSection("Filters") {
                    Picker("Type", selection: $draft.type) {
                        Text("All").tag(nil as TransactionKind?)
                        ForEach(TransactionKind.allCases) { kind in
                            Text(kind.title).tag(kind as TransactionKind?)
                        }
                    }
                    .pickerStyle(.segmented)

                    Menu {
                        Button("All categories") { draft.category = nil }
                        ForEach(categories, id: \.self) { category in
                            Button(category) { draft.category = category }
                        }
                    } label: {
                        sheetMenuLabel(title: draft.category ?? "All categories", systemImage: "folder")
                    }

                    Menu {
                        Button("All hashtags") { draft.hashtag = nil }
                        ForEach(hashtags) { hashtag in
                            Button("#\(hashtag.name)") { draft.hashtag = hashtag.normalizedName ?? hashtag.name }
                        }
                    } label: {
                        sheetMenuLabel(title: draft.hashtag.map { "#\($0)" } ?? "All hashtags", systemImage: "number")
                    }
                }

                filterSection("Date range") {
                    Toggle("Start date", isOn: $startDateEnabled)
                    if startDateEnabled {
                        DatePicker("From", selection: $startDate, displayedComponents: .date)
                    }

                    Toggle("End date", isOn: $endDateEnabled)
                    if endDateEnabled {
                        DatePicker("To", selection: $endDate, displayedComponents: .date)
                    }
                }

                filterSection("Sort") {
                    Picker("Sort by", selection: $draft.sortField) {
                        ForEach(TransactionSortField.allCases) { field in
                            Text(field.title).tag(field)
                        }
                    }
                    Picker("Direction", selection: $draft.sortDescending) {
                        Text("Descending").tag(true)
                        Text("Ascending").tag(false)
                    }
                    .pickerStyle(.segmented)
                }

                HStack(spacing: FinTheme.Spacing.medium) {
                    Button {
                        Task { await clear() }
                    } label: {
                        Label("Clear", systemImage: "xmark.circle").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isWorking)

                    Button {
                        Task { await apply() }
                    } label: {
                        if isWorking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label("Apply", systemImage: "checkmark").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWorking)
                }
            }
        }
    }

    private func apply() async {
        isWorking = true
        defer { isWorking = false }
        draft.startDate = startDateEnabled ? Calendar.current.startOfDay(for: startDate) : nil
        draft.endDate = endDateEnabled ? endDate : nil
        await onApply(draft)
    }

    private func clear() async {
        isWorking = true
        defer { isWorking = false }
        await onClear()
    }
}

private struct BulkTransactionsSheet: View {
    let selectedCount: Int
    let onUpdateType: (TransactionKind) async throws -> Void
    let onDelete: () async throws -> Void

    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        FinGlassSheet(title: "Bulk actions") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                Text("\(selectedCount) transactions selected")
                    .font(.headline)
                Text("Choose a type change or hide the selected transactions.")
                    .font(.body)
                    .foregroundStyle(.secondary)

                VStack(spacing: FinTheme.Spacing.small) {
                    Button {
                        Task { await perform { try await onUpdateType(.expense) } }
                    } label: {
                        Label("Mark as expense", systemImage: "arrow.up.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button {
                        Task { await perform { try await onUpdateType(.income) } }
                    } label: {
                        Label("Mark as income", systemImage: "arrow.down.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button(role: .destructive) {
                        Task { await perform { try await onDelete() } }
                    } label: {
                        Label("Delete selected", systemImage: "trash")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .disabled(isWorking)

                if isWorking {
                    ProgressView().frame(maxWidth: .infinity)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.destructive)
                }
            }
        }
    }

    private func perform(_ operation: () async throws -> Void) async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await operation()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct TransactionDetailSheet: View {
    let transaction: TransactionItem
    let categories: [String]
    let allHashtags: [HashtagSummary]
    let onSave: (String, Double?, String, TransactionKind, [String]) async throws -> Void
    let onDelete: () async throws -> Void

    @State private var descriptionText: String
    @State private var amountText: String
    @State private var categoryText: String
    @State private var selectedType: TransactionKind
    @State private var selectedHashtags: [String]
    @State private var newHashtagText: String = ""
    @State private var isDeleteConfirmationPresented = false
    @State private var isWorking = false
    @State private var errorMessage: String?

    init(
        transaction: TransactionItem,
        categories: [String],
        allHashtags: [HashtagSummary],
        onSave: @escaping (String, Double?, String, TransactionKind, [String]) async throws -> Void,
        onDelete: @escaping () async throws -> Void
    ) {
        self.transaction = transaction
        self.categories = categories
        self.allHashtags = allHashtags
        self.onSave = onSave
        self.onDelete = onDelete
        _descriptionText = State(initialValue: transaction.description ?? transaction.displayTitle)
        _amountText = State(initialValue: String(format: "%.2f", transaction.amount))
        _categoryText = State(initialValue: transaction.displayCategory)
        _selectedType = State(initialValue: transaction.type)
        _selectedHashtags = State(initialValue: transaction.hashtagNames)
    }

    private var availableSuggestions: [HashtagSummary] {
        let lowered = Set(selectedHashtags.map { $0.lowercased() })
        return allHashtags.filter { !lowered.contains($0.name.lowercased()) }
    }

    var body: some View {
        FinGlassSheet(title: "Transaction") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                    Text(CurrencyFormatter.format(transaction.signedAmount))
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(transaction.type == .income ? FinTheme.ColorToken.positive : FinTheme.ColorToken.textPrimary)
                    Text(transaction.displaySubtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: FinTheme.Spacing.medium) {
                    TextField("Description", text: $descriptionText)
                        .textFieldStyle(.roundedBorder)

                    VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                        TextField("Amount", text: $amountText)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(.roundedBorder)
                            .disabled(!transaction.canEditAmount)
                        if !transaction.canEditAmount {
                            Text("Plaid transaction amounts stay synced from the bank.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Picker("Type", selection: $selectedType) {
                        ForEach(TransactionKind.allCases) { kind in
                            Text(kind.title).tag(kind)
                        }
                    }
                    .pickerStyle(.segmented)

                    Menu {
                        ForEach(categories, id: \.self) { category in
                            Button(category) {
                                categoryText = category
                            }
                        }
                    } label: {
                        HStack {
                            Label(categoryText, systemImage: "folder")
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(FinTheme.Spacing.medium)
                        .background(FinTheme.ColorToken.surface)
                        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
                    }

                    HashtagEditor(
                        selected: $selectedHashtags,
                        newHashtag: $newHashtagText,
                        suggestions: availableSuggestions
                    )
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
                        Label("Delete", systemImage: "trash")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

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
            FinGlassSheet(title: "Delete transaction") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text(transaction.displayTitle)
                        .font(.headline)
                    Text("This hides the transaction from lists, budgets, and charts.")
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
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        // Commit any pending hashtag text
        let pending = newHashtagText.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        var hashtagsToSave = selectedHashtags
        if !pending.isEmpty, !hashtagsToSave.contains(where: { $0.lowercased() == pending.lowercased() }) {
            hashtagsToSave.append(pending)
        }

        let amount = Double(amountText.trimmingCharacters(in: .whitespacesAndNewlines))
        if transaction.canEditAmount, amount == nil {
            errorMessage = "Enter a valid amount."
            return
        }

        do {
            try await onSave(descriptionText, amount, categoryText, selectedType, hashtagsToSave)
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

private func filterSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
        Text(title)
            .font(.headline)
        content()
    }
    .padding(FinTheme.Spacing.medium)
    .background(FinTheme.ColorToken.surface)
    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
}

private func sheetMenuLabel(title: String, systemImage: String) -> some View {
    HStack {
        Label(title, systemImage: systemImage)
        Spacer()
        Image(systemName: "chevron.up.chevron.down")
            .font(.caption)
            .foregroundStyle(.secondary)
    }
    .padding(FinTheme.Spacing.medium)
    .background(FinTheme.ColorToken.elevatedSurface)
    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
}

private struct HashtagEditor: View {
    @Binding var selected: [String]
    @Binding var newHashtag: String
    let suggestions: [HashtagSummary]

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
            Text("Hashtags")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            if !selected.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(selected, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text("#\(tag)")
                                .font(.caption.weight(.medium))
                            Button {
                                selected.removeAll { $0 == tag }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(FinTheme.ColorToken.accent.opacity(0.14))
                        .clipShape(Capsule())
                    }
                }
            }

            HStack {
                Image(systemName: "number")
                    .foregroundStyle(.secondary)
                TextField("Add hashtag", text: $newHashtag)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onSubmit { commit() }
                if !newHashtag.isEmpty {
                    Button("Add") { commit() }
                        .font(.caption.weight(.semibold))
                }
            }
            .padding(FinTheme.Spacing.small)
            .background(FinTheme.ColorToken.surface)
            .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))

            if !suggestions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(suggestions.prefix(12)) { hashtag in
                            Button {
                                addTag(hashtag.name)
                            } label: {
                                Text("#\(hashtag.name)")
                                    .font(.caption.weight(.medium))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(FinTheme.ColorToken.elevatedSurface)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private func commit() {
        let normalized = newHashtag
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        addTag(normalized)
        newHashtag = ""
    }

    private func addTag(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard !selected.contains(where: { $0.lowercased() == trimmed.lowercased() }) else { return }
        selected.append(trimmed)
    }
}

/// A simple flow layout for wrapping rows of chips.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let result = arrange(subviews: subviews, in: maxWidth)
        return CGSize(width: result.size.width, height: result.size.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(subviews: subviews, in: bounds.width)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }

    private func arrange(subviews: Subviews, in maxWidth: CGFloat) -> (positions: [CGPoint], size: CGSize) {
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
            totalWidth = max(totalWidth, x)
        }

        return (positions, CGSize(width: totalWidth, height: y + lineHeight))
    }
}

private struct FilterChip: View {
    let title: String
    let systemImage: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            FilterChipLabel(title: title, systemImage: systemImage, isActive: isActive)
        }
        .buttonStyle(.plain)
    }
}

private struct FilterChipLabel: View {
    let title: String
    let systemImage: String
    let isActive: Bool

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.caption.weight(.semibold))
            .foregroundStyle(isActive ? Color.white : FinTheme.ColorToken.textPrimary)
            .lineLimit(1)
            .padding(.horizontal, FinTheme.Spacing.medium)
            .padding(.vertical, FinTheme.Spacing.small)
            .background(isActive ? FinTheme.ColorToken.accent : FinTheme.ColorToken.surface)
            .clipShape(Capsule())
    }
}

#Preview {
    NavigationStack {
        TransactionsView()
    }
}
