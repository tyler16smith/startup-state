import Foundation
import SwiftUI

enum BudgetStatus: String, Decodable {
    case onTrack = "on-track"
    case closeToBudget = "close-to-budget"
    case overspending
    case noSpend = "no-spend"
    case unknown

    var title: String {
        switch self {
        case .onTrack: "On track"
        case .closeToBudget: "Close"
        case .overspending: "Over"
        case .noSpend: "No spend"
        case .unknown: "Unknown"
        }
    }

    var color: Color {
        switch self {
        case .onTrack, .noSpend: FinTheme.ColorToken.positive
        case .closeToBudget: FinTheme.ColorToken.warning
        case .overspending: FinTheme.ColorToken.destructive
        case .unknown: FinTheme.ColorToken.textSecondary
        }
    }
}

struct BudgetPageData: Decodable, Equatable {
    let totalBudget: Double
    let actualSpent: Double
    let expectedByNow: Double
    let remaining: Double
    let status: BudgetStatus
    let statusMessage: String
    let progressPercent: Double
    let dayOfMonth: Int
    let daysInMonth: Int
    let categories: [CategoryBudgetRow]
}

struct CategoryBudgetRow: Decodable, Identifiable, Equatable {
    let categoryId: String
    let categoryName: String
    let monthlyGoal: Double?
    let spentThisMonth: Double
    let status: BudgetStatus
    let expectedSpendToDate: Double

    var id: String { categoryId }
    var remaining: Double? { monthlyGoal.map { max(0, $0 - spentThisMonth) } }
    var usagePercent: Int? {
        guard let monthlyGoal, monthlyGoal > 0 else { return nil }
        return Int((spentThisMonth / monthlyGoal) * 100)
    }

    var progress: Double {
        guard let monthlyGoal, monthlyGoal > 0 else { return 0 }
        return min(1, spentThisMonth / monthlyGoal)
    }
}

struct CategoryBudgetDetail: Decodable, Identifiable, Equatable {
    let categoryId: String
    let categoryName: String
    let monthlyGoal: Double?
    let spentThisMonth: Double
    let lastMonthSpend: Double
    let sixMonthAverage: Double
    let suggestedBudget: Double
    let monthlyTrend: [MonthlySpend]

    var id: String { categoryId }
}

struct MonthlySpend: Decodable, Identifiable, Equatable {
    let month: String
    let amount: Double

    var id: String { month }
    var dateValue: Date { DateFormatterProvider.parseYearMonth(month) ?? Date() }
}
