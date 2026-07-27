import SwiftUI

/// Library / dashboard (M2): lists documents via `GET /documents/` (newest
/// first). Tapping a `ready` doc starts a quiz (`POST /quiz/sessions/`) and
/// presents ``QuizSessionView`` as a `fullScreenCover`. No upload in M2.
struct DashboardView: View {
    let auth: AuthStore
    let api: APIClient

    @State private var documents: [Document] = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var creatingForId: String?
    @State private var presentedEngine: QuizEngine?
    @State private var presentedTitle: String = ""
    @State private var showQuiz = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    if loading {
                        Text("Loading your documents…")
                            .font(ACXFont.mono(13)).foregroundStyle(ACXColor.muted).padding(.top, 24)
                    } else if documents.isEmpty {
                        emptyState
                    } else {
                        docList
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(ACXFont.mono(12)).foregroundStyle(ACXColor.error).padding(.top, 16)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .scrollContentBackground(.hidden)
            .background(GroundBackground())
            .toolbarBackground(ACXColor.ground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .navigationTitle("Library")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await load() } } label: { Image(systemName: "arrow.clockwise") }
                        .tint(ACXColor.ink).accessibilityLabel("Refresh")
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button { Task { await auth.signOut() } } label: { Image(systemName: "rectangle.portrait.and.arrow.right") }
                        .tint(ACXColor.ink).accessibilityLabel("Sign out")
                }
            }
        }
        .task { await load() }
        .fullScreenCover(isPresented: $showQuiz) {
            if let engine = presentedEngine {
                QuizSessionView(engine: engine, api: api,
                                documentTitle: presentedTitle,
                                onClose: { showQuiz = false })
            }
        }
        .onChange(of: showQuiz) { _, presented in if !presented { presentedEngine = nil } }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker("01 / LIBRARY")
            Hairline()
            Text("Your documents")
                .font(ACXFont.display(28)).foregroundStyle(ACXColor.ink).padding(.top, 6)
            Text("Tap a ready document to start an adaptive quiz.")
                .font(ACXFont.body(14)).foregroundStyle(ACXColor.muted)
        }
        .padding(.top, 16).padding(.bottom, 24)
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("No documents yet.").font(ACXFont.body(15)).foregroundStyle(ACXColor.ink)
            Text("Upload a PDF or PPTX on the web app, then pull to refresh.")
                .font(ACXFont.mono(12)).foregroundStyle(ACXColor.muted)
        }
        .padding(.top, 24)
    }

    private var docList: some View {
        VStack(spacing: 14) {
            ForEach(documents) { doc in docRow(doc) }
        }
    }

    @ViewBuilder
    private func docRow(_ doc: Document) -> some View {
        let isReady = doc.status == "ready"
        let isStarting = creatingForId == doc.id
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                if isReady {
                    Rectangle().fill(ACXColor.accent).frame(width: 2).accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(doc.displayTitle)
                        .font(ACXFont.body(16)).foregroundStyle(ACXColor.ink).lineLimit(2)
                    HStack(spacing: 10) {
                        StatusPill(documentStatus: doc.status)
                        Text(doc.file_type.uppercased())
                            .font(ACXFont.mono(11)).foregroundStyle(ACXColor.muted)
                    }
                }
                Spacer()
            }

            if isReady {
                Button { Task { await startQuiz(doc) } } label: {
                    Text(isStarting ? "STARTING…" : "START QUIZ")
                }
                .buttonStyle(GhostButtonStyle())
                .disabled(isStarting)
            } else if doc.status == "processing" || doc.status == "pending" {
                Text("Still processing — refresh in a moment.")
                    .font(ACXFont.mono(11)).foregroundStyle(ACXColor.muted)
            } else if doc.status == "failed" {
                Text("Processing failed. Re-upload on the web.")
                    .font(ACXFont.mono(11)).foregroundStyle(ACXColor.error)
            }
        }
        .padding(16)
        .background(ACXColor.ground)
        .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(doc.displayTitle), \(doc.status)")
    }

    // MARK: - Data

    private func load() async {
        loading = documents.isEmpty
        errorMessage = nil
        do {
            let resp: DocumentListResponse = try await api.get("/documents/")
            documents = resp.documents
        } catch let err as APIError {
            errorMessage = err.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }

    private func startQuiz(_ doc: Document) async {
        creatingForId = doc.id
        errorMessage = nil
        do {
            let resp: SessionCreateResponse = try await api.post(
                "/quiz/sessions/", body: SessionCreateRequest.standard(documentId: doc.id))
            presentedTitle = doc.displayTitle
            presentedEngine = QuizEngine(api: api, created: resp)
            showQuiz = true
        } catch let err as APIError {
            errorMessage = err.errorDescription ?? "Couldn't start the quiz."
        } catch {
            errorMessage = error.localizedDescription
        }
        creatingForId = nil
    }
}