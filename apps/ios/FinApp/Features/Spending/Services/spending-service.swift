import Foundation

actor SpendingService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load(months: Int) async throws -> SpendingLoadResult {
        let boundedMonths = max(1, min(24, months))
        async let breakdown: [SpendingCategoryBreakdown] = apiClient.post(
            path: "/api/v1/spending/getCategoryBreakdown",
            body: .object(["months": .number(Double(boundedMonths))])
        )
        async let trends: SpendingTrendResponse = apiClient.post(
            path: "/api/v1/spending/getCategoryTrends",
            body: .object(["months": .number(Double(boundedMonths))])
        )
        async let recurring: [RecurringExpense] = apiClient.get(path: "/api/v1/spending/getRecurringExpenses")
        async let anomalies: [SpendingAnomaly] = apiClient.get(path: "/api/v1/spending/getAnomalies")

        return try await SpendingLoadResult(
            breakdown: breakdown,
            trends: trends,
            recurring: recurring,
            anomalies: anomalies
        )
    }
}