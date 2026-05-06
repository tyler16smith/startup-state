import SwiftUI

struct ScenariosView: View {
    @StateObject private var viewModel = ScenariosViewModel()
    @State private var draft: EditableScenarioDraft?

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading scenarios...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Scenarios")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        draft = EditableScenarioDraft()
                    } label: {
                        Label("New scenario", systemImage: "plus.circle")
                    }
                    Button {
                        Task { await viewModel.seedDefaults() }
                    } label: {
                        Label("Seed defaults", systemImage: "sparkles")
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
        .refreshable { await viewModel.refresh() }
        .sheet(item: $draft) { draft in
            ScenarioEditorSheet(
                draft: draft,
                onSave: { updatedDraft in
                    try await viewModel.save(updatedDraft)
                    self.draft = nil
                },
                onDelete: {
                    if let scenario = viewModel.scenarios.first(where: { $0.id == draft.sourceId }) {
                        try await viewModel.delete(scenario)
                    }
                    self.draft = nil
                }
            )
        }
        .sheet(item: actionMessageBinding) { message in
            FinGlassSheet(title: message.title) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 44, weight: .semibold))
                        .foregroundStyle(FinTheme.ColorToken.positive)
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

    private var actionMessageBinding: Binding<ScenarioActionMessage?> {
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
                ScenariosSummaryCard(
                    count: viewModel.scenarios.count,
                    activeScenario: viewModel.activeScenario,
                    averageInvestmentReturn: viewModel.averageInvestmentReturn
                )

                if viewModel.scenarios.isEmpty {
                    emptyState
                } else {
                    LazyVStack(spacing: FinTheme.Spacing.medium) {
                        ForEach(viewModel.scenarios) { scenario in
                            ScenarioRow(
                                scenario: scenario,
                                onEdit: { draft = EditableScenarioDraft(scenario: scenario) },
                                onSetActive: { Task { await viewModel.setActive(scenario) } },
                                onClearActive: { Task { await viewModel.setActive(nil) } }
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
    }

    private var emptyState: some View {
        VStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No scenarios yet")
                .font(.headline)
            Button {
                Task { await viewModel.seedDefaults() }
            } label: {
                Label("Create defaults", systemImage: "sparkles")
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FinTheme.Spacing.xxLarge)
    }
}

private struct ScenariosSummaryCard: View {
    let count: Int
    let activeScenario: ForecastScenario?
    let averageInvestmentReturn: Double

    var body: some View {
        FinCard {
            HStack(alignment: .top, spacing: FinTheme.Spacing.medium) {
                ScenarioMetric(title: "Scenarios", value: "\(count)", systemImage: "square.stack.3d.up")
                ScenarioMetric(title: "Active", value: activeScenario?.name ?? "None", systemImage: "checkmark.seal.fill")
                ScenarioMetric(title: "Avg return", value: averageInvestmentReturn.scenarioPercentDisplay, systemImage: "percent")
            }
        }
    }
}

private struct ScenarioMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Image(systemName: systemImage)
                .foregroundStyle(FinTheme.ColorToken.accent)
            Text(value)
                .font(.headline)
                .lineLimit(2)
                .minimumScaleFactor(0.76)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ScenarioRow: View {
    let scenario: ForecastScenario
    let onEdit: () -> Void
    let onSetActive: () -> Void
    let onClearActive: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack(alignment: .top, spacing: FinTheme.Spacing.medium) {
                Image(systemName: scenario.isActive ? "checkmark.seal.fill" : "chart.line.uptrend.xyaxis")
                    .foregroundStyle(scenario.isActive ? FinTheme.ColorToken.positive : FinTheme.ColorToken.accent)
                    .frame(width: 36, height: 36)
                    .background(FinTheme.ColorToken.elevatedSurface)
                    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))

                VStack(alignment: .leading, spacing: 3) {
                    Text(scenario.name)
                        .font(.subheadline.weight(.semibold))
                    Text(scenario.type.displayName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Menu {
                    Button(action: onEdit) {
                        Label("Edit", systemImage: "pencil")
                    }
                    Button(action: scenario.isActive ? onClearActive : onSetActive) {
                        Label(scenario.isActive ? "Clear active" : "Set active", systemImage: scenario.isActive ? "xmark.circle" : "checkmark.circle")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }

            HStack(spacing: FinTheme.Spacing.small) {
                ScenarioPill(title: "Return", value: scenario.investmentReturn.scenarioPercentDisplay)
                ScenarioPill(title: "Inflation", value: scenario.inflationRate.scenarioPercentDisplay)
                ScenarioPill(title: "Salary", value: scenario.salaryGrowth.scenarioPercentDisplay)
            }
            HStack(spacing: FinTheme.Spacing.small) {
                ScenarioPill(title: "Contrib", value: scenario.contributionChange.scenarioPercentDisplay)
                ScenarioPill(title: "Expenses", value: scenario.expenseGrowth.scenarioPercentDisplay)
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct ScenarioPill: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.caption.weight(.semibold))
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
        .padding(.horizontal, 10)
        .background(FinTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
    }
}

private struct ScenarioEditorSheet: View {
    @State private var draft: EditableScenarioDraft
    let onSave: (EditableScenarioDraft) async throws -> Void
    let onDelete: () async throws -> Void
    @State private var isDeleteConfirmationPresented = false
    @State private var errorMessage: String?
    @State private var isSaving = false

    init(
        draft: EditableScenarioDraft,
        onSave: @escaping (EditableScenarioDraft) async throws -> Void,
        onDelete: @escaping () async throws -> Void
    ) {
        _draft = State(initialValue: draft)
        self.onSave = onSave
        self.onDelete = onDelete
    }

    var body: some View {
        FinGlassSheet(title: draft.sourceId == nil ? "New Scenario" : "Edit Scenario") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                TextField("Name", text: $draft.name)
                    .textFieldStyle(.roundedBorder)

                Picker("Type", selection: $draft.type) {
                    ForEach(ScenarioType.allCases) { type in
                        Text(type.displayName).tag(type)
                    }
                }
                .pickerStyle(.segmented)
                .disabled(draft.sourceId != nil)

                if draft.sourceId == nil {
                    ScenarioPresetPicker { preset in
                        draft.applyPreset(preset)
                    }
                }

                ScenarioPercentSlider(title: "Investment return", value: $draft.investmentReturn, range: -0.05...0.15)
                ScenarioPercentSlider(title: "Inflation", value: $draft.inflationRate, range: 0...0.12)
                ScenarioPercentSlider(title: "Salary growth", value: $draft.salaryGrowth, range: -0.05...0.12)
                ScenarioPercentSlider(title: "Contribution change", value: $draft.contributionChange, range: -0.1...0.15)
                ScenarioPercentSlider(title: "Expense growth", value: $draft.expenseGrowth, range: -0.05...0.12)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.destructive)
                }

                Button {
                    Task { await save() }
                } label: {
                    Text(isSaving ? "Saving..." : "Save scenario")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isSaving)

                if draft.sourceId != nil {
                    Button(role: .destructive) {
                        isDeleteConfirmationPresented = true
                    } label: {
                        Text("Delete scenario")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isSaving)
                }
            }
        }
        .sheet(isPresented: $isDeleteConfirmationPresented) {
            FinGlassSheet(title: "Delete scenario") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text(draft.name)
                        .font(.headline)
                    Text("This removes the saved assumptions. Charts using this scenario will fall back to their default assumptions.")
                        .font(.body)
                        .foregroundStyle(.secondary)

                    HStack(spacing: FinTheme.Spacing.medium) {
                        Button {
                            isDeleteConfirmationPresented = false
                        } label: {
                            Text("Cancel").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)

                        Button(role: .destructive) {
                            Task { await delete() }
                        } label: {
                            if isSaving {
                                ProgressView().frame(maxWidth: .infinity)
                            } else {
                                Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isSaving)
                    }
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        do {
            try await onSave(draft)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete() async {
        isSaving = true
        defer { isSaving = false }

        do {
            try await onDelete()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ScenarioPresetPicker: View {
    let onSelect: (ScenarioPreset) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
            Text("Presets")
                .font(.subheadline.weight(.semibold))
            HStack(spacing: FinTheme.Spacing.small) {
                ForEach(ScenarioPreset.allCases) { preset in
                    Button(preset.title) {
                        onSelect(preset)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
        }
    }
}

private struct ScenarioPercentSlider: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(value.scenarioPercentDisplay)
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            Slider(value: $value, in: range, step: 0.005)
        }
    }
}

// MARK: - What If View

struct WhatIfView: View {
    @StateObject private var viewModel = WhatIfViewModel()
    @State private var addItemSheetPresented = false
    @State private var resetConfirmationPresented = false
    @State private var refreshConfirmationPresented = false

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading what-if baseline...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("What If")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        addItemSheetPresented = true
                    } label: {
                        Label("Add hypothetical", systemImage: "plus.circle")
                    }
                    if !viewModel.adjustments.isEmpty {
                        Button(role: .destructive) {
                            resetConfirmationPresented = true
                        } label: {
                            Label("Reset adjustments", systemImage: "arrow.uturn.backward")
                        }
                    }
                    Button {
                        if viewModel.hasUnsavedChanges {
                            refreshConfirmationPresented = true
                        } else {
                            Task { await viewModel.refresh() }
                        }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                } label: {
                    Image(systemName: "slider.horizontal.3")
                }
            }
        }
        .refreshable { await viewModel.refresh() }
        .confirmationDialog("Reset what-if changes?", isPresented: $resetConfirmationPresented, titleVisibility: .visible) {
            Button("Reset adjustments", role: .destructive) {
                viewModel.resetAllAdjustments()
            }
        } message: {
            Text("This clears your unsaved monthly plan changes.")
        }
        .confirmationDialog("Refresh baseline?", isPresented: $refreshConfirmationPresented, titleVisibility: .visible) {
            Button("Discard changes and refresh", role: .destructive) {
                viewModel.resetAllAdjustments()
                Task { await viewModel.refresh() }
            }
        } message: {
            Text("Refreshing reloads the baseline and clears unsaved adjustments.")
        }
        .sheet(isPresented: $addItemSheetPresented) {
            WhatIfAddItemSheet { name, type, amount in
                viewModel.addCustomItem(name: name, type: type, monthlyAmount: amount)
                addItemSheetPresented = false
            }
        }
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var loadedContent: some View {
        if let baseline = viewModel.baseline {
            ScrollView {
                VStack(spacing: FinTheme.Spacing.large) {
                    if viewModel.hasUnsavedChanges {
                        UnsavedWhatIfBanner(onReset: { resetConfirmationPresented = true })
                    }

                    WhatIfTotalsCard(baseline: baseline, projection: viewModel.projection)

                    if !viewModel.customAdjustments.isEmpty {
                        WhatIfCustomItemsSection(
                            adjustments: viewModel.customAdjustments,
                            onRemove: { viewModel.removeAdjustment($0) }
                        )
                    }

                    if baseline.baselineItems.isEmpty {
                        WhatIfEmptyBaseline {
                            addItemSheetPresented = true
                        }
                    } else {
                        WhatIfBaselineSection(
                            groups: viewModel.monthlyPlanGroups,
                            adjustmentLookup: { viewModel.adjustment(for: $0) },
                            onAdjust: { item, amount in viewModel.adjustBaseline(item, monthlyAmount: amount) },
                            onClear: { viewModel.clearAdjustment(for: $0) }
                        )
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
        } else {
            LoadingView("Loading what-if baseline...")
        }
    }
}

private struct UnsavedWhatIfBanner: View {
    let onReset: () -> Void

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "pencil.and.list.clipboard")
                .foregroundStyle(FinTheme.ColorToken.warning)
            VStack(alignment: .leading, spacing: 2) {
                Text("Unsaved what-if plan")
                    .font(.subheadline.weight(.semibold))
                Text("Adjustments are local until you reset or leave this view.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button(action: onReset) {
                Image(systemName: "arrow.uturn.backward")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .accessibilityLabel("Reset what-if adjustments")
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.warning.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct WhatIfTotalsCard: View {
    let baseline: WhatIfBaseline
    let projection: WhatIfProjection

    private var delta: Double { projection.net - baseline.baselineNet }

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                    Text("Adjusted monthly net")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(CurrencyFormatter.format(projection.net))
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundStyle(projection.net >= 0 ? FinTheme.ColorToken.positive : FinTheme.ColorToken.destructive)

                    HStack(spacing: 6) {
                        Image(systemName: delta >= 0 ? "arrow.up.right" : "arrow.down.right")
                        Text("\(delta >= 0 ? "+" : "")\(CurrencyFormatter.formatCompact(delta)) vs baseline")
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(delta >= 0 ? FinTheme.ColorToken.positive : FinTheme.ColorToken.destructive)
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: FinTheme.Spacing.medium) {
                    WhatIfMetricTile(title: "Income", value: projection.income, baseline: baseline.baselineIncome, tint: FinTheme.ColorToken.positive, systemImage: "arrow.down.circle.fill")
                    WhatIfMetricTile(title: "Expenses", value: projection.expenses, baseline: baseline.baselineExpenses, tint: FinTheme.ColorToken.destructive, systemImage: "arrow.up.circle.fill")
                    WhatIfMetricTile(title: "Savings", value: projection.savings, baseline: baseline.baselineSavings, tint: FinTheme.ColorToken.accent, systemImage: "banknote.fill")
                    WhatIfMetricTile(title: "Debt", value: projection.debt, baseline: baseline.baselineDebt, tint: FinTheme.ColorToken.warning, systemImage: "creditcard.fill")
                }
            }
        }
    }
}

private struct WhatIfMetricTile: View {
    let title: String
    let value: Double
    let baseline: Double
    let tint: Color
    let systemImage: String

    private var delta: Double { value - baseline }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: systemImage)
                .foregroundStyle(tint)
            Text(CurrencyFormatter.formatCompact(value))
                .font(.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            if abs(delta) > 0.5 {
                Text("\(delta > 0 ? "+" : "")\(CurrencyFormatter.formatCompact(delta))")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(delta > 0 ? FinTheme.ColorToken.positive : FinTheme.ColorToken.destructive)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(FinTheme.Spacing.small)
        .background(FinTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
    }
}

private struct WhatIfBaselineSection: View {
    let groups: [WhatIfMonthlyPlanGroup]
    let adjustmentLookup: (WhatIfBaselineItem) -> WhatIfAdjustment?
    let onAdjust: (WhatIfBaselineItem, Double) -> Void
    let onClear: (WhatIfBaselineItem) -> Void

    var body: some View {
        VStack(spacing: FinTheme.Spacing.large) {
            ForEach(groups) { group in
                VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
                    WhatIfMonthlyPlanGroupHeader(group: group)
                    ForEach(group.items) { item in
                        WhatIfBaselineRow(
                            item: item,
                            adjustment: adjustmentLookup(item),
                            onAdjust: { onAdjust(item, $0) },
                            onClear: { onClear(item) }
                        )
                    }
                }
            }
        }
    }
}

private struct WhatIfMonthlyPlanGroupHeader: View {
    let group: WhatIfMonthlyPlanGroup

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: group.systemImage)
                .foregroundStyle(FinTheme.ColorToken.accent)
                .frame(width: 34, height: 34)
                .background(FinTheme.ColorToken.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(group.category)
                    .font(.headline)
                Text(group.type.displayName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(CurrencyFormatter.formatCompact(group.adjustedTotal))
                    .font(.subheadline.monospacedDigit().weight(.semibold))
                if abs(group.delta) > 0.5 {
                    Text("\(group.delta > 0 ? "+" : "")\(CurrencyFormatter.formatCompact(group.delta))")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(group.delta > 0 ? FinTheme.ColorToken.positive : FinTheme.ColorToken.destructive)
                }
            }
        }
        .padding(.horizontal, FinTheme.Spacing.xSmall)
    }
}

private struct WhatIfBaselineRow: View {
    let item: WhatIfBaselineItem
    let adjustment: WhatIfAdjustment?
    let onAdjust: (Double) -> Void
    let onClear: () -> Void

    @State private var amountText: String = ""
    @FocusState private var isFocused: Bool

    private var hasAdjustment: Bool { adjustment != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Text("Baseline \(CurrencyFormatter.formatCompact(item.monthlyAmount)) / mo")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let category = item.category, !category.isEmpty {
                        Label(category, systemImage: WhatIfCategoryIcon.systemImage(for: category))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if hasAdjustment {
                    Button(action: {
                        amountText = ""
                        onClear()
                    }) {
                        Image(systemName: "arrow.uturn.backward.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: FinTheme.Spacing.small) {
                Text("$")
                    .foregroundStyle(.secondary)
                TextField(CurrencyFormatter.formatCompact(item.monthlyAmount), text: $amountText)
                    .keyboardType(.decimalPad)
                    .focused($isFocused)
                    .onChange(of: amountText) { newValue in
                        if let value = Double(newValue.filter { "0123456789.".contains($0) }) {
                            onAdjust(value)
                        } else if newValue.isEmpty {
                            onClear()
                        }
                    }
                Text("/ mo")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(FinTheme.Spacing.small)
            .background(FinTheme.ColorToken.elevatedSurface)
            .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
        .onAppear {
            if let adjustment {
                amountText = String(format: "%.0f", adjustment.monthlyAmount)
            }
        }
    }
}

private struct WhatIfCustomItemsSection: View {
    let adjustments: [WhatIfAdjustment]
    let onRemove: (WhatIfAdjustment) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.small) {
            Text("Hypothetical")
                .font(.headline)
            ForEach(adjustments) { adjustment in
                HStack {
                    Image(systemName: adjustment.type.systemImage)
                        .foregroundStyle(FinTheme.ColorToken.accent)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(adjustment.name)
                            .font(.subheadline.weight(.semibold))
                        Text(adjustment.type.displayName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(CurrencyFormatter.formatCompact(adjustment.monthlyAmount))
                        .font(.subheadline.monospacedDigit().weight(.semibold))
                    Button(action: { onRemove(adjustment) }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(FinTheme.Spacing.medium)
                .background(FinTheme.ColorToken.surface)
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
            }
        }
    }
}

private struct WhatIfEmptyBaseline: View {
    let onAdd: () -> Void

    var body: some View {
        VStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "chart.bar.doc.horizontal")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No baseline yet")
                .font(.headline)
            Text("Add monthly budget goals or income to build a baseline. You can still test hypothetical changes below.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, FinTheme.Spacing.large)
            Button(action: onAdd) {
                Label("Add hypothetical", systemImage: "plus.circle")
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FinTheme.Spacing.xxLarge)
    }
}

private struct WhatIfAddItemSheet: View {
    let onAdd: (String, WhatIfItemType, Double) -> Void

    @State private var name: String = ""
    @State private var type: WhatIfItemType = .income
    @State private var amountText: String = ""
    @State private var errorMessage: String?

    var body: some View {
        FinGlassSheet(title: "Add hypothetical") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                TextField("Name (e.g. Side gig)", text: $name)
                    .textFieldStyle(.roundedBorder)

                Picker("Type", selection: $type) {
                    ForEach(WhatIfItemType.allCases) { type in
                        Text(type.displayName).tag(type)
                    }
                }
                .pickerStyle(.segmented)

                HStack {
                    Text("$")
                        .foregroundStyle(.secondary)
                    TextField("Monthly amount", text: $amountText)
                        .keyboardType(.decimalPad)
                    Text("/ mo")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(FinTheme.Spacing.small)
                .background(FinTheme.ColorToken.elevatedSurface)
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.destructive)
                }

                Button {
                    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
                    let amount = Double(amountText.filter { "0123456789.".contains($0) }) ?? 0
                    if trimmed.isEmpty {
                        errorMessage = "Add a name"
                    } else if amount <= 0 {
                        errorMessage = "Add a monthly amount"
                    } else {
                        onAdd(trimmed, type, amount)
                    }
                } label: {
                    Text("Add to scenario")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
        }
    }
}

#Preview {
    NavigationStack {
        WhatIfView()
    }
}
