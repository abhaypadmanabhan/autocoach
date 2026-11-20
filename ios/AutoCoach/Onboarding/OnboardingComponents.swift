import SwiftUI

/// Local building blocks for the onboarding flow only (design PRD §5.4 layout).
///
/// Deliberately **not** promoted into `Design/` — an option row with a 2px accent
/// left tick is an onboarding idiom, and the foundation lane owns the shared
/// primitive set. If a second surface ever needs these, lift them then.

// MARK: - OptionRow

/// Square, ink-bordered row with a 2px accent left tick when selected.
struct OnboardingOptionRow: View {
    let title: String
    var blurb: String?
    let isSelected: Bool
    /// Dimmed and non-tappable once a multi-select cap is reached.
    var isDisabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 0) {
                // The tick is the selection indicator — 2px, accent, full height.
                Rectangle()
                    .fill(isSelected ? ACXColor.accent : Color.clear)
                    .frame(width: 2)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(ACXFont.monoBold(14))
                        .kerning(0.6)
                        .foregroundStyle(ACXColor.ink)
                        .multilineTextAlignment(.leading)
                    if let blurb {
                        Text(blurb)
                            .font(ACXFont.body(15))
                            .foregroundStyle(ACXColor.muted)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.leading, 14)
                .padding(.vertical, 14)

                Spacer(minLength: 12)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 44)
            .background(ACXColor.ground)
            .overlay(
                Rectangle().stroke(ACXColor.ink, lineWidth: isSelected ? 2 : 1)
            )
            .opacity(isDisabled ? 0.4 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(blurb.map { "\(title). \($0)" } ?? title)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Chip

/// Square multi-select chip for step 1. Same vocabulary as the option row —
/// ink border, 2px accent left tick — sized for a two-column grid.
struct OnboardingChip: View {
    let title: String
    let isSelected: Bool
    var isDisabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 0) {
                Rectangle()
                    .fill(isSelected ? ACXColor.accent : Color.clear)
                    .frame(width: 2)
                Text(title)
                    .font(ACXFont.monoBold(13))
                    .kerning(0.4)
                    .foregroundStyle(ACXColor.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.leading, 10)
                    .padding(.vertical, 12)
                Spacer(minLength: 6)
            }
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .background(ACXColor.ground)
            .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: isSelected ? 2 : 1))
            .opacity(isDisabled ? 0.4 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Stepper

/// Square −/+ stepper with a mono numeral. Not SwiftUI's `Stepper`, whose system
/// control is rounded and uses a material background.
struct OnboardingStepper: View {
    let value: Int
    let range: ClosedRange<Int>
    let unitLabel: String
    let onChange: (Int) -> Void

    var body: some View {
        HStack(spacing: 0) {
            button(symbol: "minus", delta: -1, enabled: value > range.lowerBound)
            Rectangle().fill(ACXColor.ink).frame(width: 1)

            VStack(spacing: 2) {
                Text("\(value)")
                    .font(ACXFont.monoBold(20, relativeTo: .title2))
                Text(unitLabel)
                    .font(ACXFont.mono(11))
                    .foregroundStyle(ACXColor.muted)
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .foregroundStyle(ACXColor.ink)

            Rectangle().fill(ACXColor.ink).frame(width: 1)
            button(symbol: "plus", delta: 1, enabled: value < range.upperBound)
        }
        .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(unitLabel)
        .accessibilityValue("\(value)")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: if value < range.upperBound { onChange(value + 1) }
            case .decrement: if value > range.lowerBound { onChange(value - 1) }
            @unknown default: break
            }
        }
    }

    private func button(symbol: String, delta: Int, enabled: Bool) -> some View {
        Button {
            onChange(value + delta)
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(enabled ? ACXColor.ink : ACXColor.muted)
                .frame(width: 56, height: 56)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityHidden(true)   // the adjustable action above covers this
    }
}

// MARK: - Step scaffold

/// Shared question layout: kicker, title, subtitle, then the step's own content.
struct OnboardingStepBody<Content: View>: View {
    let kicker: String
    let title: String
    var subtitle: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(kicker)
            Hairline().padding(.top, 10)

            Text(title)
                .font(ACXFont.display(28, relativeTo: .title))
                .foregroundStyle(ACXColor.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 18)
                .accessibilityAddTraits(.isHeader)

            if let subtitle {
                Text(subtitle)
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
            }

            content.padding(.top, 24)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
