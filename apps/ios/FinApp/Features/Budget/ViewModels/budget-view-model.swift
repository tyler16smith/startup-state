import Foundation

@MainActor
final class BudgetViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var pageData: BudgetPageData?
    @Published private(set) var selectedDetail: CategoryBudgetDetail?
    @Published private(set) var detailError: Error?

    private let service: BudgetService

    init(service: BudgetService = BudgetService()) {
        self.service = service
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false)
    }

    func loadDetail(for category: CategoryBudgetRow) async {
        detailError = nil

        do {
            selectedDetail = try await service.loadCategoryDetail(categoryId: category.categoryId)
        } catch {
            detailError = error
        }
    }

    func clearDetail() {
        selectedDetail = nil
    }

    func saveBudget(detail: CategoryBudgetDetail, monthlyGoal: Double) async throws {
        try await service.saveCategoryBudget(categoryId: detail.categoryId, monthlyGoal: monthlyGoal)
        selectedDetail = try await service.loadCategoryDetail(categoryId: detail.categoryId)
        await refresh()
    }

    func deleteBudget(detail: CategoryBudgetDetail) async throws {
        try await service.deleteCategoryBudget(categoryId: detail.categoryId)
        selectedDetail = nil
        await refresh()
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            pageData = try await service.loadPageData()
            state = .loaded
        } catch {
            state = .error(error)
        }
    }
}
