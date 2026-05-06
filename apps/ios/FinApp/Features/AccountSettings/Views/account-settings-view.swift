import SwiftUI
import UIKit

struct AccountSettingsView: View {
    @StateObject private var viewModel = AccountSettingsViewModel()
    @SwiftUI.Environment(\.openURL) private var openURL
    @State private var profileName = ""
    @State private var referralCode = ""
    @State private var twoFactorToken = ""
    @State private var twoFactorPassword = ""
    @State private var deleteEmail = ""
    @State private var activeSheet: AccountSettingsSheet?
    @State private var checkoutSessionId = ""

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading account...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Account Settings")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await viewModel.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .refreshable { await viewModel.refresh() }
        .sheet(item: $activeSheet) { sheet in
            sheetContent(sheet)
        }
        .sheet(item: actionMessageBinding) { message in
            FinGlassSheet(title: message.title) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text(message.message)
                        .font(.body)
                        .foregroundStyle(.secondary)
                    Button {
                        viewModel.clearActionMessage()
                    } label: {
                        Text("Done").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
        }
        .task { await viewModel.load() }
    }

    private var actionMessageBinding: Binding<AccountSettingsActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: FinTheme.Spacing.large) {
                AccountProfileCard(email: viewModel.email) {
                    profileName = ""
                    activeSheet = .profile
                }

                if let snapshot = viewModel.snapshot {
                    BillingSettingsCard(snapshot: snapshot, referralCode: $referralCode, onApplyReferral: {
                        Task { await viewModel.applyReferralCode(referralCode) }
                    }, onCheckout: { plan in
                        Task {
                            if await viewModel.createCheckoutSession(plan: plan) {
                                checkoutSessionId = viewModel.checkoutSession?.sessionId ?? ""
                                activeSheet = .checkout
                            }
                        }
                    }, onPortal: {
                        Task {
                            if let url = await viewModel.createPortalSession() {
                                openURL(url)
                            }
                        }
                    })

                    TwoFactorSettingsCard(status: snapshot.twoFactorStatus, onGenerate: {
                        Task { await viewModel.generateTwoFactorSecret() }
                        activeSheet = .twoFactorEnable
                    }, onDisable: {
                        activeSheet = .twoFactorDisable
                    })
                }

                HouseholdSharingView()

                DataSettingsCard(onExport: {
                    Task {
                        if await viewModel.exportData() {
                            activeSheet = .dataExport
                        }
                    }
                }, onDelete: {
                    deleteEmail = ""
                    activeSheet = .deleteAccount
                })
            }
            .padding(.horizontal, FinTheme.Spacing.large)
            .padding(.top, FinTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .overlay(alignment: .top) {
            if case .refreshing = viewModel.state {
                ProgressView()
                    .padding(FinTheme.Spacing.small)
                    .finGlass(cornerRadius: FinTheme.Radius.pill)
                    .padding(.top, FinTheme.Spacing.small)
            }
        }
    }

    @ViewBuilder
    private func sheetContent(_ sheet: AccountSettingsSheet) -> some View {
        switch sheet {
        case .profile:
            FinGlassSheet(title: "Profile") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    TextField("Display name", text: $profileName)
                        .textFieldStyle(.roundedBorder)
                    Button {
                        Task {
                            try await viewModel.updateProfile(name: profileName)
                            activeSheet = nil
                        }
                    } label: {
                        Text("Save profile").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
        case .twoFactorEnable:
            FinGlassSheet(title: "Enable 2FA") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    if let secret = viewModel.generatedTwoFactorSecret {
                        TwoFactorQRCodeView(secret: secret)
                    } else {
                        ProgressView()
                    }

                    TextField("Verification code", text: $twoFactorToken)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)

                    Button {
                        Task {
                            try await viewModel.enableTwoFactor(token: twoFactorToken)
                            twoFactorToken = ""
                            activeSheet = .backupCodes
                        }
                    } label: {
                        Text("Enable 2FA").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
        case .backupCodes:
            FinGlassSheet(title: "Backup Codes") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text("Save these now. They are only shown once.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    BackupCodeGrid(codes: viewModel.backupCodes)

                    ShareLink(item: viewModel.backupCodes.joined(separator: "\n")) {
                        Label("Share backup codes", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button {
                        activeSheet = nil
                    } label: {
                        Text("Done").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
        case .dataExport:
            FinGlassSheet(title: "Data Export") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text("Your export is ready to share or save.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if let exportedDataText = viewModel.exportedDataText {
                        ScrollView {
                            Text(exportedDataText)
                                .font(.caption.monospaced())
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(FinTheme.Spacing.medium)
                        }
                        .frame(maxHeight: 260)
                        .background(FinTheme.ColorToken.elevatedSurface)
                        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))

                        ShareLink(item: exportedDataText) {
                            Label("Share export", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
            }
        case .checkout:
            FinGlassSheet(title: "Checkout") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    if let checkoutSession = viewModel.checkoutSession {
                        Text("A Stripe checkout session is ready. Complete checkout in the web billing page, then sync the session here.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        Button {
                            openURL(checkoutSession.webBillingURL)
                        } label: {
                            Label("Open billing page", systemImage: "arrow.up.right.square")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)

                        TextField("Session ID", text: $checkoutSessionId)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        ShareLink(item: checkoutSession.sessionId) {
                            Label("Share session ID", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)

                        Button {
                            Task { await viewModel.syncCheckoutSession(sessionId: checkoutSessionId) }
                        } label: {
                            Label("Sync checkout", systemImage: "arrow.triangle.2.circlepath")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
        case .twoFactorDisable:
            FinGlassSheet(title: "Disable 2FA") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    SecureField("Password", text: $twoFactorPassword)
                        .textFieldStyle(.roundedBorder)
                    Button(role: .destructive) {
                        Task {
                            try await viewModel.disableTwoFactor(password: twoFactorPassword)
                            activeSheet = nil
                        }
                    } label: {
                        Text("Disable 2FA").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                }
            }
        case .deleteAccount:
            FinGlassSheet(title: "Delete Account") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    TextField("Email", text: $deleteEmail)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .textFieldStyle(.roundedBorder)
                    Button(role: .destructive) {
                        Task {
                            try await viewModel.deleteAccount(confirmationEmail: deleteEmail)
                            activeSheet = nil
                        }
                    } label: {
                        Text("Delete account").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                }
            }
        }
    }
}

private enum AccountSettingsSheet: Identifiable {
    case profile
    case twoFactorEnable
    case backupCodes
    case twoFactorDisable
    case dataExport
    case checkout
    case deleteAccount

    var id: String {
        switch self {
        case .profile:
            return "profile"
        case .twoFactorEnable:
            return "two-factor-enable"
        case .backupCodes:
            return "backup-codes"
        case .twoFactorDisable:
            return "two-factor-disable"
        case .dataExport:
            return "data-export"
        case .checkout:
            return "checkout"
        case .deleteAccount:
            return "delete-account"
        }
    }
}

private struct AccountProfileCard: View {
    let email: String
    let onEdit: () -> Void

    var body: some View {
        FinCard {
            HStack(spacing: FinTheme.Spacing.medium) {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(FinTheme.ColorToken.accent)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Profile")
                        .font(.headline)
                    Text(email.isEmpty ? "Signed in" : email)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(action: onEdit) {
                    Image(systemName: "pencil")
                }
                .buttonStyle(.bordered)
            }
        }
    }
}

private struct BillingSettingsCard: View {
    let snapshot: AccountSettingsSnapshot
    @Binding var referralCode: String
    let onApplyReferral: () -> Void
    let onCheckout: (String) -> Void
    let onPortal: () -> Void

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                SettingsSectionHeader(title: "Billing", systemImage: "creditcard.fill")
                SettingsFact(title: "Plan", value: snapshot.billingStatus.subscriptionPlan ?? snapshot.billingStatus.planType ?? "None")
                SettingsFact(title: "Status", value: snapshot.billingStatus.subscriptionStatus ?? snapshot.billingStatus.planStatus ?? "None")
                SettingsFact(title: "Pro access", value: snapshot.billingStatus.hasProAccess == true ? "Yes" : "No")
                if let referralCode = snapshot.billingStatus.referralCode, !referralCode.isEmpty {
                    SettingsFact(title: "Referral code", value: referralCode)
                }
                if let referralCredits = snapshot.billingStatus.referralCredits {
                    SettingsFact(title: "Referral credits", value: "\(referralCredits)")
                }

                HStack {
                    TextField("Referral code", text: $referralCode)
                        .textInputAutocapitalization(.characters)
                        .textFieldStyle(.roundedBorder)
                    Button("Apply", action: onApplyReferral)
                        .buttonStyle(.bordered)
                }

                ForEach(snapshot.billingPlans) { plan in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(plan.name)
                                .font(.subheadline.weight(.semibold))
                            Text([plan.displayPrice, plan.displaySubtext].compactMap { $0 }.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Start") { onCheckout(plan.key) }
                            .buttonStyle(.bordered)
                    }
                }

                Button(action: onPortal) {
                    Label("Manage billing", systemImage: "arrow.up.right.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                if let referralShareText {
                    ShareLink(item: referralShareText) {
                        Label("Share referral link", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    private var referralShareText: String? {
        guard let referralLink = snapshot.billingStatus.referralLink, !referralLink.isEmpty else { return nil }
        let copy = snapshot.billingStatus.shareCopy ?? "Try the app with my referral link."
        return "\(copy)\n\n\(referralLink)"
    }
}

private struct TwoFactorQRCodeView: View {
    let secret: TwoFactorSecretResponse

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            if let image = secret.qrImage {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 220)
                    .padding(FinTheme.Spacing.medium)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
                    .frame(maxWidth: .infinity)
            }

            Text(secret.secret)
                .font(.footnote.monospaced())
                .textSelection(.enabled)
                .padding(FinTheme.Spacing.medium)
                .background(FinTheme.ColorToken.elevatedSurface)
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
        }
    }
}

private struct BackupCodeGrid: View {
    let codes: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: FinTheme.Spacing.small) {
            ForEach(codes, id: \.self) { code in
                Text(code)
                    .font(.footnote.monospaced().weight(.semibold))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity)
                    .padding(FinTheme.Spacing.small)
                    .background(FinTheme.ColorToken.elevatedSurface)
                    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
            }
        }
    }
}

private extension TwoFactorSecretResponse {
    var qrImage: UIImage? {
        let base64: String
        if let commaIndex = qrCode.firstIndex(of: ",") {
            base64 = String(qrCode[qrCode.index(after: commaIndex)...])
        } else {
            base64 = qrCode
        }

        guard let data = Data(base64Encoded: base64) else { return nil }
        return UIImage(data: data)
    }
}

private struct TwoFactorSettingsCard: View {
    let status: TwoFactorStatus
    let onGenerate: () -> Void
    let onDisable: () -> Void

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                SettingsSectionHeader(title: "Two-Factor", systemImage: "lock.shield.fill")
                SettingsFact(title: "Enabled", value: status.twoFactorEnabled ? "Yes" : "No")
                SettingsFact(title: "Verified", value: status.twoFactorVerified ? "Yes" : "No")

                if status.twoFactorEnabled {
                    Button(role: .destructive, action: onDisable) {
                        Label("Disable 2FA", systemImage: "lock.open")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                } else {
                    Button(action: onGenerate) {
                        Label("Set up 2FA", systemImage: "lock.badge.clock")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
    }
}

private struct DataSettingsCard: View {
    let onExport: () -> Void
    let onDelete: () -> Void

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                SettingsSectionHeader(title: "Data", systemImage: "externaldrive.fill")
                Button(action: onExport) {
                    Label("Export data", systemImage: "square.and.arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button(role: .destructive, action: onDelete) {
                    Label("Delete account", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
    }
}

private struct SettingsSectionHeader: View {
    let title: String
    let systemImage: String

    var body: some View {
        HStack {
            Image(systemName: systemImage)
                .foregroundStyle(FinTheme.ColorToken.accent)
            Text(title)
                .font(.headline)
        }
    }
}

private struct SettingsFact: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}