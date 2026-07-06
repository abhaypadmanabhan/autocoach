import SwiftUI

/// `GET /quiz/sessions/{id}` → score + per-question correctness/explanation.
struct ResultsView: View {
    let sessionId: String
    let api: APIClient

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
                        .font(ACXFont.mono(13))
                        .foregroundStyle(ACXColor.error)
                        .padding(.top, 24)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
        .navigationTitle("Results")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker("03 / RESULTS")
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
            .font(ACXFont.mono(13))
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
                    .font(ACXFont.monoBold(20))
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
            Kicker("QUESTION BREAKDOWN")
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
            answerLine(label: "ANSWER", text: q.correct_answer, color: ACXColor.ink)
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
            return StatusPill(text: "CORRECT", dot: .accent)
        case false:
            return StatusPill(text: "INCORRECT", dot: .error)
        case nil:
            return StatusPill(text: "NOT GRADED", dot: .muted)
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
