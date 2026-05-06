import SwiftUI

struct RulesView: View {
    @StateObject private var viewModel = RulesViewModel()
    @State private var editorMode: RuleEditorMode?
    @State private var historicalRule: TransactionRule?
    @State private var isSettingsPresented = false

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading rules...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Rules")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        editorMode = .create
                    } label: {
                        Label("New rule", systemImage: "plus.circle")
                    }
                    Button {
                        isSettingsPresented = true
                    } label: {
                        Label("Settings", systemImage: "gearshape")
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
        .sheet(item: $editorMode) { mode in
            RuleEditorSheet(
                mode: mode,
                categories: viewModel.categories,
                onSave: { draft in
                    try await viewModel.save(rule: mode.rule, draft: draft)
                    editorMode = nil
                },
                onPreview: { draft in
                    try await viewModel.previewDraft(rule: mode.rule, draft: draft)
                },
                onDelete: {
                    if let rule = mode.rule {
                        try await viewModel.delete(rule)
                    }
                    editorMode = nil
                }
            )
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
        .sheet(item: $historicalRule) { rule in
            HistoricalRuleApplySheet(
                rule: rule,
                onApply: {
                    await viewModel.applyHistorical(rule)
                    historicalRule = nil
                }
            )
        }
        .sheet(isPresented: $isSettingsPresented) {
            RuleSettingsSheet(
                preference: viewModel.settings?.ruleExecutionPreference,
                onPreferenceChange: { preference in
                    await viewModel.updatePreference(preference)
                    isSettingsPresented = false
                }
            )
        }
        .task {
            await viewModel.load()
        }
    }

    private var actionMessageBinding: Binding<RuleActionMessage?> {
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
                RulesSummaryCard(
                    totalCount: viewModel.rules.count,
                    activeCount: viewModel.activeCount,
                    preference: viewModel.settings?.ruleExecutionPreference,
                    onPreferenceChange: { preference in
                        Task { await viewModel.updatePreference(preference) }
                    }
                )

                if viewModel.rules.isEmpty {
                    emptyRules
                } else {
                    LazyVStack(spacing: FinTheme.Spacing.small) {
                        ForEach(Array(viewModel.rules.enumerated()), id: \.element.id) { index, rule in
                            RuleRow(
                                rule: rule,
                                onEdit: { editorMode = .edit(rule) },
                                onToggle: { Task { await viewModel.toggleActive(rule) } },
                                onPreview: { Task { await viewModel.preview(rule) } },
                                onApplyHistorical: { historicalRule = rule },
                                canMoveUp: index > 0,
                                canMoveDown: index < viewModel.rules.count - 1,
                                onMoveUp: { Task { await viewModel.move(rule, direction: .up) } },
                                onMoveDown: { Task { await viewModel.move(rule, direction: .down) } }
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

    private var emptyRules: some View {
        VStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "wand.and.stars")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No rules yet")
                .font(.headline)
            Button {
                editorMode = .create
            } label: {
                Label("New rule", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FinTheme.Spacing.xxLarge)
    }
}

private struct RulesSummaryCard: View {
    let totalCount: Int
    let activeCount: Int
    let preference: RuleExecutionPreference?
    let onPreferenceChange: (RuleExecutionPreference) -> Void

    var body: some View {
        FinCard {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                HStack {
                    RuleMetric(title: "Rules", value: "\(totalCount)", systemImage: "wand.and.stars")
                    RuleMetric(title: "Active", value: "\(activeCount)", systemImage: "checkmark.circle.fill")
                    RuleMetric(title: "Inactive", value: "\(max(0, totalCount - activeCount))", systemImage: "pause.circle.fill")
                }

                Picker("Historical behavior", selection: Binding(
                    get: { preference ?? .alwaysAsk },
                    set: { onPreferenceChange($0) }
                )) {
                    ForEach(RuleExecutionPreference.allCases) { preference in
                        Text(preference.title).tag(preference)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
    }
}

private struct RuleMetric: View {
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

private struct RuleRow: View {
    let rule: TransactionRule
    let onEdit: () -> Void
    let onToggle: () -> Void
    let onPreview: () -> Void
    let onApplyHistorical: () -> Void
    let canMoveUp: Bool
    let canMoveDown: Bool
    let onMoveUp: () -> Void
    let onMoveDown: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(rule.name)
                        .font(.subheadline.weight(.semibold))
                    Text("Priority \(rule.priority)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(rule.isActive ? "Active" : "Paused")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(rule.isActive ? FinTheme.ColorToken.positive : FinTheme.ColorToken.warning)

                Menu {
                    Button(action: onEdit) {
                        Label("Edit", systemImage: "pencil")
                    }
                    Button(action: onPreview) {
                        Label("Preview matches", systemImage: "number.circle")
                    }
                    Button(action: onApplyHistorical) {
                        Label("Apply historical", systemImage: "clock.arrow.circlepath")
                    }
                    Divider()
                    Button(action: onMoveUp) {
                        Label("Move up", systemImage: "arrow.up")
                    }
                    .disabled(!canMoveUp)
                    Button(action: onMoveDown) {
                        Label("Move down", systemImage: "arrow.down")
                    }
                    .disabled(!canMoveDown)
                    Divider()
                    Button(action: onToggle) {
                        Label(rule.isActive ? "Disable" : "Enable", systemImage: rule.isActive ? "pause.circle" : "play.circle")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }

            VStack(alignment: .leading, spacing: FinTheme.Spacing.xSmall) {
                ForEach(rule.conditions) { condition in
                    Label("\(condition.field.title) \(condition.operatorValue.title.lowercased()) \(condition.displayValue)", systemImage: "line.3.horizontal.decrease.circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                ForEach(rule.actions) { action in
                    Label("\(action.type.title): \(action.displayValue)", systemImage: "arrow.turn.down.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
        .opacity(rule.isActive ? 1 : 0.62)
    }
}

private struct RuleSettingsSheet: View {
    let preference: RuleExecutionPreference?
    let onPreferenceChange: (RuleExecutionPreference) async -> Void

    @State private var selectedPreference: RuleExecutionPreference
    @State private var isWorking = false

    init(
        preference: RuleExecutionPreference?,
        onPreferenceChange: @escaping (RuleExecutionPreference) async -> Void
    ) {
        self.preference = preference
        self.onPreferenceChange = onPreferenceChange
        _selectedPreference = State(initialValue: preference ?? .alwaysAsk)
    }

    var body: some View {
        FinGlassSheet(title: "Rule settings") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                Picker("Historical behavior", selection: $selectedPreference) {
                    ForEach(RuleExecutionPreference.allCases) { preference in
                        Text(preference.title).tag(preference)
                    }
                }
                .pickerStyle(.inline)

                Text(settingDescription)
                    .font(.body)
                    .foregroundStyle(.secondary)

                Button {
                    Task { await save() }
                } label: {
                    if isWorking {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label("Save settings", systemImage: "checkmark")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isWorking)
            }
        }
    }

    private var settingDescription: String {
        switch selectedPreference {
        case .alwaysAsk:
            return "Ask before applying a rule to existing matching transactions."
        case .applyHistorical:
            return "Apply saved rules to existing matching transactions when possible."
        case .futureOnly:
            return "Use new rules only for future transaction syncs and edits."
        }
    }

    private func save() async {
        isWorking = true
        defer { isWorking = false }
        await onPreferenceChange(selectedPreference)
    }
}

private struct HistoricalRuleApplySheet: View {
    let rule: TransactionRule
    let onApply: () async -> Void

    @State private var isWorking = false

    var body: some View {
        FinGlassSheet(title: "Apply historical") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                Text(rule.name)
                    .font(.headline)
                Text("Run this rule against matching existing transactions. Future transactions continue to use the rule automatically.")
                    .font(.body)
                    .foregroundStyle(.secondary)

                Button {
                    Task { await apply() }
                } label: {
                    if isWorking {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label("Apply to history", systemImage: "clock.arrow.circlepath")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isWorking)
            }
        }
    }

    private func apply() async {
        isWorking = true
        defer { isWorking = false }
        await onApply()
    }
}

private enum RuleEditorMode: Identifiable {
    case create
    case edit(TransactionRule)

    var id: String {
        switch self {
        case .create:
            return "create-rule"
        case .edit(let rule):
            return rule.id
        }
    }

    var rule: TransactionRule? {
        if case .edit(let rule) = self { return rule }
        return nil
    }
}

private struct RuleEditorSheet: View {
    let mode: RuleEditorMode
    let categories: [CategoryItem]
    let onSave: (EditableRuleDraft) async throws -> Void
    let onPreview: (EditableRuleDraft) async throws -> RuleDraftPreview
    let onDelete: () async throws -> Void

    @State private var draft: EditableRuleDraft
    @State private var isDeleteConfirmationPresented = false
    @State private var isWorking = false
    @State private var isPreviewing = false
    @State private var preview: RuleDraftPreview?
    @State private var errorMessage: String?

    init(
        mode: RuleEditorMode,
        categories: [CategoryItem],
        onSave: @escaping (EditableRuleDraft) async throws -> Void,
        onPreview: @escaping (EditableRuleDraft) async throws -> RuleDraftPreview,
        onDelete: @escaping () async throws -> Void
    ) {
        self.mode = mode
        self.categories = categories
        self.onSave = onSave
        self.onPreview = onPreview
        self.onDelete = onDelete
        _draft = State(initialValue: EditableRuleDraft(rule: mode.rule))
    }

    var body: some View {
        FinGlassSheet(title: mode.rule == nil ? "New rule" : "Edit rule") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                TextField("Rule name", text: $draft.name)
                    .textFieldStyle(.roundedBorder)

                ruleSection("When") {
                    ForEach($draft.conditions) { $condition in
                        RuleConditionEditorRow(
                            condition: $condition,
                            categories: categories,
                            canDelete: draft.conditions.count > 1,
                            onDelete: { removeCondition(condition.id) }
                        )
                    }

                    Button {
                        draft.conditions.append(EditableRuleConditionDraft())
                    } label: {
                        Label("Add condition", systemImage: "plus.circle")
                    }
                    .buttonStyle(.bordered)
                }

                ruleSection("Then") {
                    ForEach($draft.actions) { $action in
                        RuleActionEditorRow(
                            action: $action,
                            categories: categories,
                            canDelete: draft.actions.count > 1,
                            onDelete: { removeAction(action.id) }
                        )
                    }

                    Button {
                        draft.actions.append(EditableRuleActionDraft())
                    } label: {
                        Label("Add action", systemImage: "plus.circle")
                    }
                    .buttonStyle(.bordered)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.destructive)
                }

                if let preview {
                    RulePreviewPanel(preview: preview)
                }

                HStack(spacing: FinTheme.Spacing.medium) {
                    if mode.rule != nil {
                        Button(role: .destructive) {
                            isDeleteConfirmationPresented = true
                        } label: {
                            Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }

                    Button {
                        Task { await performPreview() }
                    } label: {
                        if isPreviewing {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label("Preview", systemImage: "eye").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(isWorking || isPreviewing)

                    Button {
                        Task { await performSave() }
                    } label: {
                        if isWorking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label("Save", systemImage: "checkmark").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWorking || isPreviewing)
                }
            }
        }
        .sheet(isPresented: $isDeleteConfirmationPresented) {
            FinGlassSheet(title: "Delete rule") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text(mode.rule?.name ?? "Rule")
                        .font(.headline)
                    Text("This removes the automation rule. Transactions already edited by the rule stay as they are.")
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
                            Task { await performDelete() }
                        } label: {
                            if isWorking {
                                ProgressView().frame(maxWidth: .infinity)
                            } else {
                                Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isWorking)
                    }
                }
            }
        }
    }

    private func removeCondition(_ id: String) {
        guard draft.conditions.count > 1 else { return }
        draft.conditions.removeAll { $0.id == id }
    }

    private func removeAction(_ id: String) {
        guard draft.actions.count > 1 else { return }
        draft.actions.removeAll { $0.id == id }
    }

    private func performSave() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onSave(draft)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func performPreview() async {
        isPreviewing = true
        errorMessage = nil
        defer { isPreviewing = false }

        do {
            preview = try await onPreview(draft)
        } catch {
            preview = nil
            errorMessage = error.localizedDescription
        }
    }

    private func performDelete() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onDelete()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct RulePreviewPanel: View {
    let preview: RuleDraftPreview

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            Label("\(preview.totalCount) matching transactions", systemImage: "eye.fill")
                .font(.subheadline.weight(.semibold))

            if preview.preview.isEmpty {
                Text("No sample transactions are available for this draft.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: FinTheme.Spacing.small) {
                    ForEach(preview.preview) { transaction in
                        HStack(spacing: FinTheme.Spacing.medium) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(transaction.displayTitle)
                                    .font(.caption.weight(.semibold))
                                    .lineLimit(1)
                                Text(transaction.displaySubtitle)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            Text(CurrencyFormatter.format(transaction.type == .expense ? -abs(transaction.amount) : abs(transaction.amount)))
                                .font(.caption.weight(.semibold))
                        }
                        .padding(FinTheme.Spacing.small)
                        .background(FinTheme.ColorToken.elevatedSurface)
                        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
                    }
                }
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct RuleConditionEditorRow: View {
    @Binding var condition: EditableRuleConditionDraft
    let categories: [CategoryItem]
    let canDelete: Bool
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack {
                Label("Condition", systemImage: "line.3.horizontal.decrease.circle")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                if canDelete {
                    Button(role: .destructive, action: onDelete) {
                        Image(systemName: "minus.circle")
                    }
                    .buttonStyle(.plain)
                }
            }

            Picker("Field", selection: $condition.field) {
                ForEach(RuleField.allCases) { field in
                    Text(field.title).tag(field)
                }
            }
            .onChange(of: condition.field) { newField in
                if newField.usesNumber {
                    condition.operatorValue = .greaterThan
                } else if newField.usesDate {
                    condition.operatorValue = .on
                } else {
                    condition.operatorValue = .contains
                }
            }

            Picker("Operator", selection: $condition.operatorValue) {
                ForEach(condition.conditionOperators) { operatorValue in
                    Text(operatorValue.title).tag(operatorValue)
                }
            }

            if condition.operatorValue.needsValue {
                conditionValueInput
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
    }

    @ViewBuilder
    private var conditionValueInput: some View {
        if condition.field.usesNumber {
            TextField("Amount", text: $condition.conditionNumber)
                .keyboardType(.decimalPad)
                .textFieldStyle(.roundedBorder)
            if condition.operatorValue == .between {
                TextField("Second amount", text: $condition.secondConditionNumber)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
            }
        } else if condition.field.usesDate {
            DatePicker("Date", selection: $condition.conditionDate, displayedComponents: .date)
            if condition.operatorValue == .between {
                DatePicker("Second date", selection: $condition.secondConditionDate, displayedComponents: .date)
            }
        } else if condition.field == .category {
            Menu {
                ForEach(categories.filter { !$0.isHidden }) { category in
                    Button(category.name) {
                        condition.conditionText = category.name
                    }
                }
            } label: {
                menuLabel(title: condition.conditionText.isEmpty ? "Choose category" : condition.conditionText, systemImage: "folder")
            }
        } else {
            TextField("Value", text: $condition.conditionText)
                .textFieldStyle(.roundedBorder)
        }
    }
}

private struct RuleActionEditorRow: View {
    @Binding var action: EditableRuleActionDraft
    let categories: [CategoryItem]
    let canDelete: Bool
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack {
                Label("Action", systemImage: "arrow.turn.down.right")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                if canDelete {
                    Button(role: .destructive, action: onDelete) {
                        Image(systemName: "minus.circle")
                    }
                    .buttonStyle(.plain)
                }
            }

            Picker("Action", selection: $action.actionType) {
                ForEach(RuleActionType.allCases) { actionType in
                    Text(actionType.title).tag(actionType)
                }
            }

            switch action.actionType {
            case .setCategory:
                Menu {
                    ForEach(categories.filter { !$0.isHidden }) { category in
                        Button(category.name) {
                            action.actionText = category.name
                        }
                    }
                } label: {
                    menuLabel(title: action.actionText.isEmpty ? "Choose category" : action.actionText, systemImage: "folder")
                }
            case .setDescription:
                TextField("Description", text: $action.actionText)
                    .textFieldStyle(.roundedBorder)
            case .setType:
                Picker("Type", selection: $action.transactionType) {
                    ForEach(TransactionKind.allCases) { kind in
                        Text(kind.title).tag(kind)
                    }
                }
                .pickerStyle(.segmented)
            case .addHashtag:
                TextField("Hashtag", text: $action.actionText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
    }
}

private func ruleSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
        Text(title)
            .font(.headline)
        content()
    }
    .padding(FinTheme.Spacing.medium)
    .background(FinTheme.ColorToken.surface)
    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
}

private func menuLabel(title: String, systemImage: String) -> some View {
    HStack {
        Label(title, systemImage: systemImage)
        Spacer()
        Image(systemName: "chevron.up.chevron.down")
            .font(.caption)
            .foregroundStyle(.secondary)
    }
    .padding(FinTheme.Spacing.medium)
    .background(FinTheme.ColorToken.elevatedSurface)
    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
}

#Preview {
    NavigationStack {
        RulesView()
    }
}