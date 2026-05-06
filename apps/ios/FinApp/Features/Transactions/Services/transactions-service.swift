import Foundation

actor TransactionsService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load(filters: TransactionFilterState) async throws -> TransactionsLoadResult {
        async let list: TransactionListResponse = apiClient.post(
            path: "/api/v1/transaction/getAll",
            body: filters.requestBody
        )
        async let totalCount: Int = apiClient.post(
            path: "/api/v1/transaction/count",
            body: filters.requestBody
        )
        async let summary: TransactionSummary = apiClient.post(
            path: "/api/v1/transaction/getSummary",
            body: filters.requestBody
        )
        async let categories: [String] = apiClient.get(path: "/api/v1/transaction/listCategories")
        async let hashtags: [HashtagSummary] = apiClient.get(path: "/api/v1/hashtag/list")

        return try await TransactionsLoadResult(
            list: list,
            totalCount: totalCount,
            summary: summary,
            categories: categories,
            hashtags: hashtags
        )
    }

    func updateCategory(transactionId: String, categoryName: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/updateCategory",
            body: .object([
                "id": .string(transactionId),
                "categoryName": .string(categoryName)
            ])
        )
    }

    func updateType(transactionId: String, type: TransactionKind) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/updateType",
            body: .object([
                "id": .string(transactionId),
                "type": .string(type.rawValue)
            ])
        )
    }

    func update(transactionId: String, description: String? = nil, amount: Double? = nil) async throws {
        var body: [String: JSONValue] = ["id": .string(transactionId)]
        if let description {
            body["description"] = .string(description)
        }
        if let amount {
            body["amount"] = .number(amount)
        }

        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/update",
            body: .object(body)
        )
    }

    func delete(transactionId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/delete",
            body: .object(["id": .string(transactionId)])
        )
    }

    func setHashtags(transactionId: String, names: [String]) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/hashtag/setOnTransaction",
            body: .object([
                "transactionId": .string(transactionId),
                "names": .array(names.map(JSONValue.string))
            ])
        )
    }

    func bulkUpdateType(transactionIds: [String], type: TransactionKind) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/bulkUpdateType",
            body: .object([
                "ids": .array(transactionIds.map(JSONValue.string)),
                "type": .string(type.rawValue)
            ])
        )
    }

    func bulkDelete(transactionIds: [String]) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/bulkDelete",
            body: .object(["ids": .array(transactionIds.map(JSONValue.string))])
        )
    }
}
