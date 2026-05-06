import Foundation
import SwiftUI

@MainActor
final class CategoriesViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var categories: [CategoryItem] = []
    @Published private(set) var actionMessage: CategoryActionMessage?
    @Published var searchText = ""
    @Published var showHidden = true

    private let service: CategoriesService

    init(service: CategoriesService = CategoriesService()) {
        self.service = service
    }

    var filteredCategories: [CategoryItem] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return categories.filter { category in
            let matchesSearch = query.isEmpty || category.name.lowercased().contains(query)
            let matchesVisibility = showHidden || !category.isHidden
            return matchesSearch && matchesVisibility
        }
    }

    var hasSearch: Bool {
        !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var visibleCustomCategories: [CategoryItem] {
        categories.filter { $0.isUserOwned && !$0.isHidden }
    }

    var hiddenCategories: [CategoryItem] {
        categories.filter(\.isHidden)
    }

    var defaultGroups: [CategoryGroup] {
        let defaults = categories.filter { $0.isDefault || !$0.isUserOwned }
        let grouped = CategoryGroupDefinition.allCases.compactMap { definition -> CategoryGroup? in
            let items = definition.categoryNames.compactMap { name in
                defaults.first { $0.name == name }
            }
            guard !items.isEmpty else { return nil }
            return CategoryGroup(
                id: definition.rawValue,
                title: definition.title,
                systemImage: definition.systemImage,
                color: definition.color,
                categories: items
            )
        }

        let groupedNames = Set(CategoryGroupDefinition.allCases.flatMap(\.categoryNames))
        let otherDefaults = defaults.filter { !groupedNames.contains($0.name) }
        guard !otherDefaults.isEmpty else { return grouped }
        return grouped + [
            CategoryGroup(
                id: "other-defaults",
                title: "Other Defaults",
                systemImage: "tag.fill",
                color: FinTheme.ColorToken.textSecondary,
                categories: otherDefaults
            )
        ]
    }

    var customCount: Int { categories.filter(\.isUserOwned).count }
    var hiddenCount: Int { categories.filter(\.isHidden).count }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false)
    }

    func save(category: CategoryItem?, name: String) async throws {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw CategoryValidationError.emptyName }

        if let category {
            _ = try await service.update(id: category.id, name: trimmedName)
            actionMessage = CategoryActionMessage(title: "Category updated", message: trimmedName)
        } else {
            _ = try await service.create(name: trimmedName)
            actionMessage = CategoryActionMessage(title: "Category created", message: trimmedName)
        }

        await refresh()
    }

    func delete(_ category: CategoryItem) async throws {
        try await service.delete(id: category.id)
        actionMessage = CategoryActionMessage(title: "Category deleted", message: category.name)
        await refresh()
    }

    func toggleHidden(_ category: CategoryItem) async {
        await performAction(title: category.isHidden ? "Category shown" : "Category hidden") {
            try await service.toggleHidden(id: category.id, isHidden: !category.isHidden)
            return category.name
        }
        await refresh()
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            categories = try await service.load()
            state = .loaded
        } catch {
            state = .error(error)
        }
    }

    private func performAction(title: String, operation: () async throws -> String) async {
        state = .refreshing

        do {
            let message = try await operation()
            actionMessage = CategoryActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            actionMessage = CategoryActionMessage(title: title, message: error.localizedDescription)
            state = .loaded
        }
    }
}

private enum CategoryGroupDefinition: String, CaseIterable {
    case income
    case food
    case housing
    case transportation
    case lifestyle
    case health
    case finance
    case other

    var title: String {
        switch self {
        case .income: "Income"
        case .food: "Food & Dining"
        case .housing: "Housing"
        case .transportation: "Transportation"
        case .lifestyle: "Shopping & Lifestyle"
        case .health: "Health & Family"
        case .finance: "Business & Finance"
        case .other: "Other"
        }
    }

    var systemImage: String {
        switch self {
        case .income: "wallet.pass.fill"
        case .food: "fork.knife"
        case .housing: "house.fill"
        case .transportation: "car.fill"
        case .lifestyle: "bag.fill"
        case .health: "cross.case.fill"
        case .finance: "briefcase.fill"
        case .other: "questionmark.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .income: FinTheme.ColorToken.positive
        case .food: .orange
        case .housing: .blue
        case .transportation: .purple
        case .lifestyle: .pink
        case .health: FinTheme.ColorToken.destructive
        case .finance: FinTheme.ColorToken.textSecondary
        case .other: .gray
        }
    }

    var categoryNames: [String] {
        switch self {
        case .income: ["Salary", "Reimbursement"]
        case .food: ["Eating Out", "Groceries"]
        case .housing: ["Mortgage & Rent", "Home", "Bills & Utilities", "Insurance"]
        case .transportation: ["Auto & Transport", "Gas", "Cars", "Travel", "Flights"]
        case .lifestyle: ["Shopping", "Clothing", "Entertainment", "Sports & Fitness"]
        case .health: ["Health & Medical", "Kids", "Gifts & Donations"]
        case .finance: ["Business Services", "Investments", "Loans", "Taxes", "Fees"]
        case .other: ["Uncategorized", "Transfer"]
        }
    }
}

enum CategoryValidationError: LocalizedError {
    case emptyName

    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Enter a category name."
        }
    }
}