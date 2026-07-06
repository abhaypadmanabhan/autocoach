import SwiftUI

/// Padzy OS / "Quiet Brutalism" design tokens → SwiftUI (research §5).
///
/// M2 typography uses the **system font with `.monospaced` design** as the
/// Space-Mono fallback (per the M2 brief: "System-mono fallback OK for data
/// text"). Bundling the Space Grotesk / Inter / Space Mono TTFs is deferred —
/// noted in the brief progress log.
///
/// Hard rules enforced across the slice:
/// - Zero radii everywhere (only the status-pill *dot* `Circle` is rounded).
/// - No `.shadow(radius:)`, no materials, no gradients.
/// - Hard 4px ink offset shadow on the primary CTA + active quiz card ONLY.
/// - Exactly one Accent per view.
enum ACXColor {
    static let ground = Color("Ground")
    static let surface = Color("Surface")
    static let ink = Color("Ink")
    static let muted = Color("Muted")
    static let accent = Color("Accent")
    static let error = Color("ErrorRed")
}

enum ACXFont {
    /// Space-Mono fallback for ALL data text (numbers, IDs, kickers, scores).
    static func mono(_ size: CGFloat, relativeTo: Font.TextStyle = .footnote) -> Font {
        .system(size: size, weight: .regular, design: .monospaced)
    }
    static func monoBold(_ size: CGFloat, relativeTo: Font.TextStyle = .footnote) -> Font {
        .system(size: size, weight: .semibold, design: .monospaced)
    }
    /// Inter fallback for body copy.
    static func body(_ size: CGFloat = 17, relativeTo: Font.TextStyle = .body) -> Font {
        .system(size: size, weight: .regular, design: .default)
    }
    /// Space Grotesk fallback for display/headings.
    static func display(_ size: CGFloat, relativeTo: Font.TextStyle = .largeTitle) -> Font {
        .system(size: size, weight: .bold, design: .default)
    }
}

/// Hard 4px ink offset, zero blur — the Padzy `.shadow-hard`. Use ONLY on the
/// primary CTA and the active quiz card.
struct HardShadow: ViewModifier {
    var offset: CGFloat = 4
    func body(content: Content) -> some View {
        content
            .background(alignment: .topLeading) {
                Rectangle()
                    .fill(ACXColor.ink)
                    .offset(x: offset, y: offset)
            }
    }
}

extension View {
    func acxHardShadow(offset: CGFloat = 4) -> some View { modifier(HardShadow(offset: offset)) }
}

/// Numbered mono kicker label, e.g. `01 / LIBRARY`.
struct Kicker: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(ACXFont.monoBold(11))
            .kerning(1.2)
            .textCase(.uppercase)
            .foregroundStyle(ACXColor.muted)
    }
}

/// Apply kicker styling to an existing `Text`.
struct KickerStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(ACXFont.monoBold(11))
            .kerning(1.2)
            .textCase(.uppercase)
            .foregroundStyle(ACXColor.muted)
    }
}

extension View {
    func kickerStyle() -> some View { modifier(KickerStyle()) }
}

/// 1px hairline divider on cream (scaled for display).
struct Hairline: View {
    @Environment(\.displayScale) private var displayScale
    var body: some View {
        Rectangle()
            .fill(ACXColor.surface)
            .frame(height: 1 / displayScale)
    }
}

/// StatusPill — mono label + status dot (the single rounded exception).
struct StatusPill: View {
    enum Dot { case accent, ink, muted, error }
    let text: String
    let dot: Dot
    private var color: Color {
        switch dot { case .accent: ACXColor.accent; case .ink: ACXColor.ink; case .muted: ACXColor.muted; case .error: ACXColor.error }
    }
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(text).font(ACXFont.mono(11)).foregroundStyle(ACXColor.ink)
        }
    }
}

/// Primary CTA — zero radius, ink border, accent fill, hard offset shadow.
/// Tapping scales down 2% (Reduce Motion-safe: no spring, instant snap).
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(ACXFont.monoBold(15))
            .kerning(0.4)
            .textCase(.uppercase)
            .foregroundStyle(ACXColor.ground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(ACXColor.accent)
            .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
            .acxHardShadow()
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.98 : 1.0)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.08), value: configuration.isPressed)
    }
}

/// Secondary/ghost button — zero radius, ink border, transparent ground fill.
struct GhostButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(ACXFont.monoBold(14))
            .kerning(0.4)
            .textCase(.uppercase)
            .foregroundStyle(ACXColor.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(ACXColor.ground)
            .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
            .opacity(configuration.isPressed ? 0.6 : 1.0)
    }
}

/// Screen background — warm cream ground, extends under safe areas.
struct GroundBackground: View {
    var body: some View {
        ACXColor.ground.ignoresSafeArea()
    }
}
