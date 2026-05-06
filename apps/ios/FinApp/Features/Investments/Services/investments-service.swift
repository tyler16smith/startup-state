import Foundation

actor InvestmentsService {
    private let apiClient: APIClient
    private let accountsService: AccountsService

    init(apiClient: APIClient = .shared, accountsService: AccountsService = AccountsService()) {
        self.apiClient = apiClient
        self.accountsService = accountsService
    }

    func load() async throws -> InvestmentsLoadResult {
        let scenarios: [ForecastScenario] = try await apiClient.get(path: "/api/v1/scenario/getAll")
        let activeScenario = scenarios.first(where: \.isActive)

        async let summary: InvestmentSummary = apiClient.post(
            path: "/api/v1/investment/getSummary",
            body: summaryRequestBody(activeScenario: activeScenario)
        )
        async let investments: [InvestmentItem] = apiClient.get(path: "/api/v1/investment/getAll")
        async let properties: [RealEstateProperty] = apiClient.get(path: "/api/v1/realEstate/list")
        async let allocation: PortfolioAllocation = apiClient.get(path: "/api/v1/investment/getPortfolioAllocation")
        async let forecast: [InvestmentForecast] = apiClient.post(
            path: "/api/v1/investment/getForecast",
            body: forecastRequestBody(activeScenario: activeScenario)
        )
        async let accountsResult: AccountsLoadResult = accountsService.load()

        let loadedAccounts = try await accountsResult
        let institutions = loadedAccounts.institutions
        let plaidInvestments = institutions.flatMap { institution in
            institution.accounts
                .filter { account in
                    account.type.lowercased() == "investment" && account.isActive && account.investmentHidden != true
                }
                .map { InvestmentItem.fromPlaid(account: $0, institutionName: institution.institutionName) }
        }

        return try await InvestmentsLoadResult(
            summary: summary,
            investments: investments + plaidInvestments,
            properties: properties,
            allocation: allocation,
            forecast: forecast,
            activeScenario: activeScenario,
            institutions: institutions
        )
    }

    func loadPropertyProjection(
        propertyId: String,
        scenario: RealEstateForecastScenario?,
        years: Int = 5
    ) async throws -> RealEstateProjection {
        var body: [String: JSONValue] = [
            "id": .string(propertyId),
            "years": .number(Double(years))
        ]
        if let scenario {
            body["scenario"] = .string(scenario.rawValue)
        }

        return try await apiClient.post(
            path: "/api/v1/realEstate/getProjection",
            body: .object(body)
        )
    }

    func saveInvestment(
        id: String?,
        type: InvestmentType,
        name: String,
        startingBalance: Double,
        monthlyContribution: Double,
        annualReturnRate: Double
    ) async throws {
        var body: [String: JSONValue] = [
            "type": .string(type.rawValue),
            "name": .string(name),
            "startingBalance": .number(startingBalance),
            "monthlyContribution": .number(monthlyContribution),
            "annualReturnRate": .number(annualReturnRate)
        ]

        let path: String
        if let id {
            body["id"] = .string(id)
            path = "/api/v1/investment/update"
        } else {
            path = "/api/v1/investment/create"
        }

        let _: JSONValue = try await apiClient.post(path: path, body: .object(body))
    }

    func deleteInvestment(id: String) async throws {
        let _: JSONValue = try await apiClient.post(
            path: "/api/v1/investment/delete",
            body: .object(["id": .string(id)])
        )
    }

    func saveProperty(
        id: String?,
        name: String,
        propertyType: RealEstatePropertyType,
        usageType: RealEstateUsageType,
        currentEstimatedValue: Double,
        currentLoanBalance: Double,
        monthlyMortgagePayment: Double,
        monthlyRent: Double,
        totalMonthlyExpenses: Double,
        appreciationRate: Double,
        forecastScenario: RealEstateForecastScenario,
        linkedPlaidAccountId: String?
    ) async throws {
        var body: [String: JSONValue] = [
            "name": .string(name),
            "propertyType": .string(propertyType.rawValue),
            "usageType": .string(usageType.rawValue),
            "currentEstimatedValue": .number(currentEstimatedValue),
            "currentLoanBalance": .number(currentLoanBalance),
            "monthlyMortgagePayment": .number(monthlyMortgagePayment),
            "monthlyRent": .number(monthlyRent),
            "totalMonthlyExpenses": .number(totalMonthlyExpenses),
            "appreciationRate": .number(appreciationRate),
            "forecastScenario": .string(forecastScenario.rawValue)
        ]
        if let linkedPlaidAccountId {
            body["linkedPlaidAccountId"] = linkedPlaidAccountId.isEmpty ? .null : .string(linkedPlaidAccountId)
        }

        let path: String
        if let id {
            body["id"] = .string(id)
            path = "/api/v1/realEstate/update"
        } else {
            path = "/api/v1/realEstate/create"
        }

        let _: JSONValue = try await apiClient.post(path: path, body: .object(body))
    }

    func deleteProperty(id: String) async throws {
        let _: JSONValue = try await apiClient.post(
            path: "/api/v1/realEstate/delete",
            body: .object(["id": .string(id)])
        )
    }

    private func summaryRequestBody(activeScenario: ForecastScenario?) -> JSONValue {
        var body: [String: JSONValue] = ["forecastMonths": .number(60)]
        if let activeScenario {
            body["scenarioReturnRate"] = .number(activeScenario.investmentReturn)
        }
        return .object(body)
    }

    private func forecastRequestBody(activeScenario: ForecastScenario?) -> JSONValue {
        var body: [String: JSONValue] = ["months": .number(60)]
        if let activeScenario {
            body["scenarioOverrides"] = .object([
                "annualReturnRate": .number(activeScenario.investmentReturn)
            ])
        }
        return .object(body)
    }
}
