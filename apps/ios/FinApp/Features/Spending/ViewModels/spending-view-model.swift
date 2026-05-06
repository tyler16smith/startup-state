import Foundation

@MainActor
final class SpendingViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var breakdown: [SpendingCategoryBreakdown] = []
    @Published private(set) var trends = SpendingTrendResponse(months: [], categories: [])
    @Published private(set) var recurring: [RecurringExpense] = []
    @Published private(set) var anomalies: [SpendingAnomaly] = []
    @Published var selectedMonths = 6

    private let service: SpendingService

    init(service: SpendingService = SpendingService()) {
        self.service = service
    }

    var totalSpend: Double {
        breakdown.reduce(0) { total, row in total + row.total }
    }

    var monthlyAverage: Double {
        guard selectedMonths > 0 else { return 0 }
        return totalSpend / Double(selectedMonths)
    }

    var topCategory: SpendingCategoryBreakdown? {
        breakdown.first
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false)
    }

    func updateMonths(_ months: Int) async {
        selectedMonths = months
        await reload(showLoading: false)
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            let result = try await service.load(months: selectedMonths)
            breakdown = result.breakdown
            trends = result.trends
            recurring = result.recurring
            anomalies = result.anomalies
            state = .loaded
        } catch {
            state = .error(error)
        }
    }
}