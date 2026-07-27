import SwiftUI

/// Transient + confirming overlays (design PRD §7). Zero radius, ink-bordered,
/// no material and no blur — a flat ground panel with a hard border instead.

// MARK: - ACXToast

/// Brief status message pinned to the bottom of a screen.
///
/// Presented through `.acxToast(_:)` so callers only own a binding. Auto-dismiss
/// is driven by a `.task` keyed on the toast identity, so re-showing restarts
/// the timer and dismissal never fires against a stale toast.
struct ACXToast: Equatable, Identifiable, Sendable {
    enum Kind: Equatable, Sendable { case info, success, error }

    let id: UUID
    var message: String
    var kind: Kind

    init(id: UUID = UUID(), message: String, kind: Kind = .info) {
        self.id = id
        self.message = message
        self.kind = kind
    }

    static func success(_ message: String) -> ACXToast { .init(message: message, kind: .success) }
    static func error(_ message: String) -> ACXToast { .init(message: message, kind: .error) }
    static func info(_ message: String) -> ACXToast { .init(message: message, kind: .info) }
}

struct ACXToastView: View {
    let toast: ACXToast

    private var mark: StatusMark.Kind {
        switch toast.kind {
        case .info: .pending
        case .success: .ready
        case .error: .failed
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            StatusMark(mark)
            Text(toast.message)
                .font(ACXFont.body(14))
                .foregroundStyle(ACXColor.ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(ACXColor.ground)
        .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
    }
}

private struct ACXToastModifier: ViewModifier {
    @Binding var toast: ACXToast?
    var duration: Duration

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottom) {
                if let toast {
                    ACXToastView(toast: toast)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)
                        .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                        // Keyed on `toast.id`: a new toast cancels the previous
                        // timer instead of inheriting its remaining time.
                        .task(id: toast.id) {
                            try? await Task.sleep(for: duration)
                            guard !Task.isCancelled else { return }
                            self.toast = nil
                        }
                }
            }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: toast)
    }
}

extension View {
    /// Present a bottom toast, auto-dismissing after `duration`.
    func acxToast(_ toast: Binding<ACXToast?>, duration: Duration = .seconds(3)) -> some View {
        modifier(ACXToastModifier(toast: toast, duration: duration))
    }
}

// MARK: - ACXConfirmDialog

/// Blocking confirm panel for destructive actions (delete document, sign out).
///
/// Deliberately *not* SwiftUI's `.confirmationDialog`, which renders a rounded
/// system sheet and would break the zero-radius rule.
struct ACXConfirmDialog: View {
    let title: String
    let message: String
    var confirmLabel: String = "CONFIRM"
    var cancelLabel: String = "CANCEL"
    var isDestructive: Bool = true
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        ZStack {
            // Flat scrim — opacity only, never a material.
            ACXColor.ink.opacity(0.35)
                .ignoresSafeArea()
                .onTapGesture(perform: onCancel)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 14) {
                SectionLabel(title)
                Hairline()
                Text(message)
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.ink)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 10) {
                    Button(cancelLabel, action: onCancel)
                        .buttonStyle(GhostButtonStyle())
                    Button(confirmLabel, action: onConfirm)
                        .buttonStyle(DestructiveButtonStyle(isDestructive: isDestructive))
                }
                .padding(.top, 4)
            }
            .padding(18)
            .background(ACXColor.ground)
            .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
            .padding(.horizontal, 28)
        }
    }
}

/// Confirm button for the dialog. Destructive uses `ErrorRed` — which is the one
/// accent-equivalent visible in a confirm overlay, so the underlying screen's
/// accent is covered by the scrim and the one-accent rule still holds.
struct DestructiveButtonStyle: ButtonStyle {
    var isDestructive: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(ACXFont.monoBold(14))
            .kerning(0.4)
            .textCase(.uppercase)
            .foregroundStyle(ACXColor.ground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(isDestructive ? ACXColor.error : ACXColor.accent)
            .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
            .opacity(configuration.isPressed ? 0.7 : 1.0)
    }
}

#Preview("ACXToast") {
    struct Harness: View {
        @State private var toast: ACXToast?
        var body: some View {
            VStack(spacing: 12) {
                Button("SHOW SUCCESS") { toast = .success("Document uploaded.") }
                    .buttonStyle(GhostButtonStyle())
                Button("SHOW ERROR") { toast = .error("Upload failed. Try again.") }
                    .buttonStyle(GhostButtonStyle())
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .background(GroundBackground())
            .acxToast($toast)
        }
    }
    return Harness()
}

#Preview("ACXConfirmDialog") {
    ZStack {
        VStack { Text("Underlying screen").font(ACXFont.body()) }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(GroundBackground())
        ACXConfirmDialog(
            title: "DELETE DOCUMENT",
            message: "This removes the document, its concepts and every quiz session built from it. This cannot be undone.",
            confirmLabel: "DELETE",
            onConfirm: {},
            onCancel: {}
        )
    }
}
