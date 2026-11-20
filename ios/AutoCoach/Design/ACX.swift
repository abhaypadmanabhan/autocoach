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

    // MARK: - Legibility floors
    //
    // Every size below is clamped. The house UI-UX rules ban "type at 11-13px across
    // the whole page" as the single most-cited legibility complaint in review, with
    // floors of 18px body / 15px minimum / 13.5px mono. Those numbers are written for
    // web CSS pixels; on iOS the layout unit is points and the platform's own body
    // default is 17pt, so they are adapted rather than copied:
    //
    //   mono    >= 13pt  (== the system .footnote size; 13.5 rounded to the platform step)
    //   body    >= 15pt
    //   display >= 20pt
    //
    // Clamping here rather than documenting it means a feature lane physically cannot
    // ship an 11pt label. Dynamic Type still scales everything up from these floors
    // via `relativeTo:`.
    static let monoFloor: CGFloat = 13
    static let bodyFloor: CGFloat = 15
    static let displayFloor: CGFloat = 20

    /// Space Mono for ALL data text (numbers, IDs, kickers, scores).
    static func mono(_ size: CGFloat, relativeTo: Font.TextStyle = .footnote) -> Font {
        .custom(Face.monoRegular, size: max(size, monoFloor), relativeTo: relativeTo)
    }
    static func monoBold(_ size: CGFloat, relativeTo: Font.TextStyle = .footnote) -> Font {
        .custom(Face.monoBold, size: max(size, monoFloor), relativeTo: relativeTo)
    }
    /// Inter for body copy.
    static func body(_ size: CGFloat = 17, relativeTo: Font.TextStyle = .body) -> Font {
        .custom(Face.bodyRegular, size: max(size, bodyFloor), relativeTo: relativeTo)
    }
    static func bodyMedium(_ size: CGFloat = 17, relativeTo: Font.TextStyle = .body) -> Font {
        .custom(Face.bodyMedium, size: max(size, bodyFloor), relativeTo: relativeTo)
    }
    static func bodySemibold(_ size: CGFloat = 17, relativeTo: Font.TextStyle = .body) -> Font {
        .custom(Face.bodySemibold, size: max(size, bodyFloor), relativeTo: relativeTo)
    }
    /// Space Grotesk for display/headings.
    static func display(_ size: CGFloat, relativeTo: Font.TextStyle = .largeTitle) -> Font {
        .custom(Face.displayBold, size: max(size, displayFloor), relativeTo: relativeTo)
    }
    static func displayMedium(_ size: CGFloat, relativeTo: Font.TextStyle = .largeTitle) -> Font {
        .custom(Face.displayMedium, size: max(size, displayFloor), relativeTo: relativeTo)
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

/// 1px hairline divider on cream (scaled for display).
struct Hairline: View {
    @Environment(\.displayScale) private var displayScale
    var body: some View {
        Rectangle()
            .fill(ACXColor.surface)
            .frame(height: 1 / displayScale)
    }
}

/// A status mark whose **form** carries the state and whose **colour** carries urgency.
///
/// House UI-UX rules name "a row of coloured status dots" as the single most-recognisable
/// AI-generated tell: nothing about green *means* finished, so the colour is decoration
/// wearing a semantic costume. The counter-move is that each state gets a distinguishable
/// shape, and exactly one state — the one that needs a human — is allowed to be coloured.
///
/// Padzy OS still gets its "mono text + mark" pill; only the mark's vocabulary widened.
/// This also makes the pill legible to colour-blind users and in a greyscale screenshot.
struct StatusMark: View {
    /// Named `Kind`, not `State` — a nested type called `State` shadows SwiftUI's
    /// `@State` property wrapper inside the same type and fails to compile.
    enum Kind: Equatable {
        case pending      // present, not started      -> hollow ring
        case processing   // actively doing something  -> level bars
        case ready        // finished                  -> hairline check
        case failed       // needs a human             -> the ONLY coloured mark
        case unknown      // could not be identified   -> dashed ring
    }

    let kind: Kind
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animating = false

    init(_ kind: Kind) { self.kind = kind }

    private static let side: CGFloat = 8

    var body: some View {
        Group {
            switch kind {
            case .pending:
                Circle().strokeBorder(ACXColor.muted, lineWidth: 1)
            case .processing:
                HStack(spacing: 1.5) {
                    ForEach(0..<3, id: \.self) { i in
                        Rectangle()
                            .fill(ACXColor.ink)
                            .frame(width: 1.5, height: barHeight(i))
                    }
                }
                .frame(width: Self.side, height: Self.side)
            case .ready:
                Check().stroke(ACXColor.ink, lineWidth: 1.25)
            case .failed:
                // Deliberately the one coloured mark in the whole app.
                Rectangle().fill(ACXColor.error)
            case .unknown:
                Circle().strokeBorder(
                    ACXColor.muted,
                    style: StrokeStyle(lineWidth: 1, dash: [1.5, 1.5])
                )
            }
        }
        .frame(width: Self.side, height: Self.side)
        .onAppear { if kind == .processing && !reduceMotion { animating = true } }
        .animation(
            reduceMotion ? nil : .easeInOut(duration: 0.6).repeatForever(autoreverses: true),
            value: animating
        )
        .accessibilityHidden(true)   // the adjacent label already says it
    }

    /// Static staggered heights when Reduce Motion is on, so the shape still differs
    /// from every other state without moving.
    private func barHeight(_ i: Int) -> CGFloat {
        let base: [CGFloat] = [4, 8, 6]
        guard animating && !reduceMotion else { return base[i] }
        return [8, 4, 7][i]
    }

    private struct Check: Shape {
        func path(in r: CGRect) -> Path {
            var p = Path()
            p.move(to: CGPoint(x: r.minX, y: r.midY))
            p.addLine(to: CGPoint(x: r.minX + r.width * 0.35, y: r.maxY))
            p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
            return p
        }
    }
}

/// StatusPill — mono label + status mark.
struct StatusPill: View {
    let text: String
    let kind: StatusMark.Kind

    /// Semantic initialiser — prefer this.
    init(_ text: String, state kind: StatusMark.Kind) {
        self.text = text
        self.kind = kind
    }

    /// Maps a raw `DocumentResponse.status` string onto the semantic states.
    init(documentStatus: String) {
        self.text = documentStatus.prefix(1).uppercased() + documentStatus.dropFirst().lowercased()
        switch documentStatus.lowercased() {
        case "pending":    self.kind = .pending
        case "processing": self.kind = .processing
        case "ready":      self.kind = .ready
        case "failed":     self.kind = .failed
        default:           self.kind = .unknown
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            StatusMark(kind)
            Text(text)
                .font(ACXFont.body(15))
                .foregroundStyle(kind == .failed ? ACXColor.error : ACXColor.muted)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }
}

/// TagPill — mono metadata label with **no** status mark.
///
/// Difficulty, question type and similar descriptors are metadata, not state. Giving them
/// a status mark is exactly the "colour wearing a semantic costume" failure, so they get
/// a bordered label instead and leave the mark vocabulary meaning something.
struct TagPill: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(ACXFont.mono(13))
            .foregroundStyle(ACXColor.muted)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .overlay(Rectangle().stroke(ACXColor.surface, lineWidth: 1))
    }
}

/// Primary CTA — zero radius, ink border, accent fill, hard offset shadow.
/// Tapping scales down 2% (Reduce Motion-safe: no spring, instant snap).
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            // Body face, sentence case. Mono + forced uppercase made every
            // button shout and read as a terminal, not a product.
            .font(ACXFont.bodySemibold(17))
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
            .font(ACXFont.bodySemibold(17))
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

// MARK: - Titles and section labels

/// Screen title. One per screen, in the display face.
///
/// Replaces the numbered mono kicker (`01 / TODAY`). Those read as generated —
/// no shipping product labels its screens like chapters — and they were also
/// redundant with the navigation title, so "Settings" appeared three times on
/// one screen. A screen gets a title or it gets nothing.
struct ScreenTitle: View {
    let text: String
    var subtitle: String?
    init(_ text: String, subtitle: String? = nil) {
        self.text = text
        self.subtitle = subtitle
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(text)
                .font(ACXFont.display(30, relativeTo: .largeTitle))
                .foregroundStyle(ACXColor.ink)
            if let subtitle {
                Text(subtitle)
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
            }
        }
        .accessibilityAddTraits(.isHeader)
    }
}

/// Quiet group caption above a set of rows — sentence case, body face, muted.
///
/// Deliberately *not* uppercase mono: mono is for data, and shouting a label in
/// tracked uppercase is the same tell as the numbered kicker. Use only when a
/// group genuinely needs naming; most groups do not.
struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(ACXFont.bodyMedium(15))
            .foregroundStyle(ACXColor.muted)
            .accessibilityAddTraits(.isHeader)
    }
}

/// A settings-style row: label on the left, value or control on the right,
/// separated by hairlines rather than boxed in a border.
///
/// The previous screens rendered every control as a full-width bordered block,
/// which reads as a brutalised web form rather than an iOS screen.
struct ACXRow<Trailing: View>: View {
    let label: String
    var detail: String?
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(ACXFont.body(17))
                    .foregroundStyle(ACXColor.ink)
                if let detail {
                    Text(detail)
                        .font(ACXFont.body(15))
                        .foregroundStyle(ACXColor.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 8)
            trailing
        }
        .frame(minHeight: 44)   // platform hit-target floor
    }
}

extension ACXRow where Trailing == EmptyView {
    init(label: String, detail: String? = nil) {
        self.label = label
        self.detail = detail
        self.trailing = EmptyView()
    }
}

/// Compact credits indicator — pips plus `used / total`, sized to sit inline in a
/// header row rather than owning a full-width block of its own.
struct CreditsInline: View {
    let used: Int
    let total: Int
    private var remaining: Int { max(0, total - used) }

    var body: some View {
        HStack(spacing: 6) {
            CreditPips(used: used, total: total, cell: 7, spacing: 3)
            Text("\(remaining)")
                .font(ACXFont.monoBold(13))
                .foregroundStyle(remaining == 0 ? ACXColor.error : ACXColor.ink)
                .monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(remaining) of \(total) quiz credits left")
    }
}
