import SwiftUI

/// Document detail (PRD §5.8) — the mastery surface, and the screen where
/// AutoCoach stops looking like a quiz app.
///
/// Renders `GET /documents/{id}` + `/concepts` + `/progress`, lets the user
/// focus up to three concepts, and starts the session itself. The Phase 3
/// session-config sheet is not built yet, so `onOpenSessionConfig` is exposed
/// for whoever mounts this screen; when it is `nil` the ghost button says so
/// honestly rather than pretending to be disabled.
struct DocumentDetailView: View {
    @State private var model: DocumentDetailModel
    @State private var presentedEngine: QuizEngine?
    @State private var showQuiz = false

    private let api: APIClient
    private let onOpenSessionConfig: ((SessionConfigRequest) -> Void)?

    init(
        route: DocumentRoute,
        api: APIClient,
        onOpenSessionConfig: ((SessionConfigRequest) -> Void)? = nil
    ) {
        self.api = api
        self.onOpenSessionConfig = onOpenSessionConfig
        _model = State(initialValue: DocumentDetailModel(
            documentID: route.documentID,
            fallbackTitle: route.fallbackTitle,
            api: api
        ))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header

                switch model.phase {
                case .loading:
                    loadingState
                case .processing:
                    processingState
                case .noConcepts:
                    noConceptsState
                case .offline(let detail):
                    offlineState(detail)
                case .failed(let detail):
                    failedState(detail)
                case .loaded:
                    if model.quotaExhausted {
                        QuotaNotice(limit: model.quotaLimit ?? 0)
                    }
                    masteryBlock
                    conceptTable
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
        .navigationTitle("Document")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(ACXColor.ground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .safeAreaInset(edge: .bottom) {
            if model.phase == .loaded { footer }
        }
        .task { await model.load(initial: true) }
        .onDisappear { model.stopPolling() }
        .acxToast($model.toast)
        .fullScreenCover(isPresented: $showQuiz) {
            if let engine = presentedEngine {
                QuizSessionView(
                    engine: engine,
                    api: api,
                    documentTitle: model.title,
                    onClose: { showQuiz = false }
                )
            }
        }
        .onChange(of: showQuiz) { _, presented in
            if !presented {
                presentedEngine = nil
                // Mastery moved while the user was answering; re-read it rather
                // than leaving a stale table behind the dismissed cover.
                Task { await model.reloadAfterSession() }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker("DOCUMENT")
            Hairline()
            Text(model.title)
                .font(ACXFont.display(26))
                .foregroundStyle(ACXColor.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)

            if let doc = model.document {
                HStack(spacing: 10) {
                    TagPill(doc.file_type.uppercased())
                    Text(Self.sizeLabel(doc.file_size))
                        .font(ACXFont.mono(13))
                        .monospacedDigit()
                        .foregroundStyle(ACXColor.muted)
                    Text(Self.dateLabel(doc.created_at))
                        .font(ACXFont.mono(13))
                        .monospacedDigit()
                        .foregroundStyle(ACXColor.muted)
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Mastery block

    private var masteryBlock: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("\(model.progress?.mastery_percent ?? 0)")
                    .font(ACXFont.monoBold(44, relativeTo: .largeTitle))
                    .monospacedDigit()
                    .foregroundStyle(ACXColor.ink)
                Text("%")
                    .font(ACXFont.mono(20))
                    .foregroundStyle(ACXColor.muted)
                Spacer(minLength: 0)
                if let milestone = model.progress?.milestone {
                    MilestoneBadge(level: MilestoneBadge.Level(apiValue: milestone))
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Mastery")
            .accessibilityValue("\(model.progress?.mastery_percent ?? 0) percent")

            MasteryBar(percent: model.progress?.mastery_percent ?? 0, showsLabel: false)

            statRow
        }
    }

    private var statRow: some View {
        let p = model.progress
        let total = p?.concepts_total ?? model.concepts.count
        let practised = p?.concepts_practiced ?? model.concepts.filter(\.hasBeenTested).count
        let weak = p?.weak_concepts_count ?? 0
        let mastered = p?.mastered_concepts_count ?? 0
        let line = "CONCEPTS \(total) · PRACTISED \(practised) · WEAK \(weak) · MASTERED \(mastered)"
        return Text(line)
            .font(ACXFont.mono(13))
            .monospacedDigit()
            .foregroundStyle(ACXColor.muted)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel(
                "\(total) concepts, \(practised) practised, \(weak) weak, \(mastered) mastered")
    }

    // MARK: - Concept table

    private var conceptTable: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Kicker("CONCEPTS — WEAKEST FIRST")
                Spacer(minLength: 8)
                Text("\(model.selection.count)/\(DocumentDetailModel.maxFocusConcepts)")
                    .font(ACXFont.monoBold(13))
                    .monospacedDigit()
                    .foregroundStyle(ACXColor.ink)
            }
            .padding(.bottom, 8)

            Text("Pick up to \(DocumentDetailModel.maxFocusConcepts) to focus the next session on.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
                .padding(.bottom, 12)

            Hairline()

            ForEach(model.sortedConcepts) { concept in
                conceptRow(concept)
                Hairline()
            }
        }
    }

    private func conceptRow(_ concept: Concept) -> some View {
        let selected = model.isSelected(concept)
        return Button {
            model.toggle(concept)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                // Selection is a square that fills with ink — not a coloured dot,
                // and not the accent, which this screen spends on mastery bars.
                Rectangle()
                    .fill(selected ? ACXColor.ink : Color.clear)
                    .frame(width: 14, height: 14)
                    .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 1.5))
                    .padding(.top, 3)

                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(concept.concept_name)
                            .font(ACXFont.bodyMedium(16))
                            .foregroundStyle(ACXColor.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        if concept.is_core { CoreBadge() }
                        Spacer(minLength: 0)
                    }

                    HStack(spacing: 12) {
                        ImportanceDots(score: concept.importance_score)
                        Text(concept.hasBeenTested
                             ? "\(concept.times_correct)/\(concept.times_tested)"
                             : "NOT TESTED")
                            .font(ACXFont.mono(13))
                            .monospacedDigit()
                            .foregroundStyle(ACXColor.muted)
                        Spacer(minLength: 0)
                    }

                    MasteryBar(percent: Self.masteryPercent(concept.mastery_score), showsLabel: false)
                }
            }
            .padding(.vertical, 14)
            .frame(minHeight: 44, alignment: .top)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Self.conceptAccessibilityLabel(concept))
        .accessibilityValue(selected ? "Selected" : "Not selected")
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityHint("Focuses the next session on this concept")
    }

    // MARK: - Footer

    /// Thumb-zone primary action. The hard shadow is spent here and nowhere else
    /// on this screen, per the one-CTA rule.
    private var footer: some View {
        VStack(spacing: 10) {
            Hairline()
            HStack(spacing: 12) {
                Button {
                    Task { await start() }
                } label: {
                    Text(startLabel)
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(model.isStarting || !model.isReady || model.quotaExhausted)
                .opacity(model.isReady && !model.quotaExhausted ? 1 : 0.5)
                .frame(maxWidth: .infinity)

                Button {
                    if let onOpenSessionConfig {
                        onOpenSessionConfig(model.configRequest)
                    } else {
                        model.toast = .info("Session options arrive in the next release.")
                    }
                } label: {
                    Text("OPTIONS")
                }
                .buttonStyle(GhostButtonStyle())
                .frame(width: 120)
                .accessibilityHint("Length, difficulty and question types")
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            // The hard shadow needs room below the CTA or it clips on the inset.
            .padding(.bottom, 10)
        }
        .background(ACXColor.ground)
    }

    private var startLabel: String {
        if model.isStarting { return "STARTING…" }
        if model.quotaExhausted { return "NO CREDITS" }
        switch model.selection.count {
        case 0: return "START QUIZ"
        case 1: return "START — 1 FOCUS"
        default: return "START — \(model.selection.count) FOCUS"
        }
    }

    private func start() async {
        guard let created = await model.startSession() else { return }
        presentedEngine = QuizEngine(api: api, created: created)
        showQuiz = true
    }

    // MARK: - Five states

    private var loadingState: some View {
        VStack(alignment: .leading, spacing: 16) {
            Rectangle().fill(ACXColor.surface).frame(height: 44).frame(maxWidth: 160)
            ProgressHairline()
            ForEach(0..<4, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 8) {
                    Rectangle().fill(ACXColor.surface).frame(height: 14).frame(maxWidth: 240)
                    Rectangle().fill(ACXColor.surface).frame(height: 2)
                }
                .padding(.vertical, 6)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading this document")
    }

    private var processingState: some View {
        VStack(alignment: .leading, spacing: 14) {
            EmptyState(
                kicker: "STILL READING",
                message: "AutoCoach is pulling the concepts out of this document. It takes about a minute, and this screen updates on its own."
            )
            ProgressHairline()
                .padding(.horizontal, 20)
        }
    }

    private var noConceptsState: some View {
        EmptyState(
            kicker: "NO CONCEPTS FOUND",
            message: "This document processed, but no concepts came out of it — usually a scanned PDF with no text layer. Try a text-based PDF or PPTX.",
            actionLabel: "CHECK AGAIN",
            action: { Task { await model.load(initial: true) } }
        )
    }

    private func offlineState(_ detail: String) -> some View {
        EmptyState(
            kicker: "OFFLINE",
            message: "This device can't reach the server right now. \(detail)",
            actionLabel: "TRY AGAIN",
            action: { Task { await model.load(initial: true) } }
        )
    }

    private func failedState(_ detail: String) -> some View {
        EmptyState(
            kicker: "COULDN'T LOAD",
            message: detail,
            actionLabel: "TRY AGAIN",
            action: { Task { await model.load(initial: true) } }
        )
    }

    // MARK: - Formatting

    /// `mastery_score` is the raw 0…1 float on a concept; the 0…100 int the
    /// backend hands back on *progress* is already normalized. Do not mix them.
    static func masteryPercent(_ score: Double) -> Int {
        Int((min(1, max(0, score)) * 100).rounded())
    }

    static func sizeLabel(_ bytes: Int) -> String {
        let mb = Double(bytes) / 1_048_576
        if mb >= 1 { return String(format: "%.1f MB", mb) }
        return "\(max(1, bytes / 1024)) KB"
    }

    /// `created_at` is ISO-8601 from Postgres, with or without fractional
    /// seconds depending on the row — try both before giving up.
    static func dateLabel(_ iso: String) -> String {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        guard let date = withFraction.date(from: iso) ?? plain.date(from: iso) else {
            return String(iso.prefix(10))
        }
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func conceptAccessibilityLabel(_ concept: Concept) -> String {
        var parts = [concept.concept_name]
        if concept.is_core { parts.append("core concept") }
        parts.append("\(masteryPercent(concept.mastery_score)) percent mastery")
        parts.append(concept.hasBeenTested
                     ? "\(concept.times_correct) correct of \(concept.times_tested)"
                     : "not tested yet")
        return parts.joined(separator: ", ")
    }
}
