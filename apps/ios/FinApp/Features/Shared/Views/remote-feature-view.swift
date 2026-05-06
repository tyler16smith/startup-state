import SwiftUI

struct RemoteFeatureView: View {
    @StateObject private var viewModel: RemoteFeatureViewModel
    @State private var selectedRecord: RemoteFeatureRecord?

    init(config: RemoteFeatureConfig) {
        _viewModel = StateObject(wrappedValue: RemoteFeatureViewModel(config: config))
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingView("Loading \(viewModel.config.title.lowercased())...")
            case .loaded, .refreshing:
                content
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.load() }
                }
            }
        }
        .navigationTitle(viewModel.config.title)
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $viewModel.searchText, prompt: "Search")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        Task { await viewModel.refresh() }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }

                    if !viewModel.config.actions.isEmpty {
                        Divider()
                    }

                    ForEach(viewModel.config.actions) { action in
                        Button(role: action.isDestructive ? .destructive : nil) {
                            Task { await viewModel.perform(action) }
                        } label: {
                            Label(action.title, systemImage: action.systemImage)
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.title3)
                }
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .task {
            await viewModel.load()
        }
        .sheet(item: $selectedRecord) { record in
            recordDetailSheet(record)
        }
        .sheet(item: actionResultBinding) { result in
            actionResultSheet(result)
        }
    }

    private var actionResultBinding: Binding<RemoteFeatureActionResult?> {
        Binding(
            get: { viewModel.actionResult },
            set: { result in
                if result == nil {
                    viewModel.clearActionResult()
                }
            }
        )
    }

    private func actionResultSheet(_ result: RemoteFeatureActionResult) -> some View {
        FinGlassSheet(title: result.title) {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(FinTheme.ColorToken.positive)

                Text(result.message)
                    .font(.body)
                    .foregroundStyle(FinTheme.ColorToken.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Button {
                    viewModel.clearActionResult()
                } label: {
                    Text("Done")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.xLarge) {
                header

                if let metrics = viewModel.snapshot?.metrics, !metrics.isEmpty {
                    metricsGrid(metrics)
                }

                ForEach(viewModel.filteredSections) { section in
                    sectionView(section)
                }
            }
            .padding(FinTheme.Spacing.large)
            .padding(.bottom, 104)
        }
        .overlay(alignment: .top) {
            if case .refreshing = viewModel.state {
                ProgressView()
                    .padding(FinTheme.Spacing.medium)
                    .background(.regularMaterial, in: Capsule(style: .continuous))
                    .padding(.top, FinTheme.Spacing.small)
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: FinTheme.Spacing.medium) {
            Image(systemName: viewModel.config.systemImage)
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(FinTheme.ColorToken.accent)
                .frame(width: 52, height: 52)
                .background(FinTheme.ColorToken.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))

            VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                Text(viewModel.config.title)
                    .font(.title2)
                    .fontWeight(.bold)

                Text("\(viewModel.config.endpoints.count) server views")
                    .font(.subheadline)
                    .foregroundStyle(FinTheme.ColorToken.textSecondary)
            }

            Spacer()
        }
    }

    private func metricsGrid(_ metrics: [RemoteFeatureMetric]) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 144), spacing: FinTheme.Spacing.medium)], spacing: FinTheme.Spacing.medium) {
            ForEach(metrics) { metric in
                VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
                    Image(systemName: metric.systemImage)
                        .foregroundStyle(FinTheme.ColorToken.accent)

                    Text(metric.value)
                        .font(.headline)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)

                    Text(metric.label)
                        .font(.caption)
                        .foregroundStyle(FinTheme.ColorToken.textSecondary)
                        .lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(FinTheme.Spacing.medium)
                .background(FinTheme.ColorToken.surface, in: RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
            }
        }
    }

    private func sectionView(_ section: RemoteFeatureSection) -> some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack {
                Text(section.title)
                    .font(.headline)

                Spacer()

                Text("\(section.records.count)")
                    .font(.caption)
                    .foregroundStyle(FinTheme.ColorToken.textSecondary)
                    .padding(.horizontal, FinTheme.Spacing.small)
                    .padding(.vertical, FinTheme.Spacing.xSmall)
                    .background(FinTheme.ColorToken.elevatedSurface, in: Capsule(style: .continuous))
            }

            if section.records.isEmpty {
                Text(section.emptyMessage)
                    .font(.subheadline)
                    .foregroundStyle(FinTheme.ColorToken.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(FinTheme.Spacing.large)
                    .background(FinTheme.ColorToken.surface, in: RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
            } else {
                VStack(spacing: FinTheme.Spacing.small) {
                    ForEach(section.records) { record in
                        Button {
                            selectedRecord = record
                        } label: {
                            RemoteFeatureRecordRow(record: record)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func recordDetailSheet(_ record: RemoteFeatureRecord) -> some View {
        FinGlassSheet(title: record.title) {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
                if let subtitle = record.subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(FinTheme.ColorToken.textSecondary)
                }

                if let amount = record.amount {
                    Text(CurrencyFormatter.format(amount))
                        .font(.largeTitle)
                        .fontWeight(.bold)
                }

                VStack(spacing: FinTheme.Spacing.small) {
                    ForEach(record.details.indices, id: \.self) { index in
                        let detail = record.details[index]
                        HStack(alignment: .top) {
                            Text(detail.0)
                                .font(.subheadline)
                                .foregroundStyle(FinTheme.ColorToken.textSecondary)
                            Spacer(minLength: FinTheme.Spacing.large)
                            Text(detail.1)
                                .font(.subheadline)
                                .multilineTextAlignment(.trailing)
                        }
                        .padding(.vertical, FinTheme.Spacing.xSmall)
                    }
                }
                .padding(FinTheme.Spacing.large)
                .background(FinTheme.ColorToken.surface, in: RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
            }
        }
    }
}

private struct RemoteFeatureRecordRow: View {
    let record: RemoteFeatureRecord

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                Text(record.title)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundStyle(FinTheme.ColorToken.textPrimary)
                    .lineLimit(2)

                if let subtitle = record.subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(FinTheme.ColorToken.textSecondary)
                        .lineLimit(2)
                }

                if !record.badges.isEmpty {
                    HStack(spacing: FinTheme.Spacing.xSmall) {
                        ForEach(record.badges, id: \.self) { badge in
                            Text(badge)
                                .font(.caption2)
                                .fontWeight(.medium)
                                .padding(.horizontal, FinTheme.Spacing.small)
                                .padding(.vertical, 3)
                                .background(FinTheme.ColorToken.elevatedSurface, in: Capsule(style: .continuous))
                        }
                    }
                }
            }

            Spacer()

            if let amount = record.amount {
                Text(CurrencyFormatter.formatCompact(amount))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(FinTheme.ColorToken.textPrimary)
            }

            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(FinTheme.ColorToken.textSecondary)
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface, in: RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

#Preview {
    NavigationStack {
        RemoteFeatureView(config: AppDestination.transactions.remoteFeatureConfig)
    }
}
