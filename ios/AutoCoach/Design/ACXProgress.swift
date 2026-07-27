import SwiftUI

/// Progress / mastery primitives (design PRD §7).
///
/// Every shape here is a `Rectangle` — zero radii, no gradients, no blur. The
/// only rounded element permitted anywhere in the app is the `StatusPill` dot.

// MARK: - ProgressHairline

/// 2pt bar, accent fill on a surface track, zero radius.
///
/// Determinate takes a 0…1 `value`. Indeterminate sweeps a short segment and is
/// gated on Reduce Motion — when the user has asked for less motion the bar
/// holds still at a third-width rather than animating forever.
struct ProgressHairline: View {
    /// `nil` == indeterminate.
    var value: Double?
    /// 8pt, not a hairline. A 1–2px bar is unreadable as data — hairlines are for
    /// dividers. This is the height the bar renders at unless a caller has a
    /// specific reason to differ.
    var height: CGFloat = 8

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var sweep = false

    init(value: Double? = nil, height: CGFloat = 8) {
        self.value = value
        self.height = height
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle().fill(ACXColor.surface)
                if let value {
                    Rectangle()
                        .fill(ACXColor.accent)
                        .frame(width: geo.size.width * clamped(value))
                } else {
                    Rectangle()
                        .fill(ACXColor.accent)
                        .frame(width: geo.size.width * 0.33)
                        .offset(x: reduceMotion ? 0 : (sweep ? geo.size.width * 0.67 : 0))
                        .animation(
                            reduceMotion
                                ? nil
                                : .easeInOut(duration: 0.9).repeatForever(autoreverses: true),
                            value: sweep
                        )
                        .onAppear { if !reduceMotion { sweep = true } }
                }
            }
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityLabel("Progress")
        .accessibilityValue(value.map { "\(Int(clamped($0) * 100)) percent" } ?? "In progress")
    }

    private func clamped(_ v: Double) -> Double { min(1, max(0, v)) }
}

// MARK: - MasteryBar

/// Hairline bar + mono percentage label. Used in library rows, doc detail and
/// the concept table.
struct MasteryBar: View {
    /// 0…100.
    let percent: Int
    var showsLabel: Bool = true
    var label: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if showsLabel {
                HStack(spacing: 8) {
                    if let label {
                        // The label is prose; only the percentage beside it is data.
                        Text(label)
                            .font(ACXFont.body(15))
                            .foregroundStyle(ACXColor.muted)
                    }
                    Spacer(minLength: 0)
                    Text("\(clampedPercent)%")
                        .font(ACXFont.monoBold(11))
                        .foregroundStyle(ACXColor.ink)
                        .monospacedDigit()
                }
            }
            ProgressHairline(value: Double(clampedPercent) / 100)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label ?? "Mastery")
        .accessibilityValue("\(clampedPercent) percent")
    }

    private var clampedPercent: Int { min(100, max(0, percent)) }
}

// MARK: - ScoreMeter

/// Square **segmented** meter for the results screen — deliberately not a donut.
/// Renders `total` square cells, `filled` of them in accent.
struct ScoreMeter: View {
    let filled: Int
    let total: Int
    var cell: CGFloat = 18
    var spacing: CGFloat = 4

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(0..<max(total, 0), id: \.self) { index in
                Rectangle()
                    .fill(index < filled ? ACXColor.accent : ACXColor.ground)
                    .frame(width: cell, height: cell)
                    .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 1.5))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Score")
        .accessibilityValue("\(filled) of \(total)")
    }
}

// MARK: - MilestoneBadge

/// Square ink-bordered 25 / 50 / 75 / 100 badge. `.none` renders nothing so
/// callers can drop it in unconditionally.
struct MilestoneBadge: View {
    enum Level: String {
        case none, m25 = "25", m50 = "50", m75 = "75", m100 = "100"

        /// Maps the backend's `milestone` string ("none" | "25" | "50" | "75" | "100").
        init(apiValue: String) {
            switch apiValue {
            case "25": self = .m25
            case "50": self = .m50
            case "75": self = .m75
            case "100": self = .m100
            default: self = .none
            }
        }
    }

    let level: Level

    var body: some View {
        if level != .none {
            Text(level.rawValue)
                .font(ACXFont.monoBold(11))
                .monospacedDigit()
                .foregroundStyle(ACXColor.ink)
                .padding(.horizontal, 7)
                .padding(.vertical, 4)
                .background(ACXColor.ground)
                .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 1.5))
                .accessibilityLabel("Milestone \(level.rawValue) percent reached")
        }
    }
}

#Preview("ProgressHairline") {
    VStack(alignment: .leading, spacing: 24) {
        SectionLabel("Determinate")
        ProgressHairline(value: 0.62)
        SectionLabel("Indeterminate")
        ProgressHairline()
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(GroundBackground())
}

#Preview("MasteryBar") {
    VStack(alignment: .leading, spacing: 20) {
        MasteryBar(percent: 0, label: "Mastery")
        MasteryBar(percent: 47, label: "Mastery")
        MasteryBar(percent: 100, label: "Mastery")
        MasteryBar(percent: 62, showsLabel: false)
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(GroundBackground())
}

#Preview("ScoreMeter + MilestoneBadge") {
    VStack(alignment: .leading, spacing: 24) {
        ScoreMeter(filled: 4, total: 5)
        ScoreMeter(filled: 7, total: 10, cell: 14)
        HStack(spacing: 8) {
            MilestoneBadge(level: .m25)
            MilestoneBadge(level: .m50)
            MilestoneBadge(level: .m75)
            MilestoneBadge(level: .m100)
            MilestoneBadge(level: .none)
        }
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(GroundBackground())
}
