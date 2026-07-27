import SwiftUI

/// Activation checklist (PRD §5.6) — the highest-leverage empty-state fix.
///
/// Three derived steps, each carrying a `StatusMark` rather than a coloured dot:
/// a done step is a hairline check, an outstanding one a hollow ring. No colour
/// at all, because nothing here is a failure.
struct ActivationChecklistView: View {
    let checklist: ActivationChecklist

    private var items: [(label: String, hint: String, done: Bool)] {
        [
            ("ADD YOUR FIRST DOCUMENT",
             "Tap + and pick a PDF or PPTX.",
             checklist.hasDocument),
            ("FINISH A QUIZ",
             "Open a ready document and answer a few questions.",
             checklist.hasFinishedQuiz),
            ("COME BACK TOMORROW",
             "Spaced practice is where the mastery numbers come from.",
             checklist.hasReturned),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Kicker("GET SET UP")
                Spacer(minLength: 8)
                Text("\(checklist.doneCount)/\(ActivationChecklist.total)")
                    .font(ACXFont.monoBold(13))
                    .monospacedDigit()
                    .foregroundStyle(ACXColor.ink)
            }
            .padding(.bottom, 10)

            Hairline()

            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                row(item)
            }
        }
        .padding(16)
        .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Get set up. \(checklist.doneCount) of \(ActivationChecklist.total) done.")
    }

    private func row(_ item: (label: String, hint: String, done: Bool)) -> some View {
        HStack(alignment: .top, spacing: 12) {
            StatusMark(item.done ? .ready : .pending)
                .padding(.top, 5)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.label)
                    .font(ACXFont.monoBold(13))
                    .kerning(0.6)
                    .foregroundStyle(ACXColor.ink)
                    .strikethrough(item.done, color: ACXColor.muted)
                Text(item.hint)
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
        .frame(minHeight: 44, alignment: .top)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.label). \(item.done ? "Done" : "Not done yet"). \(item.hint)")
    }
}

// MARK: - Quota notice

/// Designed daily-quota state (PRD §3.3 — "constraints are game state, never an
/// error"). Rendered instead of an alert whenever `POST /quiz/sessions/` has
/// answered 429 with the object-shaped `detail` today.
///
/// The server **deletes the session it had just created** on that path, so the
/// copy is deliberately "no session started", not "your quiz failed".
struct QuotaNotice: View {
    let limit: Int
    var compact: Bool = false

    private var limitLine: String {
        limit > 0 ? "\(limit) QUIZZES / DAY" : "DAILY LIMIT REACHED"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Kicker("OUT OF CREDITS")
                Spacer(minLength: 8)
                Text(limitLine)
                    .font(ACXFont.monoBold(13))
                    .monospacedDigit()
                    .foregroundStyle(ACXColor.ink)
            }
            Hairline()
            Text(compact
                 ? "No quiz was started. Your credits reset tomorrow."
                 : "You've used today's quiz credits, so no session was started. They reset tomorrow — or redeem 100 XP for one more.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
        .accessibilityElement(children: .combine)
    }
}

#Preview("ActivationChecklist") {
    VStack(spacing: 20) {
        ActivationChecklistView(
            checklist: ActivationChecklist(hasDocument: true, hasFinishedQuiz: false, hasReturned: false))
        QuotaNotice(limit: 5)
    }
    .padding(20)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    .background(GroundBackground())
}
