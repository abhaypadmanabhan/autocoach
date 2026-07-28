import SwiftUI

/// Concept-table and explanation primitives (design PRD §7).

// MARK: - ImportanceDots

/// Square dots (never circles) conveying a concept's importance score.
/// The backend's `importance_score` is a 0…1 float; five cells.
struct ImportanceDots: View {
    /// 0…1.
    let score: Double
    var cell: CGFloat = 6
    var spacing: CGFloat = 3
    private let total = 5

    private var filled: Int {
        let clamped = min(1, max(0, score))
        return Int((clamped * Double(total)).rounded())
    }

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(0..<total, id: \.self) { index in
                Rectangle()
                    .fill(index < filled ? ACXColor.ink : ACXColor.surface)
                    .frame(width: cell, height: cell)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Importance")
        .accessibilityValue("\(filled) of \(total)")
    }
}

// MARK: - CoreBadge

/// Tag for concepts the backend flags `is_core`.
///
/// Sentence case in the body face: this is a label, not data, and 9pt tracked
/// uppercase mono was both below the type floor and the exact micro-label tell
/// the design rules ban.
struct CoreBadge: View {
    var text: String = "Core"

    var body: some View {
        Text(text)
            .font(ACXFont.bodyMedium(13))
            .foregroundStyle(ACXColor.muted)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 1))
            .accessibilityLabel("Core concept")
    }
}

// MARK: - WhyInset

/// Explanation callout used under a verdict — accent left tick, surface ground.
/// Carries the "why", so it is a single accessibility element with the label
/// read as one block.
struct WhyInset: View {
    var title: String = "WHY"
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Rectangle()
                .fill(ACXColor.accent)
                .frame(width: 3)
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(ACXFont.monoBold(10))
                    .foregroundStyle(ACXColor.muted)
                Text(text)
                    .font(ACXFont.body(14))
                    .foregroundStyle(ACXColor.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(ACXColor.surface.opacity(0.5))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(text)")
    }
}

// MARK: - CornerCrosshair

/// Decorative corner marks for the upload empty state. Purely ornamental, so it
/// is hidden from VoiceOver.
struct CornerCrosshair: View {
    var length: CGFloat = 14
    var thickness: CGFloat = 2
    var color: Color = ACXColor.ink

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack(alignment: .topLeading) {
                mark.offset(x: 0, y: 0)
                mark.rotationEffect(.degrees(90), anchor: .topLeading).offset(x: w, y: 0)
                mark.rotationEffect(.degrees(-90), anchor: .topLeading).offset(x: 0, y: h)
                mark.rotationEffect(.degrees(180), anchor: .topLeading).offset(x: w, y: h)
            }
        }
        .accessibilityHidden(true)
    }

    private var mark: some View {
        ZStack(alignment: .topLeading) {
            Rectangle().fill(color).frame(width: length, height: thickness)
            Rectangle().fill(color).frame(width: thickness, height: length)
        }
        .frame(width: length, height: length, alignment: .topLeading)
    }
}

#Preview("ImportanceDots + CoreBadge") {
    VStack(alignment: .leading, spacing: 18) {
        ForEach([0.0, 0.25, 0.5, 0.8, 1.0], id: \.self) { score in
            HStack(spacing: 12) {
                ImportanceDots(score: score)
                Text(String(format: "%.2f", score))
                    .font(ACXFont.mono(11))
                    .foregroundStyle(ACXColor.muted)
            }
        }
        CoreBadge()
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(GroundBackground())
}

#Preview("WhyInset") {
    VStack(alignment: .leading, spacing: 20) {
        WhyInset(text: "A hash join builds a hash table on the smaller relation, then probes it once per row of the larger one — so it is linear where a nested loop is quadratic.")
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(GroundBackground())
}

#Preview("CornerCrosshair") {
    ZStack {
        CornerCrosshair()
        Text("DROP A FILE")
            .font(ACXFont.monoBold(12))
            .foregroundStyle(ACXColor.muted)
    }
    .frame(width: 260, height: 160)
    .padding(40)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(GroundBackground())
}
