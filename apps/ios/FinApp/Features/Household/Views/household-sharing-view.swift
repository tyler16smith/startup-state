import SwiftUI

struct HouseholdSharingView: View {
    @StateObject private var viewModel = HouseholdViewModel()
    @State private var inviteName = ""
    @State private var inviteEmail = ""

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                loadingCard
            case .loaded, .refreshing:
                loadedCard
            case .error(let error):
                errorCard(error)
            }
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

    private var actionMessageBinding: Binding<HouseholdActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var loadingCard: some View {
        FinCard {
            HStack(spacing: FinTheme.Spacing.medium) {
                ProgressView()
                Text("Loading household...")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var loadedCard: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                HouseholdSectionHeader(title: "Household", systemImage: "person.2.fill")

                if let household = viewModel.household {
                    HouseholdFact(title: "Owner", value: household.owner.email ?? household.owner.name ?? "You")

                    if let membership = household.membership {
                        HouseholdMemberRow(membership: membership)
                    } else if let invite = household.pendingInvite {
                        HouseholdInviteRow(
                            invite: invite,
                            onResend: { Task { await viewModel.resendInvite() } },
                            onRevoke: { Task { await viewModel.revokeInvite() } }
                        )
                    } else {
                        inviteForm
                    }
                }
            }
        }
        .overlay(alignment: .topTrailing) {
            if case .refreshing = viewModel.state {
                ProgressView()
                    .padding(FinTheme.Spacing.small)
            }
        }
    }

    private var inviteForm: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            Text("Invite one household member to access the dashboard.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            TextField("Name", text: $inviteName)
                .textContentType(.name)
                .textFieldStyle(.roundedBorder)

            TextField("Email", text: $inviteEmail)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)

            Button {
                Task { await viewModel.invite(name: inviteName, email: inviteEmail) }
            } label: {
                Label("Send invite", systemImage: "paperplane.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!viewModel.canInvite)
        }
    }

    private func errorCard(_ error: Error) -> some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                HouseholdSectionHeader(title: "Household", systemImage: "person.2.fill")
                Text(error.localizedDescription)
                    .font(.subheadline)
                    .foregroundStyle(FinTheme.ColorToken.destructive)
                Button {
                    Task { await viewModel.refresh() }
                } label: {
                    Label("Retry", systemImage: "arrow.clockwise")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
    }
}

private struct HouseholdSectionHeader: View {
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

private struct HouseholdFact: View {
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

private struct HouseholdMemberRow: View {
    let membership: HouseholdMembershipSummary

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
            HStack {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(FinTheme.ColorToken.positive)
                Text(membership.member.displayName)
                    .font(.subheadline.weight(.semibold))
                Spacer()
            }

            Text("Full dashboard access since \(DateFormatterProvider.fullDate(membership.createdAt)).")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct HouseholdInviteRow: View {
    let invite: HouseholdInviteSummary
    let onResend: () -> Void
    let onRevoke: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            VStack(alignment: .leading, spacing: 3) {
                Text(invite.inviteeName)
                    .font(.subheadline.weight(.semibold))
                Text(invite.inviteeEmail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Expires \(DateFormatterProvider.fullDate(invite.expiresAt))")
                    .font(.caption)
                    .foregroundStyle(FinTheme.ColorToken.warning)
            }

            HStack(spacing: FinTheme.Spacing.small) {
                Button(action: onResend) {
                    Label("Resend", systemImage: "arrow.clockwise")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button(role: .destructive, action: onRevoke) {
                    Label("Revoke", systemImage: "xmark.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}