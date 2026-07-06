import SwiftUI

/// MCQ / TF / free-text answer inputs for the quiz session. Kept separate from
/// ``QuizSessionView`` so the phase-switching shell stays readable.

/// "A"…"D" for a zero-based option index.
func acxLetter(for index: Int) -> String {
    guard index >= 0, index < 26 else { return "" }
    return String(UnicodeScalar(65 + index)!)
}

/// The backend stores MCQ options with a letter prefix ("A) text"); strip it for
/// display and badge our own letter. Falls back to the raw string if no prefix.
func acxOptionDisplay(_ option: String, index: Int) -> String {
    let letter = acxLetter(for: index)
    let trimmed = option.trimmingCharacters(in: .whitespaces)
    guard trimmed.count >= 2,
          let first = trimmed.first,
          String(first).uppercased() == letter,
          let second = trimmed.dropFirst().first,
          [")", ".", " "].contains(String(second))
    else { return option }
    return String(trimmed.dropFirst(2)).trimmingCharacters(in: .whitespaces)
}

/// MCQ — four options A–D. Selecting sets the bound letter ("A"…"D"); the
/// engine submits the letter (format-independent — see brief note).
struct MCQOptionsView: View {
    let options: [String]
    @Binding var selection: String?

    var body: some View {
        VStack(spacing: 10) {
            ForEach(Array(options.enumerated()), id: \.offset) { index, option in
                let letter = acxLetter(for: index)
                let selected = selection == letter
                Button {
                    selection = selected ? nil : letter
                } label: {
                    HStack(spacing: 12) {
                        Text(letter)
                            .font(ACXFont.monoBold(14))
                            .foregroundStyle(selected ? ACXColor.ground : ACXColor.ink)
                            .frame(width: 22)
                        Text(acxOptionDisplay(option, index: index))
                            .font(ACXFont.body(15))
                            .multilineTextAlignment(.leading)
                            .foregroundStyle(ACXColor.ink)
                        Spacer()
                    }
                    .padding(.vertical, 14)
                    .padding(.horizontal, 14)
                    .background(selected ? ACXColor.accent : ACXColor.ground)
                    .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Option \(letter). \(acxOptionDisplay(option, index: index))")
                .accessibilityAddTraits(selected ? [.isSelected, .isButton] : [.isButton])
            }
        }
    }
}

/// True / False — options is null on the wire; render two fixed buttons.
struct TrueFalseView: View {
    @Binding var selection: String?

    var body: some View {
        HStack(spacing: 10) {
            tfButton("TRUE", value: "true")
            tfButton("FALSE", value: "false")
        }
    }

    private func tfButton(_ label: String, value: String) -> some View {
        let selected = selection == value
        return Button { selection = selected ? nil : value } label: {
            Text(label)
                .font(ACXFont.monoBold(15))
                .kerning(0.4)
                .foregroundStyle(selected ? ACXColor.ground : ACXColor.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(selected ? ACXColor.accent : ACXColor.ground)
                .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? [.isSelected, .isButton] : [.isButton])
    }
}

/// Free-text answer — typed **and** voice dictation. Dictated text is submitted
/// with `input_method: "voice"`.
struct FreeTextAnswerView: View {
    @Binding var text: String
    @Binding var usedVoice: Bool
    let speech: SpeechRecognizer?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text("Type your answer…")
                        .font(ACXFont.body(15))
                        .foregroundStyle(ACXColor.muted)
                        .padding(.top, 10)
                        .padding(.leading, 12)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $text)
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.ink)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 120)
                    .padding(8)
            }
            .background(ACXColor.ground)
            .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))

            micButton
        }
        .onChange(of: speech?.transcript ?? "") { _, newValue in
            if !newValue.isEmpty {
                text = newValue
                usedVoice = true
            }
        }
    }

    @ViewBuilder
    private var micButton: some View {
        if let speech {
            Button {
                toggleDictation(speech)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: speech.state == .listening ? "stop.circle.fill" : "mic.fill")
                    Text(speech.state == .listening ? "STOP DICTATION" : "DICTATE")
                }
                .font(ACXFont.monoBold(13))
                .kerning(0.4)
                .foregroundStyle(ACXColor.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(ACXColor.ground)
                .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
            }
            .buttonStyle(.plain)
            .disabled(speech.state.isUnavailable)
            .accessibilityLabel(speech.state == .listening ? "Stop dictation" : "Dictate answer")
            if case .unavailable(let reason) = speech.state {
                Text(reason)
                    .font(ACXFont.mono(11))
                    .foregroundStyle(ACXColor.muted)
            }
        }
    }

    private func toggleDictation(_ speech: SpeechRecognizer) {
        if speech.state == .listening {
            speech.stop()
        } else {
            usedVoice = true
            speech.start()
        }
    }
}

private extension SpeechRecognizer.State {
    var isUnavailable: Bool {
        if case .unavailable = self { return true }
        return false
    }
}
