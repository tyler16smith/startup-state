import Foundation

struct AccountSettingsSnapshot: Equatable {
    let billingStatus: BillingStatus
    let billingPlans: [BillingPlan]
    let twoFactorStatus: TwoFactorStatus
}

struct ProfileUpdateResponse: Decodable, Equatable {
    let name: String
}

struct BillingPlanListResponse: Decodable, Equatable {
    let plans: [BillingPlan]
}

struct BillingPlan: Decodable, Identifiable, Equatable {
    let key: String
    let name: String
    let amount: Int
    let currency: String
    let interval: String
    let displayPrice: String
    let displaySubtext: String?
    let displayBadge: String?

    var id: String { key }
}

struct BillingStatus: Decodable, Equatable {
    let planType: String?
    let planStatus: String?
    let trialEndsAt: Date?
    let subscriptionStatus: String?
    let subscriptionPlan: String?
    let subscriptionCurrentPeriodStart: Date?
    let subscriptionCurrentPeriodEnd: Date?
    let subscriptionCancelAtPeriodEnd: Bool?
    let hasProAccess: Bool?
    let canSync: Bool?
    let referralCode: String?
    let referralCredits: Int?
    let referralCount: Int?
    let referralLink: String?
    let shareCopy: String?
}

struct ReferralApplyResponse: Decodable, Equatable {
    let applied: Bool?
    let referralCredits: Int?
    let message: String?
}

struct CheckoutSessionResponse: Decodable, Equatable {
    let clientSecret: String
    let sessionId: String

    var webBillingURL: URL {
        URL(string: "/dashboard/settings", relativeTo: Environment.webBaseURL)?.absoluteURL ?? Environment.webBaseURL
    }
}

struct CheckoutSessionSyncResponse: Decodable, Equatable {
    let canSync: Bool
    let hasProAccess: Bool
    let reason: String?
    let subscriptionPlan: String?
    let subscriptionStatus: String?
    let synced: Bool

    var displayMessage: String {
        if synced { return "Subscription status synced." }
        if let reason, !reason.isEmpty { return reason }
        return "Checkout session checked."
    }
}

struct BillingPortalResponse: Decodable, Equatable {
    let url: String
}

struct TwoFactorStatus: Decodable, Equatable {
    let twoFactorEnabled: Bool
    let twoFactorVerified: Bool
}

struct TwoFactorSecretResponse: Decodable, Equatable {
    let secret: String
    let qrCode: String
}

struct TwoFactorEnableResponse: Decodable, Equatable {
    let backupCodes: [String]
}

struct AccountSettingsActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

enum AccountSettingsValidationError: LocalizedError {
    case emptyName
    case emptyToken
    case emptyPassword
    case emailMismatch

    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Enter a display name."
        case .emptyToken:
            return "Enter a verification code."
        case .emptyPassword:
            return "Enter your password."
        case .emailMismatch:
            return "Enter the account email exactly."
        }
    }
}