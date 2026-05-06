import Foundation
import SwiftUI

enum InvestmentType: String, Codable, CaseIterable, Identifiable {
    case stocks = "STOCKS"
    case realEstate = "REAL_ESTATE"
    case rothIRA = "ROTH_IRA"
    case four01K = "FOUR01K"
    case hsa = "HSA"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .stocks: "Stocks"
        case .realEstate: "Real estate"
        case .rothIRA: "Roth IRA"
        case .four01K: "401(k)"
        case .hsa: "HSA"
        }
    }
}

enum RealEstatePropertyType: String, Codable, CaseIterable, Identifiable {
    case singleFamily = "SINGLE_FAMILY"
    case multiFamily = "MULTI_FAMILY"
    case condo = "CONDO"
    case commercial = "COMMERCIAL"
    case land = "LAND"
    case other = "OTHER"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .singleFamily: "Single family"
        case .multiFamily: "Multi-family"
        case .condo: "Condo"
        case .commercial: "Commercial"
        case .land: "Land"
        case .other: "Other"
        }
    }
}

enum RealEstateUsageType: String, Codable, CaseIterable, Identifiable {
    case primaryResidence = "PRIMARY_RESIDENCE"
    case rental = "RENTAL"
    case vacationHome = "VACATION_HOME"
    case mixedUse = "MIXED_USE"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .primaryResidence: "Primary"
        case .rental: "Rental"
        case .vacationHome: "Vacation"
        case .mixedUse: "Mixed use"
        }
    }
}

enum RealEstateForecastScenario: String, Codable, CaseIterable, Identifiable {
    case moderate = "MODERATE"
    case standard = "STANDARD"
    case aggressive = "AGGRESSIVE"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .moderate: "Moderate"
        case .standard: "Standard"
        case .aggressive: "Aggressive"
        }
    }
}

struct InvestmentItem: Decodable, Identifiable, Equatable {
    let id: String
    let type: InvestmentType
    let name: String
    let startingBalance: Double
    let monthlyContribution: Double
    let annualReturnRate: Double
    let institutionName: String?
    let accountMask: String?
    let accountSubtype: String?
    let lastBalanceSyncAt: Date?
    let createdAt: Date?
    let updatedAt: Date?

    var isPlaidBacked: Bool { id.hasPrefix("plaid_") }
    var returnPercent: Double { annualReturnRate * 100 }

    static func fromPlaid(account: PlaidAccount, institutionName: String) -> InvestmentItem {
        InvestmentItem(
            id: "plaid_\(account.id)",
            type: InvestmentType(plaidSubtype: account.subtype),
            name: account.displayName,
            startingBalance: account.currentBalance ?? account.availableBalance ?? 0,
            monthlyContribution: account.monthlyContribution ?? 0,
            annualReturnRate: account.annualReturnRate ?? 0.07,
            institutionName: institutionName,
            accountMask: account.mask,
            accountSubtype: account.subtype,
            lastBalanceSyncAt: account.lastBalanceSyncAt,
            createdAt: nil,
            updatedAt: nil
        )
    }
}

extension InvestmentType {
    init(plaidSubtype: String?) {
        let normalized = plaidSubtype?.lowercased() ?? ""
        if normalized.contains("401") {
            self = .four01K
        } else if normalized.contains("ira") {
            self = .rothIRA
        } else if normalized.contains("hsa") {
            self = .hsa
        } else {
            self = .stocks
        }
    }
}

struct RealEstateProperty: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let propertyType: RealEstatePropertyType
    let usageType: RealEstateUsageType
    let purchasePrice: Double?
    let purchaseDate: Date?
    let downPayment: Double?
    let closingCosts: Double?
    let rehabCosts: Double?
    let currentEstimatedValue: Double
    let currentLoanBalance: Double
    let interestRate: Double?
    let loanTermYears: Int?
    let remainingTermMonths: Int?
    let monthlyMortgagePayment: Double?
    let monthlyRent: Double?
    let otherMonthlyIncome: Double?
    let vacancyRate: Double?
    let totalMonthlyExpenses: Double?
    let monthlyPropertyTax: Double?
    let monthlyInsurance: Double?
    let monthlyHOA: Double?
    let monthlyUtilities: Double?
    let monthlyMaintenance: Double?
    let monthlyManagement: Double?
    let monthlyOtherExpenses: Double?
    let appreciationRate: Double?
    let expenseGrowthRate: Double?
    let forecastScenario: RealEstateForecastScenario?
    let linkedPlaidAccountId: String?
    let createdAt: Date?
    let updatedAt: Date?

    var equity: Double { currentEstimatedValue - currentLoanBalance }
    var totalMonthlyIncome: Double { (monthlyRent ?? 0) + (otherMonthlyIncome ?? 0) }
    var effectiveMonthlyExpenses: Double {
        let itemized = [monthlyPropertyTax, monthlyInsurance, monthlyHOA, monthlyUtilities, monthlyMaintenance, monthlyManagement, monthlyOtherExpenses]
            .compactMap { $0 }
            .reduce(0, +)
        return itemized > 0 ? itemized : (totalMonthlyExpenses ?? 0)
    }
    var monthlyCashFlow: Double {
        totalMonthlyIncome - (monthlyMortgagePayment ?? 0) - effectiveMonthlyExpenses
    }

    var hasLinkedMortgage: Bool {
        linkedPlaidAccountId?.isEmpty == false
    }
}

struct LinkedPlaidAccountSummary: Identifiable, Equatable {
    let id: String
    let displayName: String
    let institutionName: String
    let mask: String?
    let type: String
    let subtype: String?
    let balance: Double
    let currency: String?
    let lastBalanceSyncAt: Date?

    init(account: PlaidAccount, institutionName: String) {
        id = account.id
        displayName = account.displayName
        self.institutionName = institutionName
        mask = account.mask
        type = account.type
        subtype = account.subtype
        balance = account.currentBalance ?? account.availableBalance ?? 0
        currency = account.currency
        lastBalanceSyncAt = account.lastBalanceSyncAt
    }

    var displayType: String {
        [type, subtype].compactMap { value in
            guard let value, !value.isEmpty else { return nil }
            return value.replacingOccurrences(of: "_", with: " ").capitalized
        }.joined(separator: " - ")
    }

    var maskedName: String {
        if let mask, !mask.isEmpty {
            return "\(displayName) (...\(mask))"
        }
        return displayName
    }

    var isMortgageCandidate: Bool {
        let normalized = "\(type) \(subtype ?? "") \(displayName)".lowercased()
        return normalized.contains("mortgage") || normalized.contains("loan") || normalized.contains("credit")
    }
}

struct InvestmentSummary: Decodable, Equatable {
    let totalBalance: Double
    let totalMonthly: Double
    let totalRealEstateEquity: Double
    let forecastedPortfolio: Double
    let forecastedBalance: Double
    let forecastedRealEstateEquity: Double
    let forecastMonths: Int
    let forecastYears: Double

    var totalCurrentPortfolio: Double { totalBalance + totalRealEstateEquity }
}

struct PortfolioAllocation: Decodable, Equatable {
    let sections: [PortfolioAllocationSection]
}

struct PortfolioAllocationSection: Decodable, Identifiable, Equatable {
    let key: String
    let label: String
    let value: Double
    let items: [PortfolioAllocationItem]

    var id: String { key }
}

struct PortfolioAllocationItem: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let value: Double
    let subtitle: String?
}

struct InvestmentForecast: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let type: InvestmentType
    let projections: [InvestmentForecastPoint]
}

struct InvestmentForecastPoint: Decodable, Identifiable, Equatable {
    let month: String
    let balance: Double
    let isForecast: Bool?

    var id: String { month }
    var dateValue: Date { DateFormatterProvider.parseYearMonth(month) ?? Date() }

    init(month: String, balance: Double, isForecast: Bool? = true) {
        self.month = month
        self.balance = balance
        self.isForecast = isForecast
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let month = try? container.decode(String.self, forKey: .month) {
            self.month = month
        } else {
            let monthNumber = try container.decode(Int.self, forKey: .month)
            self.month = String(monthNumber)
        }
        balance = try container.decode(Double.self, forKey: .balance)
        isForecast = try container.decodeIfPresent(Bool.self, forKey: .isForecast)
    }

    private enum CodingKeys: String, CodingKey {
        case month
        case balance
        case isForecast
    }
}

struct RealEstateProjection: Decodable, Equatable {
    let projections: [RealEstateProjectionPoint]
    let summary: RealEstateProjectionSummary
}

struct RealEstateProjectionPoint: Decodable, Identifiable, Equatable {
    let year: Int
    let propertyValue: Double
    let loanBalance: Double
    let equity: Double
    let cashFlow: Double?
    let totalReturn: Double?

    var id: Int { year }
}

struct RealEstateProjectionSummary: Decodable, Equatable {
    let totalAppreciation: Double
    let totalRent: Double
    let totalExpenses: Double
    let finalEquity: Double
}

struct InvestmentsLoadResult {
    let summary: InvestmentSummary
    let investments: [InvestmentItem]
    let properties: [RealEstateProperty]
    let allocation: PortfolioAllocation
    let forecast: [InvestmentForecast]
    let activeScenario: ForecastScenario?
    let institutions: [PlaidInstitution]
}

struct InvestmentActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}
