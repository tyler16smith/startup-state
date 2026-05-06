import Foundation

@MainActor
final class InvestmentsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var summary: InvestmentSummary?
    @Published private(set) var investments: [InvestmentItem] = []
    @Published private(set) var properties: [RealEstateProperty] = []
    @Published private(set) var allocation = PortfolioAllocation(sections: [])
    @Published private(set) var forecast: [InvestmentForecast] = []
    @Published private(set) var activeScenario: ForecastScenario?
    @Published private(set) var institutions: [PlaidInstitution] = []
    @Published private(set) var actionMessage: InvestmentActionMessage?

    private let service: InvestmentsService

    init(service: InvestmentsService = InvestmentsService()) {
        self.service = service
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false)
    }

    func saveInvestment(
        investment: InvestmentItem?,
        type: InvestmentType,
        name: String,
        startingBalance: Double,
        monthlyContribution: Double,
        returnPercent: Double
    ) async throws {
        try await service.saveInvestment(
            id: investment?.id,
            type: type,
            name: name,
            startingBalance: startingBalance,
            monthlyContribution: monthlyContribution,
            annualReturnRate: returnPercent / 100
        )
        actionMessage = InvestmentActionMessage(title: "Investment saved", message: name)
        await refresh()
    }

    func deleteInvestment(_ investment: InvestmentItem) async throws {
        try await service.deleteInvestment(id: investment.id)
        actionMessage = InvestmentActionMessage(title: "Investment removed", message: investment.name)
        await refresh()
    }

    func saveProperty(
        property: RealEstateProperty?,
        name: String,
        propertyType: RealEstatePropertyType,
        usageType: RealEstateUsageType,
        currentEstimatedValue: Double,
        currentLoanBalance: Double,
        monthlyMortgagePayment: Double,
        monthlyRent: Double,
        totalMonthlyExpenses: Double,
        appreciationPercent: Double,
        forecastScenario: RealEstateForecastScenario,
        linkedPlaidAccountId: String?
    ) async throws {
        try await service.saveProperty(
            id: property?.id,
            name: name,
            propertyType: propertyType,
            usageType: usageType,
            currentEstimatedValue: currentEstimatedValue,
            currentLoanBalance: currentLoanBalance,
            monthlyMortgagePayment: monthlyMortgagePayment,
            monthlyRent: monthlyRent,
            totalMonthlyExpenses: totalMonthlyExpenses,
            appreciationRate: appreciationPercent / 100,
            forecastScenario: forecastScenario,
            linkedPlaidAccountId: linkedPlaidAccountId
        )
        actionMessage = InvestmentActionMessage(title: "Property saved", message: name)
        await refresh()
    }

    func deleteProperty(_ property: RealEstateProperty) async throws {
        try await service.deleteProperty(id: property.id)
        actionMessage = InvestmentActionMessage(title: "Property removed", message: property.name)
        await refresh()
    }

    func loadProjection(for property: RealEstateProperty) async throws -> RealEstateProjection {
        try await service.loadPropertyProjection(
            propertyId: property.id,
            scenario: property.forecastScenario
        )
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    var linkedAccounts: [LinkedPlaidAccountSummary] {
        institutions.flatMap { institution in
            institution.accounts
                .filter { $0.isActive }
                .map { LinkedPlaidAccountSummary(account: $0, institutionName: institution.institutionName) }
        }
    }

    var mortgageAccountCandidates: [LinkedPlaidAccountSummary] {
        linkedAccounts.sorted { lhs, rhs in
            if lhs.isMortgageCandidate != rhs.isMortgageCandidate {
                return lhs.isMortgageCandidate && !rhs.isMortgageCandidate
            }
            return lhs.displayName < rhs.displayName
        }
    }

    func linkedAccount(for property: RealEstateProperty) -> LinkedPlaidAccountSummary? {
        guard let linkedPlaidAccountId = property.linkedPlaidAccountId else { return nil }
        return linkedAccounts.first { $0.id == linkedPlaidAccountId }
    }

    private func reload(showLoading: Bool) async {
        state = showLoading ? .loading : .refreshing

        do {
            let result = try await service.load()
            summary = result.summary
            investments = result.investments
            properties = result.properties
            allocation = result.allocation
            forecast = result.forecast
            activeScenario = result.activeScenario
            institutions = result.institutions
            state = .loaded
        } catch {
            state = .error(error)
        }
    }
}
