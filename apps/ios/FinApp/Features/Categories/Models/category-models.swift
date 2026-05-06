import Foundation
import SwiftUI

struct CategoryItem: Decodable, Identifiable, Equatable {
    let id: String
    let userId: String?
    let name: String
    let isDefault: Bool
    let isHidden: Bool
    let sortOrder: Int

    var isUserOwned: Bool { userId != nil }
    var displayScope: String { isUserOwned ? "Custom" : "Default" }
    var canToggleHidden: Bool { isUserOwned }

    var systemImage: String {
        switch name {
        case "Salary": "wallet.pass.fill"
        case "Reimbursement", "Taxes": "receipt.fill"
        case "Eating Out": "fork.knife"
        case "Groceries": "cart.fill"
        case "Mortgage & Rent", "Home": "house.fill"
        case "Bills & Utilities": "bolt.fill"
        case "Insurance": "shield.fill"
        case "Auto & Transport", "Cars": "car.fill"
        case "Gas": "fuelpump.fill"
        case "Travel", "Flights": "airplane"
        case "Shopping": "bag.fill"
        case "Clothing": "tshirt.fill"
        case "Entertainment": "film.fill"
        case "Sports & Fitness": "figure.run"
        case "Health & Medical": "cross.case.fill"
        case "Kids": "graduationcap.fill"
        case "Gifts & Donations": "gift.fill"
        case "Business Services": "briefcase.fill"
        case "Investments": "chart.line.uptrend.xyaxis"
        case "Loans": "banknote.fill"
        case "Fees": "creditcard.fill"
        case "Transfer": "arrow.left.arrow.right"
        case "Uncategorized": "questionmark.circle.fill"
        default: "tag.fill"
        }
    }
}

struct CategoryGroup: Identifiable {
    let id: String
    let title: String
    let systemImage: String
    let color: Color
    let categories: [CategoryItem]
}

struct CategoryActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}