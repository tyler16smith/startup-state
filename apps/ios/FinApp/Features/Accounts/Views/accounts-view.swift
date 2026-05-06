import SwiftUI

struct AccountsView: View {
    @StateObject private var viewModel = AccountsViewModel()
    @State private var selectedInstitution: PlaidInstitution?
    @State private var selectedAccount: PlaidAccount?
    @State private var disconnectCandidate: PlaidInstitution?

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading accounts...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Accounts")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        Task { await viewModel.connectAccount() }
                    } label: {
                        Label("Connect account", systemImage: "link.badge.plus")
                    }

                    Button {
                        Task { await viewModel.syncAll() }
                    } label: {
                        Label("Sync all", systemImage: "arrow.triangle.2.circlepath")
                    }

                    Button {
                        Task { await viewModel.refresh() }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .sheet(item: actionMessageBinding) { message in
            FinGlassSheet(title: message.title) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Image(systemName: message.message.lowercased().contains("error") ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                        .font(.system(size: 44, weight: .semibold))
                        .foregroundStyle(message.message.lowercased().contains("error") ? FinTheme.ColorToken.warning : FinTheme.ColorToken.positive)
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
        .task {
            await viewModel.load()
        }
    }

    private var actionMessageBinding: Binding<AccountsActionMessage?> {
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
                AccountsSummaryCard(
                    totalBalance: viewModel.totalBalance,
                    institutionCount: viewModel.institutions.count,
                    accountCount: viewModel.accountCount,
                    reconnectCount: viewModel.reconnectCount,
                    isDemoMode: viewModel.isDemoMode
                )

                if viewModel.institutions.isEmpty {
                    emptyAccounts
                } else {
                    VStack(spacing: FinTheme.Spacing.medium) {
                        ForEach(viewModel.institutions) { institution in
                            InstitutionCard(
                                institution: institution,
                                onShowDetails: { selectedInstitution = institution },
                                onSync: { Task { await viewModel.sync(institution) } },
                                onReconnect: { Task { await viewModel.reconnectWithLink(for: institution) } },
                                onMarkReconnected: { Task { await viewModel.reconnect(institution) } },
                                onDisconnect: { disconnectCandidate = institution },
                                onShowAccountDetails: { selectedAccount = $0 },
                                onToggleAccountHidden: { account, hidden in
                                    Task { await viewModel.setHidden(account, hidden: hidden) }
                                }
                            )
                        }
                    }
                }
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
        .sheet(item: $selectedInstitution) { institution in
            InstitutionDetailSheet(institution: institution)
        }
        .sheet(item: $selectedAccount) { account in
            AccountDetailSheet(account: account)
        }
        .sheet(item: $disconnectCandidate) { institution in
            DisconnectInstitutionSheet(
                institution: institution,
                onCancel: { disconnectCandidate = nil },
                onDisconnect: {
                    await viewModel.disconnect(institution)
                    disconnectCandidate = nil
                }
            )
        }
    }

    private var emptyAccounts: some View {
        VStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "building.columns")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No connected institutions")
                .font(.headline)
            Text("Connect your bank to start syncing balances, transactions, and investment accounts.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.connectAccount() }
            } label: {
                Label("Connect account", systemImage: "link.badge.plus")
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FinTheme.Spacing.xxLarge)
    }
}

private struct AccountsSummaryCard: View {
    let totalBalance: Double
    let institutionCount: Int
    let accountCount: Int
    let reconnectCount: Int
    let isDemoMode: Bool

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                if isDemoMode {
                    Label("Demo data", systemImage: "sparkles")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(FinTheme.ColorToken.accent)
                }

                VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                    Text("Connected balance")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(CurrencyFormatter.formatCompact(totalBalance))
                        .font(.largeTitle.weight(.bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                HStack {
                    AccountsMetric(title: "Institutions", value: "\(institutionCount)", systemImage: "building.columns.fill")
                    AccountsMetric(title: "Accounts", value: "\(accountCount)", systemImage: "creditcard.fill")
                    AccountsMetric(title: "Reconnect", value: "\(reconnectCount)", systemImage: "exclamationmark.arrow.triangle.2.circlepath")
                }
            }
        }
    }
}

private struct AccountsMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Image(systemName: systemImage)
                .foregroundStyle(FinTheme.ColorToken.accent)
            Text(value)
                .font(.headline)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct InstitutionCard: View {
    let institution: PlaidInstitution
    let onShowDetails: () -> Void
    let onSync: () -> Void
    let onReconnect: () -> Void
    let onMarkReconnected: () -> Void
    let onDisconnect: () -> Void
    let onShowAccountDetails: (PlaidAccount) -> Void
    let onToggleAccountHidden: (PlaidAccount, Bool) -> Void

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                        Text(institution.institutionName)
                            .font(.headline)
                        Text(syncSubtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    if institution.requiresReconnect {
                        Text("Reconnect")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(FinTheme.ColorToken.warning)
                            .padding(.horizontal, FinTheme.Spacing.small)
                            .padding(.vertical, FinTheme.Spacing.xSmall)
                            .background(FinTheme.ColorToken.warning.opacity(0.12))
                            .clipShape(Capsule())
                    }

                    Menu {
                        Button(action: onShowDetails) {
                            Label("Details", systemImage: "info.circle")
                        }
                        Button(action: onSync) {
                            Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                        }
                        Button(action: onReconnect) {
                            Label("Reconnect", systemImage: "link")
                        }
                        Button(action: onMarkReconnected) {
                            Label("Mark reconnected", systemImage: "arrow.triangle.2.circlepath")
                        }
                        Divider()
                        Button(role: .destructive, action: onDisconnect) {
                            Label("Disconnect", systemImage: "xmark.circle")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }

                VStack(spacing: FinTheme.Spacing.small) {
                    ForEach(institution.accounts) { account in
                        AccountRow(
                            account: account,
                            onShowDetails: { onShowAccountDetails(account) },
                            onToggleHidden: { onToggleAccountHidden(account, !(account.accountHidden ?? false)) }
                        )
                    }
                }
            }
        }
    }

    private var syncSubtitle: String {
        if let message = institution.lastErrorMessage, !message.isEmpty {
            return message
        }

        if let lastSuccessfulSyncAt = institution.lastSuccessfulSyncAt {
            return "Last synced \(DateFormatterProvider.fullDate(lastSuccessfulSyncAt))"
        }

        return "\(institution.accounts.count) accounts"
    }
}

private struct AccountRow: View {
    let account: PlaidAccount
    let onShowDetails: () -> Void
    let onToggleHidden: () -> Void

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: iconName)
                .foregroundStyle(account.accountHidden == true ? FinTheme.ColorToken.textSecondary : FinTheme.ColorToken.accent)
                .frame(width: 34, height: 34)
                .background(FinTheme.ColorToken.elevatedSurface)
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(account.displayName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text([account.displayType, account.mask.map { "••\($0)" }].compactMap { $0 }.joined(separator: " - "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(CurrencyFormatter.formatCompact(account.currentBalance ?? account.availableBalance ?? 0))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                HStack(spacing: 6) {
                    Button(action: onShowDetails) {
                        Image(systemName: "info.circle")
                            .font(.caption)
                    }

                    Button(action: onToggleHidden) {
                        Image(systemName: account.accountHidden == true ? "eye.slash" : "eye")
                            .font(.caption)
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.mini)
            }
        }
        .opacity(account.accountHidden == true ? 0.55 : 1)
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }

    private var iconName: String {
        switch account.type.lowercased() {
        case "depository": "creditcard.fill"
        case "investment": "chart.line.uptrend.xyaxis"
        case "credit": "creditcard.trianglebadge.exclamationmark"
        case "loan": "building.columns.fill"
        default: "wallet.pass.fill"
        }
    }
}

private struct InstitutionDetailSheet: View {
    let institution: PlaidInstitution

    var body: some View {
        FinGlassSheet(title: "Institution details") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                detailHeader(title: institution.institutionName, subtitle: institution.institutionId ?? "Connected institution", systemImage: "building.columns.fill")

                detailGrid {
                    DetailRow(title: "Accounts", value: "\(institution.accounts.count)")
                    DetailRow(title: "Active accounts", value: "\(institution.activeAccounts.count)")
                    DetailRow(title: "Balance", value: CurrencyFormatter.format(institution.balance))
                    DetailRow(title: "Sync status", value: institution.syncAccessStatus ?? "ACTIVE")
                    DetailRow(title: "Last sync", value: institution.lastSuccessfulSyncAt.map(DateFormatterProvider.fullDate) ?? "Not synced yet")
                    DetailRow(title: "Connected", value: institution.createdAt.map(DateFormatterProvider.fullDate) ?? "Unknown")
                }

                if let error = institution.lastErrorMessage, !error.isEmpty {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.warning)
                }
            }
        }
    }
}

private struct AccountDetailSheet: View {
    let account: PlaidAccount

    var body: some View {
        FinGlassSheet(title: "Account details") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                detailHeader(title: account.displayName, subtitle: account.displayType, systemImage: "creditcard.fill")

                detailGrid {
                    DetailRow(title: "Current balance", value: CurrencyFormatter.format(account.currentBalance ?? 0))
                    DetailRow(title: "Available", value: account.availableBalance.map(CurrencyFormatter.format) ?? "Not reported")
                    DetailRow(title: "Currency", value: account.currency ?? "USD")
                    DetailRow(title: "Mask", value: account.mask.map { "••\($0)" } ?? "Not reported")
                    DetailRow(title: "Hidden", value: account.accountHidden == true ? "Yes" : "No")
                    DetailRow(title: "Last balance sync", value: account.lastBalanceSyncAt.map(DateFormatterProvider.fullDate) ?? "Not synced yet")
                }
            }
        }
    }
}

private struct DisconnectInstitutionSheet: View {
    let institution: PlaidInstitution
    let onCancel: () -> Void
    let onDisconnect: () async -> Void

    @State private var isWorking = false

    var body: some View {
        FinGlassSheet(title: "Disconnect institution") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                detailHeader(title: institution.institutionName, subtitle: "\(institution.accounts.count) linked accounts", systemImage: "xmark.circle.fill")
                Text("This removes the Plaid connection and stops future syncs. Existing transactions and balances stay in Fin unless you delete them separately.")
                    .font(.body)
                    .foregroundStyle(.secondary)

                HStack(spacing: FinTheme.Spacing.medium) {
                    Button {
                        onCancel()
                    } label: {
                        Text("Cancel").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isWorking)

                    Button(role: .destructive) {
                        Task { await disconnect() }
                    } label: {
                        if isWorking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label("Disconnect", systemImage: "xmark.circle").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWorking)
                }
            }
        }
    }

    private func disconnect() async {
        isWorking = true
        defer { isWorking = false }
        await onDisconnect()
    }
}

private struct DetailRow: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private func detailHeader(title: String, subtitle: String, systemImage: String) -> some View {
    HStack(spacing: FinTheme.Spacing.medium) {
        Image(systemName: systemImage)
            .font(.title2)
            .foregroundStyle(FinTheme.ColorToken.accent)
            .frame(width: 44, height: 44)
            .background(FinTheme.ColorToken.accent.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))

        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.headline)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

private func detailGrid<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: FinTheme.Spacing.medium) {
        content()
    }
    .padding(FinTheme.Spacing.medium)
    .background(FinTheme.ColorToken.surface)
    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
}

#Preview {
    NavigationStack {
        AccountsView()
    }
}
