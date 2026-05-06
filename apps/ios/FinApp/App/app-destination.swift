import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case home
    case more

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home:
            return "Home"
        case .more:
            return "More"
        }
    }

    var systemImage: String {
        switch self {
        case .home:
            return "house.fill"
        case .more:
            return "chevron.up"
        }
    }
}

enum AppDestination: String, CaseIterable, Identifiable {
    case agent
    case demoMode
    case household
    case accountSettings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .agent:
            return "Agent"
        case .demoMode:
            return "Demo mode"
        case .household:
            return "Household"
        case .accountSettings:
            return "Account settings"
        }
    }

    var systemImage: String {
        switch self {
        case .agent:
            return "sparkles"
        case .demoMode:
            return "play.circle.fill"
        case .household:
            return "person.2.fill"
        case .accountSettings:
            return "person.crop.circle.fill"
        }
    }

    var tab: AppTab? { nil }
}
