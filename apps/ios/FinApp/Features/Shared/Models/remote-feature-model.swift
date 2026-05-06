import Foundation
import SwiftUI

enum FeatureRequestMethod {
    case get
    case post
}

struct FeatureEndpoint: Identifiable {
    let id = UUID()
    let title: String
    let path: String
    let method: FeatureRequestMethod
    let body: JSONValue
    let emptyMessage: String

    init(
        title: String,
        path: String,
        method: FeatureRequestMethod = .get,
        body: JSONValue = .object([:]),
        emptyMessage: String = "No data yet"
    ) {
        self.title = title
        self.path = path
        self.method = method
        self.body = body
        self.emptyMessage = emptyMessage
    }
}

struct FeatureAction: Identifiable {
    let id = UUID()
    let title: String
    let systemImage: String
    let path: String
    let method: FeatureRequestMethod
    let body: JSONValue
    let isDestructive: Bool

    init(
        title: String,
        systemImage: String,
        path: String,
        method: FeatureRequestMethod = .post,
        body: JSONValue = .object([:]),
        isDestructive: Bool = false
    ) {
        self.title = title
        self.systemImage = systemImage
        self.path = path
        self.method = method
        self.body = body
        self.isDestructive = isDestructive
    }
}

struct RemoteFeatureConfig {
    let title: String
    let systemImage: String
    let endpoints: [FeatureEndpoint]
    let actions: [FeatureAction]
}

struct RemoteFeatureSnapshot {
    let sections: [RemoteFeatureSection]
    let metrics: [RemoteFeatureMetric]
}

struct RemoteFeatureSection: Identifiable {
    let id = UUID()
    let title: String
    let records: [RemoteFeatureRecord]
    let emptyMessage: String
}

struct RemoteFeatureMetric: Identifiable {
    let id = UUID()
    let label: String
    let value: String
    let systemImage: String
}

struct RemoteFeatureRecord: Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let amount: Double?
    let badges: [String]
    let details: [(String, String)]
}

extension AppDestination {
    var remoteFeatureConfig: RemoteFeatureConfig {
        switch self {
        case .accounts:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Institutions", path: "/api/v1/plaid/getConnectedInstitutions"),
                    FeatureEndpoint(title: "Managed connections", path: "/api/v1/plaid/listItems")
                ],
                actions: [
                    FeatureAction(title: "Start bank connection", systemImage: "link.badge.plus", path: "/api/v1/plaid/createLinkToken"),
                    FeatureAction(title: "Sync all", systemImage: "arrow.triangle.2.circlepath", path: "/api/v1/plaid/syncAll")
                ]
            )
        case .budget:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Budget", path: "/api/v1/budget/getPageData")
                ],
                actions: []
            )
        case .transactions:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Summary", path: "/api/v1/transaction/getSummary", method: .post),
                    FeatureEndpoint(title: "Transactions", path: "/api/v1/transaction/getAll", method: .post, body: .object(["limit": .number(50), "cursor": .number(0), "sortField": .string("date"), "sortDir": .string("desc")])),
                    FeatureEndpoint(title: "Categories", path: "/api/v1/transaction/listCategories"),
                    FeatureEndpoint(title: "Hashtags", path: "/api/v1/hashtag/list")
                ],
                actions: []
            )
        case .rules:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Rules", path: "/api/v1/rule/list"),
                    FeatureEndpoint(title: "Settings", path: "/api/v1/rule/getSettings")
                ],
                actions: []
            )
        case .spending:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Category breakdown", path: "/api/v1/spending/getCategoryBreakdown", method: .post, body: .object(["months": .number(3)])),
                    FeatureEndpoint(title: "Category trends", path: "/api/v1/spending/getCategoryTrends", method: .post, body: .object(["months": .number(12)])),
                    FeatureEndpoint(title: "Recurring", path: "/api/v1/spending/getRecurringExpenses"),
                    FeatureEndpoint(title: "Anomalies", path: "/api/v1/spending/getAnomalies")
                ],
                actions: []
            )
        case .categories:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Categories", path: "/api/v1/category/list")
                ],
                actions: []
            )
        case .whatIf:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Scenarios", path: "/api/v1/scenario/getAll"),
                    FeatureEndpoint(title: "Investment forecast", path: "/api/v1/investment/getForecast", method: .post, body: .object(["months": .number(60)]))
                ],
                actions: [
                    FeatureAction(title: "Seed scenarios", systemImage: "square.stack.3d.up.fill", path: "/api/v1/scenario/seedDefaults")
                ]
            )
        case .investments:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Investments", path: "/api/v1/investment/getAll"),
                    FeatureEndpoint(title: "Real estate", path: "/api/v1/realEstate/list"),
                    FeatureEndpoint(title: "Forecast", path: "/api/v1/investment/getForecast", method: .post, body: .object(["months": .number(60)]))
                ],
                actions: []
            )
        case .scenarios:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Scenarios", path: "/api/v1/scenario/getAll")
                ],
                actions: [
                    FeatureAction(title: "Seed defaults", systemImage: "square.stack.3d.up.fill", path: "/api/v1/scenario/seedDefaults"),
                    FeatureAction(title: "Clear active", systemImage: "moon.zzz.fill", path: "/api/v1/scenario/setActive", body: .object(["id": .null]))
                ]
            )
        case .finAI:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Health", path: "/api/v1/ping/get")
                ],
                actions: []
            )
        case .demoMode:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Status", path: "/api/v1/demo/getDemoStatus")
                ],
                actions: [
                    FeatureAction(title: "Enter demo", systemImage: "play.circle.fill", path: "/api/v1/demo/enterDemoMode")
                ]
            )
        case .household:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Household", path: "/api/v1/household")
                ],
                actions: []
            )
        case .accountSettings:
            return RemoteFeatureConfig(
                title: title,
                systemImage: systemImage,
                endpoints: [
                    FeatureEndpoint(title: "Two-factor", path: "/api/v1/twoFactor/getStatus"),
                    FeatureEndpoint(title: "Billing plans", path: "/api/v1/billing/getPlans"),
                    FeatureEndpoint(title: "Billing status", path: "/api/v1/billing/getStatus")
                ],
                actions: []
            )
        }
    }
}
