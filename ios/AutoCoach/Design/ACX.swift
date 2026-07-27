import SwiftUI
import UIKit

/// Padzy OS / "Quiet Brutalism" design tokens → SwiftUI (research §5).
///
/// Typography is the **bundled** Space Grotesk / Inter / Space Mono (OFL), not a
/// system fallback — see `ACXFont.Face` for the verified PostScript names.
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
    /// Verified PostScript names for the TTFs in `Resources/Fonts/`.
    ///
    /// Space Grotesk and Inter ship from Google Fonts as **variable** faces, and
    /// their named instances carry the default instance as a prefix — the bold
    /// Space Grotesk instance really is called `SpaceGrotesk-Light_Bold`. These
    /// strings were read back out of the actual files via
    /// `CTFontManagerCreateFontDescriptorsFromURL`; do not "tidy" them, a wrong
    /// name silently resolves to a system face with no build error.
    enum Face {
        static let displayRegular = "SpaceGrotesk-Light_Regular"
        static let displayMedium = "SpaceGrotesk-Light_Medium"
        static let displayBold = "SpaceGrotesk-Light_Bold"
        static let bodyRegular = "Inter-Regular"
        static let bodyMedium = "Inter-Regular_Medium"
        static let bodySemibold = "Inter-Regular_SemiBold"
        static let monoRegular = "SpaceMono-Regular"
        static let monoBold = "SpaceMono-Bold"
    }

    /// Space Mono for ALL data text (numbers, IDs, kickers, scores).
    static func mono(_ size: CGFloat, relativeTo: Font.TextStyle = .footnote) -> Font {
        .custom(Face.monoRegular, size: size, relativeTo: relativeTo)
    }
    static func monoBold(_ size: CGFloat, relativeTo: Font.TextStyle = .footnote) -> Font {
        .custom(Face.monoBold, size: size, relativeTo: relativeTo)
    }
    /// Inter for body copy.
    static func body(_ size: CGFloat = 17, relativeTo: Font.TextStyle = .body) -> Font {
        .custom(Face.bodyRegular, size: size, relativeTo: relativeTo)
    }
    static func bodyMedium(_ size: CGFloat = 17, relativeTo: Font.TextStyle = .body) -> Font {
        .custom(Face.bodyMedium, size: size, relativeTo: relativeTo)
    }
    static func bodySemibold(_ size: CGFloat = 17, relativeTo: Font.TextStyle = .body) -> Font {
        .custom(Face.bodySemibold, size: size, relativeTo: relativeTo)
    }
    /// Space Grotesk for display/headings.
    static func display(_ size: CGFloat, relativeTo: Font.TextStyle = .largeTitle) -> Font {
        .custom(Face.displayBold, size: size, relativeTo: relativeTo)
    }
    static func displayMedium(_ size: CGFloat, relativeTo: Font.TextStyle = .largeTitle) -> Font {
        .custom(Face.displayMedium, size: size, relativeTo: relativeTo)
    }

    /// Debug-only guard: proves the bundled faces actually registered rather than
    /// silently falling back to San Francisco. Called once from `AutoCoachApp`.
    static func assertBundledFacesResolve() {
        #if DEBUG
        let all = [
            Face.displayRegular, Face.displayMedium, Face.displayBold,
            Face.bodyRegular, Face.bodyMedium, Face.bodySemibold,
            Face.monoRegular, Face.monoBold,
        ]
        for name in all {
            guard let font = UIFont(name: name, size: 12) else {
                assertionFailure("ACXFont: bundled face '\(name)' did not register — check UIAppFonts in project.yml")
                continue
            }
            // `UIFont(name:)` returns a font even for a near-miss family match, so
            // compare the resolved PostScript name rather than just non-nil.
            print("[ACXFont] \(name) -> \(font.fontName)\(font.fontName == name ? "" : "  ⚠️ MISMATCH")")
        }
        #endif
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
