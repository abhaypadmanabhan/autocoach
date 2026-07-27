import SwiftUI

/// The quiz focus surface — a `fullScreenCover` driven by ``QuizEngine``.
/// Renders MCQ / TF / free-text (typed + voice), the async verdict states
/// (grading → verdict / still-grading), next-question prep, and pushes
/// ``ResultsView`` on `.finished`.
struct QuizSessionView: View {
    let engine: QuizEngine
    let api: APIClient
    let documentTitle: String
    let onClose: () -> Void

    @State private var showResults = false
    @State private var mcqSelection: String?
    @State private var tfSelection: String?
    @State private var freeText: String = ""
    @State private var usedVoice: Bool = false
    @State private var speech: SpeechRecognizer?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    progressHeader
                    questionCard
                    phasePanel
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 40)
            }
            .scrollContentBackground(.hidden)
            .background(GroundBackground())
            .toolbarBackground(ACXColor.ground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { onClose() } label: { Image(systemName: "xmark") }
                        .tint(ACXColor.ink)
                        .accessibilityLabel("Close quiz")
                }
            }
            .navigationTitle(documentTitle)
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(isPresented: $showResults) {
                ResultsView(sessionId: engine.sessionId, api: api)
            }
        }
        .task {
            if speech == nil {
                let s = SpeechRecognizer()
                await s.requestAuthorization()
                speech = s
            }
        }
        .onDisappear { engine.cancel(); speech?.stop() }
        .onChange(of: engine.currentQuestion?.question_id) { _, _ in
            mcqSelection = nil; tfSelection = nil; freeText = ""; usedVoice = false
            speech?.reset()
        }
        .onChange(of: engine.phase) { _, phase in
            if phase == .finished { showResults = true }
        }
    }

    // MARK: - Header

    private var progressHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Kicker("02 / QUIZ")
                Spacer()
                Text("SCORE \(engine.scoreSoFar)")
                    .font(ACXFont.monoBold(12))
                    .foregroundStyle(ACXColor.ink)
            }
            if let q = engine.currentQuestion {
                Text(String(format: "QUESTION %02d / %02d", q.question_number, q.total_questions))
                    .font(ACXFont.monoBold(12))
                    .foregroundStyle(ACXColor.muted)
            }
            Hairline()
        }
    }

    // MARK: - Question card (active card → hard shadow)

    private var questionCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let q = engine.currentQuestion {
                HStack(spacing: 8) {
                    StatusPill(text: q.difficulty.uppercased(), dot: .ink)
                    if q.kind == .freeText {
                        StatusPill(text: "FREE TEXT", dot: .muted)
                    }
                    Spacer()
                }
                Text(q.question_text)
                    .font(ACXFont.body(17))
                    .foregroundStyle(ACXColor.ink)
                    .fixedSize(horizontal: false, vertical: true)

                if engine.phase == .answering {
                    answerArea(for: q)
                }
            }
        }
        .padding(18)
        .background(ACXColor.ground)
        .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
        .acxHardShadow()
    }

    @ViewBuilder
    private func answerArea(for q: Question) -> some View {
        switch q.kind {
        case .mcq:
            if let options = q.options {
                MCQOptionsView(options: options, selection: $mcqSelection)
            }
        case .tf:
            TrueFalseView(selection: $tfSelection)
        case .freeText:
            FreeTextAnswerView(text: $freeText, usedVoice: $usedVoice, speech: speech)
        case .rendered, .unknown:
            Text("Unsupported question type.")
                .font(ACXFont.mono(12)).foregroundStyle(ACXColor.muted)
        }
    }

    @ViewBuilder
    private var phasePanel: some View {
        switch engine.phase {
        case .answering:
            Button { submit() } label: { Text("SUBMIT ANSWER") }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!canSubmit)

        case .submitting:
            statusLine("Submitting…")

        case .grading(let attempt):
            VStack(alignment: .leading, spacing: 8) {
                Text("GRADING YOUR ANSWER")
                    .font(ACXFont.monoBold(13)).kerning(0.6).foregroundStyle(ACXColor.ink)
                Text("Free-text answers are evaluated off-request. Attempt \(attempt)/6.")
                    .font(ACXFont.mono(11)).foregroundStyle(ACXColor.muted)
            }
            .accessibilityLabel("Grading your answer, attempt \(attempt) of 6.")

        case .gradingTimedOut:
            VStack(alignment: .leading, spacing: 10) {
                Text("STILL GRADING")
                    .font(ACXFont.monoBold(13)).kerning(0.6).foregroundStyle(ACXColor.ink)
                Text("The verdict hasn't landed yet. Your answer is saved — re-check below.")
                    .font(ACXFont.mono(11)).foregroundStyle(ACXColor.muted)
                Button { Task { await engine.recheckVerdict() } } label: { Text("RE-CHECK") }
                    .buttonStyle(GhostButtonStyle())
            }
            .accessibilityLabel("Still grading. Your answer is saved.")

        case .verdict:
            verdictPanel

        case .awaitingNext(let attempt):
            VStack(alignment: .leading, spacing: 6) {
                Text("PREPARING THE NEXT QUESTION")
                    .font(ACXFont.monoBold(13)).kerning(0.6).foregroundStyle(ACXColor.ink)
                Text("Adapting to your performance. Attempt \(attempt)/4.")
                    .font(ACXFont.mono(11)).foregroundStyle(ACXColor.muted)
            }

        case .failed(let message):
            VStack(alignment: .leading, spacing: 10) {
                Text("Something went wrong").font(ACXFont.body(15)).foregroundStyle(ACXColor.error)
                Text(message).font(ACXFont.mono(11)).foregroundStyle(ACXColor.muted)
                Button { Task { await engine.retryAdvance() } } label: { Text("RETRY") }
                    .buttonStyle(GhostButtonStyle())
            }

        case .finished:
            statusLine("Loading results…")
        }
    }

    @ViewBuilder
    private var verdictPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            verdictHeadline
            if let r = engine.lastResult {
                if let correct = r.correct_answer, !correct.isEmpty {
                    answerLine(label: "CORRECT ANSWER", text: displayCorrectAnswer(correct), color: ACXColor.ink)
                }
                if let explanation = r.explanation, !explanation.isEmpty {
                    Text(explanation).font(ACXFont.body(13)).foregroundStyle(ACXColor.muted)
                } else if let feedback = r.feedback, !feedback.isEmpty {
                    Text(feedback).font(ACXFont.body(13)).foregroundStyle(ACXColor.muted)
                }
            }
            Button { Task { await engine.advanceToNext() } } label: {
                Text(engine.sessionComplete ? "SEE RESULTS" : "NEXT QUESTION")
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .padding(.top, 4)
    }

    @ViewBuilder
    private var verdictHeadline: some View {
        if let isCorrect = engine.lastResult?.is_correct {
            if isCorrect {
                Text("CORRECT").font(ACXFont.display(30)).foregroundStyle(ACXColor.accent)
                    .accessibilityLabel("Correct answer.")
            } else {
                Text("INCORRECT").font(ACXFont.display(30)).foregroundStyle(ACXColor.error)
                    .accessibilityLabel("Incorrect answer.")
            }
        }
    }

    private func answerLine(label: String, text: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(ACXFont.monoBold(10)).kerning(1.2).foregroundStyle(ACXColor.muted)
            Text(text).font(ACXFont.body(14)).foregroundStyle(color)
        }
    }

    private func statusLine(_ text: String) -> some View {
        Text(text).font(ACXFont.mono(13)).foregroundStyle(ACXColor.muted).accessibilityLabel(text)
    }

    // MARK: - Submit helpers

    private var canSubmit: Bool {
        guard let q = engine.currentQuestion else { return false }
        switch q.kind {
        case .mcq: return mcqSelection != nil
        case .tf: return tfSelection != nil
        case .freeText: return !freeText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .rendered, .unknown: return false
        }
    }

    private func submit() {
        guard let (answer, method) = currentAnswer() else { return }
        Task { await engine.submitAnswer(answer, inputMethod: method) }
    }

    private func currentAnswer() -> (String, InputMethod)? {
        guard let q = engine.currentQuestion else { return nil }
        switch q.kind {
        case .mcq:
            guard let sel = mcqSelection else { return nil }
            return (sel, .click)
        case .tf:
            guard let sel = tfSelection else { return nil }
            return (sel, .click)
        case .freeText:
            let trimmed = freeText.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            return (trimmed, usedVoice ? .voice : .typed)
        case .rendered, .unknown:
            return nil
        }
    }

    /// Map a single-letter model answer to the option text for display clarity.
    private func displayCorrectAnswer(_ correct: String) -> String {
        let letter = correct.trimmingCharacters(in: .whitespaces).uppercased()
        let letters = ["A", "B", "C", "D"]
        if letter.count == 1, letters.contains(letter),
           let q = engine.currentQuestion, let options = q.options,
           let idx = letters.firstIndex(of: letter), idx < options.count {
            return "\(letter) — \(acxOptionDisplay(options[idx], index: idx))"
        }
        return correct
    }
}
