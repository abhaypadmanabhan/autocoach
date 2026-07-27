import SwiftUI

/// Library (PRD §5.6) — the document management surface.
///
/// Reworked from the M2 dashboard, where tapping a row started a quiz
/// immediately. That hid every concept and every session option, so a tap now
/// pushes ``DocumentDetailView`` and starting a session is a decision made there.
///
/// **No `NavigationStack` here on purpose.** `MainTabView` already wraps this
/// view in one and hangs the `+` upload item off it; nesting a second stack
/// renders two navigation bars and orphans that toolbar item.
struct DashboardView: View {
    let auth: AuthStore
    let api: APIClient

    @State private var model: LibraryModel
    @State private var pendingDelete: Document?

    /// Written by ``DocumentDetailView`` when `POST /quiz/sessions/` answers a
    /// daily-quota 429. `@AppStorage` observes the store, so Library picks the
    /// change up without the two screens holding a shared object.
    @AppStorage(LibraryDefaults.quotaExhaustedDay) private var quotaDay = ""
    @AppStorage(LibraryDefaults.quotaLimit) private var quotaLimit = 0

    init(auth: AuthStore, api: APIClient) {
        self.auth = auth
        self.api = api
        _model = State(initialValue: LibraryModel(api: api))
    }

    private var quotaExhaustedToday: Bool { quotaDay == LibraryDefaults.dayStamp() }

    var body: some View {
        List {
            section { header }

            if quotaExhaustedToday {
                section { QuotaNotice(limit: quotaLimit) }
            }

            if model.showsChecklist {
                section { ActivationChecklistView(checklist: model.checklist) }
            }

            switch model.phase {
            case .loading:
                section { loadingState }
            case .empty:
                section { emptyState }
            case .offline(let detail):
                section { offlineState(detail) }
            case .failed(let detail):
                section { failedState(detail) }
            case .loaded:
                documentRows
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
        .environment(\.defaultMinListRowHeight, 0)
        .refreshable { await model.load() }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(ACXColor.ground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        // Sign-out lives in Profile now (design PRD §5.12). The lane kept a copy
        // here as a safety net in case Profile slipped; it shipped, so this is gone
        // rather than left as a second, divergent exit.
        .navigationDestination(for: DocumentRoute.self) { route in
            DocumentDetailView(route: route, api: api)
        }
        .task {
            await model.load(initial: true)
        }
        .onDisappear { model.stopPolling() }
        .acxToast($model.toast)
        .overlay {
            if let doc = pendingDelete {
                ACXConfirmDialog(
                    title: "Delete document",
                    message: "This removes “\(doc.displayTitle)”, its concepts and every quiz session built from it. This cannot be undone.",
                    confirmLabel: model.isDeleting ? "Deleting…" : "DELETE",
                    onConfirm: {
                        pendingDelete = nil
                        Task { await model.delete(doc) }
                    },
                    onCancel: { pendingDelete = nil }
                )
            }
        }
    }

    // MARK: - List plumbing

    /// A full-bleed, chrome-free list row. `List` is required for
    /// `.swipeActions`; these modifiers strip the inset-grouped look it would
    /// otherwise impose on a zero-radius design.
    @ViewBuilder
    private func section<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 16, trailing: 20))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScreenTitle("Library")
            Hairline()
            Text("Your documents")
                .font(ACXFont.display(28))
                .foregroundStyle(ACXColor.ink)
                .padding(.top, 6)
            Text("Tap a document to see its concepts and start a focused session.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 8)
    }

    // MARK: - Five states

    private var loadingState: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 10) {
                    Rectangle().fill(ACXColor.surface).frame(height: 16).frame(maxWidth: 220)
                    Rectangle().fill(ACXColor.surface).frame(height: 10).frame(maxWidth: 120)
                    ProgressHairline()
                }
                .padding(.vertical, 8)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading your documents")
    }

    private var emptyState: some View {
        EmptyState(
            kicker: "No documents yet",
            message: "Add a PDF or PPTX with the + button above. AutoCoach reads it, pulls out the concepts, and builds quizzes from what it finds.",
            showsCrosshair: true
        )
        .padding(.top, 8)
    }

    private func offlineState(_ detail: String) -> some View {
        EmptyState(
            kicker: "Offline",
            message: "Your documents live on the server and this device can't reach it right now. \(detail)",
            actionLabel: "Try again",
            action: { Task { await model.load(initial: true) } }
        )
        .padding(.top, 8)
    }

    private func failedState(_ detail: String) -> some View {
        EmptyState(
            kicker: "COULDN'T load",
            message: detail,
            actionLabel: "Try again",
            action: { Task { await model.load(initial: true) } }
        )
        .padding(.top, 8)
    }

    // MARK: - Rows

    private var documentRows: some View {
        ForEach(model.documents) { doc in
            NavigationLink(value: DocumentRoute(documentID: doc.id, fallbackTitle: doc.displayTitle)) {
                documentRow(doc)
            }
            .listRowInsets(EdgeInsets(top: 14, leading: 20, bottom: 14, trailing: 12))
            .listRowBackground(Color.clear)
            .listRowSeparatorTint(ACXColor.surface)
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                Button(role: .destructive) {
                    pendingDelete = doc
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                .tint(ACXColor.error)
            }
        }
    }

    @ViewBuilder
    private func documentRow(_ doc: Document) -> some View {
        let mastery = model.masteryPercent(for: doc)
        let concepts = model.conceptCount(for: doc)

        VStack(alignment: .leading, spacing: 10) {
            Text(doc.displayTitle)
                .font(ACXFont.bodyMedium(16))
                .foregroundStyle(ACXColor.ink)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            HStack(spacing: 10) {
                StatusPill(documentStatus: doc.status)
                TagPill(doc.file_type.uppercased())
                if let concepts, concepts > 0 {
                    Text("\(concepts) CONCEPTS")
                        .font(ACXFont.mono(13))
                        .monospacedDigit()
                        .foregroundStyle(ACXColor.muted)
                }
                Spacer(minLength: 0)
            }

            if doc.status == "ready" {
                MasteryBar(percent: mastery ?? 0, label: "Mastery")
            } else if doc.status == "failed" {
                Text("Processing failed. Delete it and try uploading again.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.error)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Reading your document. This takes about a minute.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(minHeight: 44, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel(doc, mastery: mastery, concepts: concepts))
        .accessibilityHint("Opens concepts and session options")
    }

    private func rowAccessibilityLabel(_ doc: Document, mastery: Int?, concepts: Int?) -> String {
        var parts = [doc.displayTitle, doc.status]
        if let concepts, concepts > 0 { parts.append("\(concepts) concepts") }
        if doc.status == "ready" { parts.append("\(mastery ?? 0) percent mastery") }
        return parts.joined(separator: ", ")
    }
}
