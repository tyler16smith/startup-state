import SwiftUI

struct CategoriesView: View {
    @StateObject private var viewModel = CategoriesViewModel()
    @State private var editorMode: CategoryEditorMode?

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading categories...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Categories")
        .searchable(text: $viewModel.searchText, prompt: "Search categories")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        editorMode = .create
                    } label: {
                        Label("New category", systemImage: "plus.circle")
                    }
                    Button {
                        viewModel.showHidden.toggle()
                    } label: {
                        Label(viewModel.showHidden ? "Hide hidden" : "Show hidden", systemImage: viewModel.showHidden ? "eye.slash" : "eye")
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
            CategoryEditorSheet(
                mode: mode,
                onSave: { name in
                    try await viewModel.save(category: mode.category, name: name)
                    editorMode = nil
                },
                onDelete: {
                    if let category = mode.category {
                        try await viewModel.delete(category)
                    }
                    editorMode = nil
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
        .task {
            await viewModel.load()
        }
    }

    private var actionMessageBinding: Binding<CategoryActionMessage?> {
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
                CategoriesSummaryCard(
                    totalCount: viewModel.categories.count,
                    customCount: viewModel.customCount,
                    hiddenCount: viewModel.hiddenCount
                )

                if viewModel.hasSearch {
                    CategorySearchResultsSection(
                        categories: viewModel.filteredCategories,
                        onEdit: { editorMode = .edit($0) },
                        onToggleHidden: { category in Task { await viewModel.toggleHidden(category) } }
                    )
                } else if viewModel.categories.isEmpty {
                    emptyCategories
                } else {
                    CustomCategoriesSection(
                        categories: viewModel.visibleCustomCategories,
                        onCreate: { editorMode = .create },
                        onEdit: { editorMode = .edit($0) },
                        onToggleHidden: { category in Task { await viewModel.toggleHidden(category) } }
                    )

                    if viewModel.showHidden {
                        HiddenCategoriesSection(
                            categories: viewModel.hiddenCategories,
                            onToggleHidden: { category in Task { await viewModel.toggleHidden(category) } }
                        )
                    }

                    DefaultCategoryGroupsSection(groups: viewModel.defaultGroups)
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

    private var emptyCategories: some View {
        VStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: "tag")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No categories found")
                .font(.headline)
            Button {
                editorMode = .create
            } label: {
                Label("New category", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, FinTheme.Spacing.xxLarge)
    }
}

private struct CategorySectionHeader: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(alignment: .top, spacing: FinTheme.Spacing.small) {
            Image(systemName: systemImage)
                .foregroundStyle(FinTheme.ColorToken.accent)
                .frame(width: 24, height: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

private struct CategorySearchResultsSection: View {
    let categories: [CategoryItem]
    let onEdit: (CategoryItem) -> Void
    let onToggleHidden: (CategoryItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            CategorySectionHeader(
                title: "Search results",
                subtitle: "Matching categories across custom, default, and hidden lists",
                systemImage: "magnifyingglass"
            )

            if categories.isEmpty {
                Text("No categories found")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(FinTheme.Spacing.medium)
                    .background(FinTheme.ColorToken.surface)
                    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
            } else {
                LazyVStack(spacing: FinTheme.Spacing.small) {
                    ForEach(categories) { category in
                        CategoryRow(
                            category: category,
                            onEdit: { onEdit(category) },
                            onToggleHidden: { onToggleHidden(category) }
                        )
                    }
                }
            }
        }
    }
}

private struct CustomCategoriesSection: View {
    let categories: [CategoryItem]
    let onCreate: () -> Void
    let onEdit: (CategoryItem) -> Void
    let onToggleHidden: (CategoryItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack(alignment: .top) {
                CategorySectionHeader(
                    title: "Your Categories",
                    subtitle: "Custom categories you created",
                    systemImage: "person.crop.circle.fill"
                )
                Button(action: onCreate) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                }
                .buttonStyle(.plain)
            }

            if categories.isEmpty {
                Text("No custom categories yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(FinTheme.Spacing.medium)
                    .background(FinTheme.ColorToken.surface)
                    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
            } else {
                LazyVStack(spacing: FinTheme.Spacing.small) {
                    ForEach(categories) { category in
                        CategoryRow(
                            category: category,
                            onEdit: { onEdit(category) },
                            onToggleHidden: { onToggleHidden(category) }
                        )
                    }
                }
            }
        }
    }
}

private struct HiddenCategoriesSection: View {
    let categories: [CategoryItem]
    let onToggleHidden: (CategoryItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            CategorySectionHeader(
                title: "Hidden Categories",
                subtitle: "Excluded from transaction lists and calculations where the backend supports it",
                systemImage: "eye.slash.fill"
            )

            if categories.isEmpty {
                Text("No hidden categories.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(FinTheme.Spacing.medium)
                    .background(FinTheme.ColorToken.surface)
                    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: FinTheme.Spacing.small)], alignment: .leading, spacing: FinTheme.Spacing.small) {
                    ForEach(categories) { category in
                        HiddenCategoryChip(
                            category: category,
                            onToggleHidden: { onToggleHidden(category) }
                        )
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

private struct HiddenCategoryChip: View {
    let category: CategoryItem
    let onToggleHidden: () -> Void

    var body: some View {
        HStack(spacing: FinTheme.Spacing.xSmall) {
            Image(systemName: category.systemImage)
                .font(.caption)
            Text(category.name)
                .font(.caption.weight(.medium))
            if category.canToggleHidden {
                Button(action: onToggleHidden) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.caption)
                }
                .buttonStyle(.plain)
            }
        }
        .foregroundStyle(.secondary)
        .padding(.horizontal, FinTheme.Spacing.medium)
        .padding(.vertical, FinTheme.Spacing.small)
        .background(FinTheme.ColorToken.surface)
        .clipShape(Capsule())
    }
}

private struct DefaultCategoryGroupsSection: View {
    let groups: [CategoryGroup]

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            CategorySectionHeader(
                title: "Default Categories",
                subtitle: "Built-in groups for common transactions",
                systemImage: "rectangle.grid.2x2.fill"
            )

            LazyVStack(spacing: FinTheme.Spacing.medium) {
                ForEach(groups) { group in
                    DefaultCategoryGroupCard(group: group)
                }
            }
        }
    }
}

private struct DefaultCategoryGroupCard: View {
    let group: CategoryGroup

    var body: some View {
        VStack(alignment: .leading, spacing: FinTheme.Spacing.medium) {
            HStack(spacing: FinTheme.Spacing.small) {
                Image(systemName: group.systemImage)
                    .foregroundStyle(group.color)
                Text(group.title)
                    .font(.subheadline.weight(.semibold))
                Spacer()
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: FinTheme.Spacing.small) {
                ForEach(group.categories) { category in
                    HStack(spacing: FinTheme.Spacing.xSmall) {
                        Image(systemName: category.systemImage)
                            .font(.caption)
                            .foregroundStyle(group.color)
                            .frame(width: 18)
                        Text(category.name)
                            .font(.caption.weight(.medium))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Spacer(minLength: 0)
                        if category.isHidden {
                            Image(systemName: "eye.slash")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .opacity(category.isHidden ? 0.45 : 1)
                    .padding(.horizontal, FinTheme.Spacing.small)
                    .padding(.vertical, 7)
                    .background(FinTheme.ColorToken.elevatedSurface)
                    .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))
                }
            }
        }
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private struct CategoriesSummaryCard: View {
    let totalCount: Int
    let customCount: Int
    let hiddenCount: Int

    var body: some View {
        FinCard {
            HStack {
                CategoryMetric(title: "Total", value: "\(totalCount)", systemImage: "tag.fill")
                CategoryMetric(title: "Custom", value: "\(customCount)", systemImage: "person.crop.circle.fill")
                CategoryMetric(title: "Hidden", value: "\(hiddenCount)", systemImage: "eye.slash.fill")
            }
        }
    }
}

private struct CategoryMetric: View {
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

private struct CategoryRow: View {
    let category: CategoryItem
    let onEdit: () -> Void
    let onToggleHidden: () -> Void

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: category.isHidden ? "eye.slash.fill" : category.systemImage)
                .foregroundStyle(category.isHidden ? FinTheme.ColorToken.textSecondary : FinTheme.ColorToken.accent)
                .frame(width: 36, height: 36)
                .background(FinTheme.ColorToken.elevatedSurface)
                .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.small, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(category.name)
                    .font(.subheadline.weight(.semibold))
                Text(category.displayScope)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if category.isHidden {
                Text("Hidden")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(FinTheme.ColorToken.warning)
            }

            Menu {
                Button(action: onEdit) {
                    Label("Rename", systemImage: "pencil")
                }
                .disabled(!category.isUserOwned)

                Button(action: onToggleHidden) {
                    Label(category.isHidden ? "Show" : "Hide", systemImage: category.isHidden ? "eye" : "eye.slash")
                }
                .disabled(!category.canToggleHidden)
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .disabled(!category.isUserOwned && !category.canToggleHidden)
        }
        .opacity(category.isHidden ? 0.58 : 1)
        .padding(FinTheme.Spacing.medium)
        .background(FinTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: FinTheme.Radius.medium, style: .continuous))
    }
}

private enum CategoryEditorMode: Identifiable {
    case create
    case edit(CategoryItem)

    var id: String {
        switch self {
        case .create:
            return "create-category"
        case .edit(let category):
            return category.id
        }
    }

    var category: CategoryItem? {
        if case .edit(let category) = self { return category }
        return nil
    }
}

private struct CategoryEditorSheet: View {
    let mode: CategoryEditorMode
    let onSave: (String) async throws -> Void
    let onDelete: () async throws -> Void

    @State private var name: String
    @State private var isDeleteConfirmationPresented = false
    @State private var isWorking = false
    @State private var errorMessage: String?

    init(
        mode: CategoryEditorMode,
        onSave: @escaping (String) async throws -> Void,
        onDelete: @escaping () async throws -> Void
    ) {
        self.mode = mode
        self.onSave = onSave
        self.onDelete = onDelete
        _name = State(initialValue: mode.category?.name ?? "")
    }

    var body: some View {
        FinGlassSheet(title: mode.category == nil ? "New category" : "Edit category") {
            VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                TextField("Name", text: $name)
                    .textFieldStyle(.roundedBorder)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(FinTheme.ColorToken.destructive)
                }

                HStack(spacing: FinTheme.Spacing.medium) {
                    if mode.category != nil {
                        Button(role: .destructive) {
                            isDeleteConfirmationPresented = true
                        } label: {
                            Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }

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
                    .disabled(isWorking)
                }
            }
        }
        .sheet(isPresented: $isDeleteConfirmationPresented) {
            FinGlassSheet(title: "Delete category") {
                VStack(alignment: .leading, spacing: FinTheme.Spacing.large) {
                    Text(mode.category?.name ?? "Category")
                        .font(.headline)
                    Text("Transactions in this category will move to Uncategorized if the backend permits deletion.")
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

    private func performSave() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onSave(name)
        } catch {
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

#Preview {
    NavigationStack {
        CategoriesView()
    }
}