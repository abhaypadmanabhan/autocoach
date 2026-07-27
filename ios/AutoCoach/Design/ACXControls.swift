import SwiftUI

/// Selection, credit, streak and empty-state primitives (design PRD §7).

// MARK: - SegmentedControl

/// Square segmented picker — accent fill on the selected segment.
///
/// Not `Picker(.segmented)`, whose system rendering is rounded and uses a
/// material background.
struct SegmentedControl<Value: Hashable>: View {
    struct Segment: Identifiable {
        let value: Value
        let label: String
        var id: Value { value }

        init(_ value: Value, _ label: String) {
            self.value = value
            self.label = label
        }
    }

    let segments: [Segment]
    @Binding var selection: Value
    var accessibilityTitle: String = "Options"

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(segments.enumerated()), id: \.element.id) { index, segment in
                let isSelected = segment.value == selection
                Button {
                    selection = segment.value
                } label: {
                    Text(segment.label)
                        .font(ACXFont.monoBold(12))
                        .kerning(0.6)
                        .textCase(.uppercase)
                        .foregroundStyle(isSelected ? ACXColor.ground : ACXColor.ink)
                        .frame(maxWidth: .infinity)
                        // 44pt minimum hit target.
                        .frame(minHeight: 44)
                        .background(isSelected ? ACXColor.accent : ACXColor.ground)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)

                if index < segments.count - 1 {
                    Rectangle().fill(ACXColor.ink).frame(width: 2)
                }
            }
        }
        .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityTitle)
    }
}

// MARK: - CreditPips

/// Filled / hollow squares for remaining quiz credits.
struct CreditPips: View {
    let used: Int
    let total: Int
    var cell: CGFloat = 10
    var spacing: CGFloat = 5

    private var remaining: Int { max(0, total - used) }

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(0..<max(total, 0), id: \.self) { index in
                Rectangle()
                    .fill(index < remaining ? ACXColor.ink : ACXColor.ground)
                    .frame(width: cell, height: cell)
                    .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 1.5))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Quiz credits")
        .accessibilityValue("\(remaining) of \(total) remaining")
    }
}

// MARK: - WeekStrip

/// Seven square cells — one per day, Monday-first. `activeDays` holds the
/// indices (0 == Monday) the user studied.
struct WeekStrip: View {
    let activeDays: Set<Int>
    /// Index of "today" (0 == Monday), or `nil` to mark none.
    var todayIndex: Int?
    var cell: CGFloat = 30
    var spacing: CGFloat = 6

    private let labels = ["M", "T", "W", "T", "F", "S", "S"]

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(0..<7, id: \.self) { index in
                let isActive = activeDays.contains(index)
                VStack(spacing: 5) {
                    Rectangle()
                        .fill(isActive ? ACXColor.accent : ACXColor.ground)
                        .frame(width: cell, height: cell)
                        .overlay(
                            Rectangle().stroke(
                                ACXColor.ink,
                                lineWidth: index == todayIndex ? 2.5 : 1.5
                            )
                        )
                    Text(labels[index])
                        .font(ACXFont.mono(10))
                        .foregroundStyle(ACXColor.muted)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("This week")
        .accessibilityValue("\(activeDays.count) of 7 days studied")
    }
}

// MARK: - EmptyState

/// Reusable empty state — kicker + line + one optional CTA.
struct EmptyState: View {
    let kicker: String
    let message: String
    var actionLabel: String?
    var action: (() -> Void)?
    /// Decorative corner marks (upload empty state uses these).
    var showsCrosshair: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker(kicker)
            Hairline()
            Text(message)
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)

            if let actionLabel, let action {
                Button(actionLabel, action: action)
                    .buttonStyle(GhostButtonStyle())
                    .padding(.top, 6)
            }
        }
        .padding(20)
        .background {
            if showsCrosshair { CornerCrosshair() }
        }
        .accessibilityElement(children: .contain)
    }
}

#Preview("SegmentedControl") {
    struct Harness: View {
        @State private var difficulty = "medium"
        var body: some View {
            VStack(alignment: .leading, spacing: 20) {
                Kicker("Difficulty")
                SegmentedControl(
                    segments: [
                        .init("easy", "Easy"),
                        .init("medium", "Medium"),
                        .init("hard", "Hard"),
                    ],
                    selection: $difficulty,
                    accessibilityTitle: "Difficulty"
                )
                Text("Selected: \(difficulty)")
                    .font(ACXFont.mono(12))
                    .foregroundStyle(ACXColor.muted)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(GroundBackground())
        }
    }
    return Harness()
}

#Preview("CreditPips + WeekStrip") {
    VStack(alignment: .leading, spacing: 28) {
        CreditPips(used: 2, total: 5)
        CreditPips(used: 5, total: 5)
        WeekStrip(activeDays: [0, 1, 3, 4], todayIndex: 4)
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(GroundBackground())
}

#Preview("EmptyState") {
    VStack(spacing: 28) {
        EmptyState(
            kicker: "NO DOCUMENTS",
            message: "Upload a PDF or a set of notes and AutoCoach will pull the concepts out of it.",
            actionLabel: "UPLOAD",
            action: {},
            showsCrosshair: true
        )
        EmptyState(kicker: "NOTHING DUE", message: "No concepts are due for review today.")
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(GroundBackground())
}
