import SwiftUI

/// Onboarding entry point (design PRD §5.4).
///
/// Four questions, one per screen, then a notification prime. A thin 2px accent
/// progress bar is pinned to the top next to a back chevron; Continue is a ghost
/// button until a selection exists; every step carries a visible Skip.
///
/// Completing — or skipping — the flow POSTs **once** with all four fields and
/// calls `onComplete`. The gate that decides whether this view is shown at all
/// lives in `RootView` and reads `GET /onboarding` → `has_completed`.
struct OnboardingFlowView: View {
    @State private var store: OnboardingStore
    private let onComplete: () -> Void

    init(api: APIClient, onComplete: @escaping () -> Void) {
        _store = State(initialValue: OnboardingStore(api: api))
        self.onComplete = onComplete
    }

    var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                currentStep
                    .padding(.horizontal, 24)
                    .padding(.top, 24)
                    .padding(.bottom, 32)
            }
            .scrollDismissesKeyboard(.interactively)

            footer
        }
        .background(GroundBackground())
        .accessibilityElement(children: .contain)
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    store.back()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(store.canGoBack ? ACXColor.ink : ACXColor.muted)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!store.canGoBack || store.isSubmitting)
                .opacity(store.canGoBack ? 1 : 0.3)
                .accessibilityLabel("Back")

                ProgressHairline(value: store.progress, height: 2)

                // Balances the chevron so the bar stays optically centred.
                Color.clear.frame(width: 12, height: 1)
            }
            .padding(.horizontal, 12)
            .padding(.top, 4)
        }
    }

    // MARK: - Steps

    @ViewBuilder
    private var currentStep: some View {
        switch store.page {
        case .topics:
            TopicsStep(store: store)
        case .experience:
            ExperienceStep(store: store)
        case .goal:
            GoalStep(store: store)
        case .cadence:
            CadenceStep(store: store)
        case .notificationPrime:
            NotificationPrimeStep(store: store) {
                Task { await finish() }
            }
        }
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: 12) {
            if let error = store.submitError {
                // A designed state, not a system alert — the user keeps every
                // answer and retries in place.
                VStack(alignment: .leading, spacing: 6) {
                    Text("COULDN'T SAVE")
                        .font(ACXFont.monoBold(13))
                        .foregroundStyle(ACXColor.error)
                    Text(error)
                        .font(ACXFont.body(15))
                        .foregroundStyle(ACXColor.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .overlay(Rectangle().stroke(ACXColor.error, lineWidth: 1))
                .accessibilityElement(children: .combine)
            }

            if store.page != .notificationPrime {
                continueButton
            }

            skipButton
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private var continueButton: some View {
        let label = store.isSubmitting ? "SAVING…" : "CONTINUE"
        if store.hasSelection {
            Button(label) { Task { await advance() } }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(store.isSubmitting)
        } else {
            // Ghost until a selection exists — the PRD's disabled treatment.
            Button(label) {}
                .buttonStyle(GhostButtonStyle())
                .disabled(true)
                .opacity(0.4)
                .accessibilityHint("Choose an option to continue")
        }
    }

    private var skipButton: some View {
        Button {
            Task { await skip() }
        } label: {
            Text(store.page == .notificationPrime ? "MAYBE LATER" : "SKIP THIS QUESTION")
                .font(ACXFont.monoBold(13))
                .kerning(0.6)
                .foregroundStyle(ACXColor.muted)
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(store.isSubmitting)
    }

    // MARK: - Flow control

    private func advance() async {
        store.dismissError()
        if store.advance() { await finish() }
    }

    private func skip() async {
        store.dismissError()
        if store.skipCurrent() { await finish() }
    }

    /// The single POST. `onComplete` only fires once the server has the row —
    /// otherwise the next launch's `has_completed` probe would send the user
    /// straight back through the flow they just did.
    private func finish() async {
        if await store.submit() { onComplete() }
    }
}

#Preview("Onboarding") {
    // No live client in a preview; the flow is driven entirely by local state
    // until the final POST, so the steps render without one.
    Text("OnboardingFlowView requires a live APIClient")
        .font(ACXFont.mono(13))
        .foregroundStyle(ACXColor.muted)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(GroundBackground())
}
