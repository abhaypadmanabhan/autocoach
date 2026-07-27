import SwiftUI
import Supabase
import UniformTypeIdentifiers

/// Files-path upload sheet (PRD §5.7). Camera scan is Phase 3 — not here.
///
/// Present as `.sheet`. Requires the authenticated ``SupabaseClient`` (same
/// instance as ``AuthStore``) so Storage uploads share the live JWT.
struct UploadSheet: View {
    let api: APIClient
    let supabase: SupabaseClient
    let onDocumentReady: (String) -> Void

    @State private var controller: DocumentUploadController
    @State private var showImporter = false
    @State private var confirmDelete: Document?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    init(
        api: APIClient,
        supabase: SupabaseClient,
        onDocumentReady: @escaping (String) -> Void
    ) {
        self.api = api
        self.supabase = supabase
        self.onDocumentReady = onDocumentReady
        _controller = State(initialValue: DocumentUploadController(api: api, supabase: supabase))
    }

    var body: some View {
        ZStack {
            GroundBackground()

            VStack(alignment: .leading, spacing: 0) {
                header
                Hairline()
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }

            if let doc = confirmDelete {
                ACXConfirmDialog(
                    title: "DELETE DOCUMENT",
                    message: "Remove “\(doc.displayTitle)” so you can upload a new one? This cannot be undone.",
                    confirmLabel: "DELETE",
                    onConfirm: {
                        let id = doc.id
                        confirmDelete = nil
                        Task { await controller.deleteDocument(id: id) }
                    },
                    onCancel: { confirmDelete = nil }
                )
            }
        }
        .fileImporter(
            isPresented: $showImporter,
            allowedContentTypes: DocumentUploadController.allowedContentTypes,
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                controller.start(with: url)
            case .failure:
                // User cancelled or system rejected — stay on picking.
                break
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            controller.noteScenePhase(newPhase)
        }
        .onChange(of: controller.phase) { _, newPhase in
            if newPhase == .ready, let id = controller.readyDocumentID {
                onDocumentReady(id)
            }
        }
        .onDisappear {
            // Leaving the sheet cancels in-flight work cleanly (no corrupt ready).
            if controller.phase != .ready {
                controller.cancelInFlight()
            }
        }
    }

    // MARK: - Sections

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 6) {
                Kicker("01 / UPLOAD")
                Text("Add a document")
                    .font(ACXFont.display(26))
                    .foregroundStyle(ACXColor.ink)
            }
            Spacer(minLength: 12)
            Button {
                dismiss()
            } label: {
                Text("CLOSE")
                    .font(ACXFont.monoBold(12))
                    .foregroundStyle(ACXColor.ink)
                    .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close upload")
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 14)
    }

    @ViewBuilder
    private var content: some View {
        switch controller.phase {
        case .picking:
            pickingBody
        case .uploading:
            progressBody(
                status: StatusPill("UPLOADING", state: .processing),
                caption: controller.pickedFilename ?? "Uploading…",
                progress: controller.uploadProgress,
                indeterminate: false
            )
        case .registering:
            progressBody(
                status: StatusPill("REGISTERING", state: .processing),
                caption: "Registering with AutoCoach…",
                progress: nil,
                indeterminate: true
            )
        case .processing:
            progressBody(
                status: StatusPill("PROCESSING", state: .processing),
                caption: "Reading your document. This takes about a minute.",
                progress: nil,
                indeterminate: true
            )
        case .ready:
            readyBody
        case .failed:
            failedBody
        }
    }

    private var pickingBody: some View {
        VStack(alignment: .leading, spacing: 20) {
            EmptyState(
                kicker: "FROM FILES",
                message: "Choose a PDF or PPTX from your device. AutoCoach will extract the concepts and make them quizzable.",
                showsCrosshair: true
            )

            Button("CHOOSE FILE") {
                showImporter = true
            }
            .buttonStyle(PrimaryButtonStyle())
            .accessibilityLabel("Choose a PDF or PPTX file")

            Text("PDF · PPTX · max 20 MB")
                .font(ACXFont.mono(12))
                .foregroundStyle(ACXColor.muted)
        }
        .padding(20)
    }

    private func progressBody(
        status: StatusPill,
        caption: String,
        progress: Double?,
        indeterminate: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            status
            Text(caption)
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.ink)
                .fixedSize(horizontal: false, vertical: true)

            if indeterminate {
                ProgressHairline()
            } else if let progress {
                ProgressHairline(value: progress)
                Text("\(Int((progress * 100).rounded()))%")
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.muted)
                    .monospacedDigit()
                    .accessibilityLabel("Upload progress \(Int((progress * 100).rounded())) percent")
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }

    private var readyBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            StatusPill("READY", state: .ready)
            Text(controller.pickedFilename ?? "Document ready")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.ink)

            Button("DONE") {
                dismiss()
            }
            .buttonStyle(PrimaryButtonStyle())
            .accessibilityLabel("Done")
        }
        .padding(20)
    }

    @ViewBuilder
    private var failedBody: some View {
        let failure = controller.failure ?? .generic
        VStack(alignment: .leading, spacing: 16) {
            StatusPill("FAILED", state: .failed)
            Kicker(failure.title)
            Text(failure.message)
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.ink)
                .fixedSize(horizontal: false, vertical: true)

            if case .oversized = failure, let bytes = controller.oversizedDisplayBytes {
                Text(Self.formatBytes(bytes))
                    .font(ACXFont.mono(14))
                    .foregroundStyle(ACXColor.ink)
                    .monospacedDigit()
                    .accessibilityLabel("File size \(Self.formatBytes(bytes))")
            }

            if case .documentQuota = failure {
                quotaList
            }

            Button("TRY AGAIN") {
                controller.retry()
            }
            .buttonStyle(PrimaryButtonStyle())
            .accessibilityLabel("Try again")

            Button("CLOSE") {
                dismiss()
            }
            .buttonStyle(GhostButtonStyle())
            .accessibilityLabel("Close")
        }
        .padding(20)
    }

    private var quotaList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Kicker("YOUR DOCUMENTS")
                .padding(.bottom, 10)
            Hairline()
            if controller.existingDocuments.isEmpty {
                Text("Loading…")
                    .font(ACXFont.mono(12))
                    .foregroundStyle(ACXColor.muted)
                    .padding(.vertical, 14)
            } else {
                ForEach(controller.existingDocuments) { doc in
                    HStack(alignment: .center, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(doc.displayTitle)
                                .font(ACXFont.body(15))
                                .foregroundStyle(ACXColor.ink)
                                .lineLimit(2)
                            Text(doc.file_type.uppercased())
                                .font(ACXFont.mono(12))
                                .foregroundStyle(ACXColor.muted)
                        }
                        Spacer(minLength: 8)
                        Button("DELETE") {
                            confirmDelete = doc
                        }
                        .font(ACXFont.monoBold(12))
                        .foregroundStyle(ACXColor.error)
                        .frame(minWidth: 44, minHeight: 44)
                        .disabled(controller.isDeleting)
                        .accessibilityLabel("Delete \(doc.displayTitle)")
                    }
                    .padding(.vertical, 12)
                    Hairline()
                }
            }
        }
        .padding(.vertical, 4)
    }

    private static func formatBytes(_ bytes: Int) -> String {
        let mb = Double(bytes) / (1024.0 * 1024.0)
        return String(format: "%.1f MB", mb)
    }
}

#Preview("UploadSheet") {
    // Preview shell — real wiring passes the live APIClient + SupabaseClient.
    Text("UploadSheet requires live APIClient + SupabaseClient")
        .font(ACXFont.mono(12))
        .padding(24)
        .background(GroundBackground())
}
