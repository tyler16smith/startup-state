import SwiftUI

struct DashboardCustomizeSheet: View {
    @ObservedObject var viewModel: DashboardViewModel
    @SwiftUI.Environment(\.dismiss) private var dismiss
    @State private var isConfirmingReset = false

    var body: some View {
        NavigationStack {
            List {
                Section("Shown") {
                    if viewModel.visibleWidgets.isEmpty {
                        Text("Add a widget to build your dashboard.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(viewModel.visibleWidgets) { widget in
                            DashboardEditableWidgetRow(
                                widget: widget,
                                onRemove: {
                                    Task { await viewModel.removeWidget(widget) }
                                }
                            )
                            .disabled(viewModel.isMutatingLayout)
                        }
                        .onMove { source, destination in
                            var reorderedWidgets = viewModel.visibleWidgets
                            reorderedWidgets.move(fromOffsets: source, toOffset: destination)
                            Task { await viewModel.updateWidgetOrder(reorderedWidgets) }
                        }
                    }
                }

                ForEach(DashboardWidgetCategory.allCases) { category in
                    let widgets = DashboardWidgetDefinition.supportedLibrary.filter { $0.category == category }
                    if !widgets.isEmpty {
                        Section(category.title) {
                            ForEach(widgets) { definition in
                                DashboardWidgetLibraryRow(
                                    definition: definition,
                                    isAdded: definition.singleton && viewModel.layout.containsSingleton(type: definition.type),
                                    isMutating: viewModel.isMutatingLayout,
                                    onAdd: {
                                        Task { await viewModel.addWidget(type: definition.type) }
                                    }
                                )
                            }
                        }
                    }
                }

                Section {
                    Button(role: .destructive) {
                        isConfirmingReset = true
                    } label: {
                        Label("Reset to Defaults", systemImage: "arrow.counterclockwise")
                    }
                    .disabled(viewModel.isMutatingLayout)
                }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Customize")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Reset your dashboard to the default widget layout?",
                isPresented: $isConfirmingReset,
                titleVisibility: .visible
            ) {
                Button("Reset", role: .destructive) {
                    Task { await viewModel.resetLayout() }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }
}

private struct DashboardEditableWidgetRow: View {
    let widget: DashboardWidgetInstance
    let onRemove: () -> Void

    private var definition: DashboardWidgetDefinition {
        DashboardWidgetDefinition.definition(for: widget.widgetType)
    }

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: definition.systemImage)
                .foregroundStyle(definition.isSupported ? FinTheme.ColorToken.accent : .secondary)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 3) {
                Text(definition.title)
                    .font(.subheadline.weight(.semibold))
                Text(definition.isSupported ? definition.description : "Not available on iOS yet")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer()

            Button(role: .destructive, action: onRemove) {
                Image(systemName: "minus.circle.fill")
                    .foregroundStyle(.red)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
    }
}

private struct DashboardWidgetLibraryRow: View {
    let definition: DashboardWidgetDefinition
    let isAdded: Bool
    let isMutating: Bool
    let onAdd: () -> Void

    var body: some View {
        HStack(spacing: FinTheme.Spacing.medium) {
            Image(systemName: definition.systemImage)
                .foregroundStyle(FinTheme.ColorToken.accent)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 3) {
                Text(definition.title)
                    .font(.subheadline.weight(.semibold))
                Text(definition.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer()

            Button {
                onAdd()
            } label: {
                Image(systemName: isAdded ? "checkmark.circle.fill" : "plus.circle.fill")
                    .foregroundStyle(isAdded ? .secondary : FinTheme.ColorToken.accent)
            }
            .buttonStyle(.plain)
            .disabled(isAdded || isMutating)
        }
        .padding(.vertical, 4)
    }
}
