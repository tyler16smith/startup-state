import Foundation

actor CategoriesService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load() async throws -> [CategoryItem] {
        try await apiClient.get(path: "/api/v1/category/list")
    }

    func create(name: String) async throws -> CategoryItem {
        try await apiClient.post(
            path: "/api/v1/category/create",
            body: .object(["name": .string(name)])
        )
    }

    func update(id: String, name: String) async throws -> CategoryItem {
        try await apiClient.post(
            path: "/api/v1/category/update",
            body: .object([
                "id": .string(id),
                "name": .string(name)
            ])
        )
    }

    func delete(id: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/category/delete",
            body: .object(["id": .string(id)])
        )
    }

    func toggleHidden(id: String, isHidden: Bool) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/category/toggleHidden",
            body: .object([
                "id": .string(id),
                "isHidden": .bool(isHidden)
            ])
        )
    }
}