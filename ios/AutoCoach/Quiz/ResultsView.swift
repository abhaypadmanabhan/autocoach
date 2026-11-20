import SwiftUI

/// `GET /quiz/sessions/{id}` → score + per-question correctness/explanation.
struct ResultsView: View {
    let sessionId: String
    let api: APIClient
    /// Dismisses the whole quiz. Results is pushed onto the quiz's own
    /// NavigationStack, so the system back button pops to the last *answered*
    /// question — a dead end. This is the only way out, and the back button is
    /// hidden below so it cannot be mistaken for one.
    let onDone: () -> Void

    @State private var status: SessionStatus?
    @State private var loading = true
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                if loading {
                    loadingBlock
                } else if let status {
                    scoreBlock(status)
                    questionsBlock(status)
                } else if let errorMessage {
                    Text(errorMessage)
                        .font(ACXFont.body(15))
                        .foregroundStyle(ACXColor.error)
                        .padding(.top, 24)
                }
                // Outside the if/else on purpose: even a failed load must have a
                // way out, otherwise the error state is the dead end instead.
                doneButton
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .task { await load() }
    }

    private var doneButton: some View {
        Button("Back to dashboard") { onDone() }
            .buttonStyle(PrimaryButtonStyle())
            .padding(.top, 32)
            .accessibilityHint("Ends the session and returns to the dashboard")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScreenTitle("Results")
            Hairline()
            Text("Session complete")
                .font(ACXFont.display(28))
                .foregroundStyle(ACXColor.ink)
                .padding(.top, 6)
        }
        .padding(.top, 16)
        .padding(.bottom, 28)
    }

    private var loadingBlock: some View {
        Text("Loading results…")
            .font(ACXFont.body(15))
            .foregroundStyle(ACXColor.muted)
            .padding(.top, 24)
    }

    private func scoreBlock(_ s: SessionStatus) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                Text(scoreText(s))
                    .font(ACXFont.display(56))
                    .foregroundStyle(ACXColor.ink)
                Text("%")
                    .font(ACXFont.bodySemibold(20))
                    .foregroundStyle(ACXColor.muted)
            }
            Text("\(s.correct_answers) / \(s.answered_questions) correct · \(s.answered_questions) of \(s.total_questions) answered")
                .font(ACXFont.mono(12))
                .foregroundStyle(ACXColor.muted)
        }
        .padding(.bottom, 24)
        .overlay(alignment: .bottom) { Hairline() }
        .padding(.bottom, 24)
    }

    private func questionsBlock(_ s: SessionStatus) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            SectionLabel("Question breakdown")
            ForEach(s.questions) { q in
                questionRow(q)
            }
        }
    }

    private func questionRow(_ q: SessionQuestionDetail) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(String(format: "%02d", q.question_number))
                    .font(ACXFont.monoBold(12))
                    .foregroundStyle(ACXColor.muted)
                verdictLabel(q)
                Spacer()
            }
            Text(q.question_text)
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.ink)
            if let userAnswer = q.user_answer, !userAnswer.isEmpty {
                answerLine(label: "YOU", text: userAnswer, color: q.is_correct == true ? ACXColor.accent : ACXColor.error)
            }
            answerLine(label: "Answer", text: q.correct_answer, color: ACXColor.ink)
            if let explanation = q.explanation, !explanation.isEmpty {
                Text(explanation)
                    .font(ACXFont.body(13))
                    .foregroundStyle(ACXColor.muted)
            }
        }
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) { Hairline() }
        .accessibilityElement(children: .combine)
    }

    private func verdictLabel(_ q: SessionQuestionDetail) -> some View {
        switch q.is_correct {
        case true:
            return StatusPill("Correct", state: .ready)
        case false:
            return StatusPill("Incorrect", state: .failed)
        case nil:
            return StatusPill("Not graded", state: .pending)
        }
    }

    private func answerLine(label: String, text: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(ACXFont.monoBold(10)).kerning(1.2).foregroundStyle(ACXColor.muted)
            Text(text).font(ACXFont.body(14)).foregroundStyle(color)
        }
    }

    private func scoreText(_ s: SessionStatus) -> String {
        if let pct = s.score_percentage { return String(Int(pct.rounded())) }
        return "—"
    }

    private func load() async {
        loading = true
        errorMessage = nil
        do {
            status = try await api.get("/quiz/sessions/\(sessionId)")
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}
