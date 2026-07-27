import SwiftUI

/// Credits sheet (PRD §5.11) — centrepiece for quota + XP redeem.
///
/// Independently presentable from Profile and from any daily-quota 429.
/// A 429 must open this sheet, never an alert. Framing: anticipation, not denial.
struct CreditsSheet: View {
    let api: APIClient
    /// Optional seed when opened from a 429 whose `limit` is known.
    var quotaLimitFrom429: Int? = nil
    /// Jump into a free review session (caller owns navigation).
    var onStartReview: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss

    @State private var xp: Int = ProfileBalanceCache.totalXP
    @State private var used: Int = ProfileBalanceCache.quizzesUsed
    @State private var allowance: Int = ProfileBalanceCache.dailyAllowance
    @State private var resetLabel: String = CreditsResetCountdown.label()
    @State private var redeeming = false
    @State private var toast: ACXToast?
    @State private var phase: Phase = .ready

    private enum Phase: Equatable {
        case ready
        case offline(String)
        case quotaExhausted
    }

    private var pipTotal: Int { max(5, allowance) }
    private var pipUsed: Int { min(used, pipTotal) }
    private var remaining: Int { max(0, allowance - used) }
    private var canRedeem: Bool { xp >= 100 && !redeeming }

    var body: some View {
        ZStack {
            GroundBackground()

            VStack(alignment: .leading, spacing: 0) {
                header
                Hairline()
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        creditsBlock
                        resetBlock
                        xpBlock
                        reviewBlock
                        stateFootnote
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 20)
                    .padding(.bottom, 40)
                }
                .scrollContentBackground(.hidden)
            }
        }
        .acxToast($toast)
        .task {
            if let limit = quotaLimitFrom429 {
                ProfileBalanceCache.markQuotaExhausted(limit: limit)
            }
            reloadFromCache()
            if remaining <= 0 { phase = .quotaExhausted }
            // Tick the countdown once a minute.
            while !Task.isCancelled {
                resetLabel = CreditsResetCountdown.label()
                try? await Task.sleep(for: .seconds(30))
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Kicker("CREDITS")
                Text("Quiz credits")
                    .font(ACXFont.displayMedium(24))
                    .foregroundStyle(ACXColor.ink)
            }
            Spacer(minLength: 0)
            Button {
                dismiss()
            } label: {
                Text("CLOSE")
                    .font(ACXFont.monoBold(13))
                    .foregroundStyle(ACXColor.ink)
                    .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close credits")
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 14)
    }

    private var creditsBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("01 / TODAY")
            Hairline()
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("CREDITS")
                    .font(ACXFont.monoBold(13))
                    .foregroundStyle(ACXColor.muted)
                Spacer(minLength: 0)
                Text("\(used) / \(allowance)")
                    .font(ACXFont.monoBold(20))
                    .foregroundStyle(ACXColor.ink)
                    .accessibilityLabel("\(used) of \(allowance) credits used")
            }
            CreditPips(used: pipUsed, total: pipTotal)
                .padding(.top, 4)

            if phase == .quotaExhausted || remaining <= 0 {
                Text("Next quiz when the clock flips — or redeem XP below.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
            }
        }
    }

    private var resetBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Kicker("02 / RESET")
            Hairline()
            Text(resetLabel)
                .font(ACXFont.monoBold(18))
                .foregroundStyle(ACXColor.ink)
                .accessibilityLabel(resetLabel.lowercased())
            Text("Counted client-side from midnight UTC. No server clock required.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
        }
    }

    private var xpBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("03 / XP")
            Hairline()
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("XP")
                    .font(ACXFont.monoBold(13))
                    .foregroundStyle(ACXColor.muted)
                Spacer(minLength: 0)
                Text("\(xp)")
                    .font(ACXFont.monoBold(28))
                    .foregroundStyle(ACXColor.ink)
                    .accessibilityLabel("\(xp) experience points")
            }

            Button {
                Task { await redeem() }
            } label: {
                Text(redeeming ? "REDEEMING…" : "REDEEM 100 XP → +1 QUIZ")
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!canRedeem)
            .opacity(canRedeem ? 1 : 0.45)
            .accessibilityHint(xp < 100 ? "Need 100 XP to redeem" : "Spend 100 XP for one extra quiz credit")

            if xp < 100 {
                Text("Need \(100 - xp) more XP before you can redeem.")
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.muted)
            }
        }
    }

    private var reviewBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("04 / FREE PATH")
            Hairline()
            Text("Review sessions don't use credits.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.ink)
            if let onStartReview {
                Button("START A REVIEW") {
                    dismiss()
                    onStartReview()
                }
                .buttonStyle(GhostButtonStyle())
                .accessibilityHint("Opens today's review queue without spending a credit")
            } else {
                Text("Open Today and tap Start review — still free.")
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.muted)
            }
        }
    }

    @ViewBuilder
    private var stateFootnote: some View {
        switch phase {
        case .offline(let message):
            EmptyState(
                kicker: "OFFLINE",
                message: message,
                actionLabel: "DISMISS",
                action: { phase = .ready }
            )
        case .quotaExhausted:
            EmptyState(
                kicker: "QUOTA USED",
                message: "You've spent today's quizzes. The reset clock above is the next free slot — or redeem XP for one more now."
            )
        case .ready:
            EmptyView()
        }
    }

    private func reloadFromCache() {
        xp = ProfileBalanceCache.totalXP
        used = ProfileBalanceCache.quizzesUsed
        allowance = ProfileBalanceCache.dailyAllowance
        resetLabel = CreditsResetCountdown.label()
    }

    @MainActor
    private func redeem() async {
        guard canRedeem else { return }
        redeeming = true
        defer { redeeming = false }

        let result = await XPRedeemer.redeem(using: api)
        switch result {
        case .success(let response):
            ProfileBalanceCache.noteRedeemedCredit(newXP: response.new_total_xp)
            reloadFromCache()
            if remaining > 0 { phase = .ready }
            toast = .success(response.message.isEmpty
                ? "Redeemed. +\(response.credits_added) quiz credit."
                : response.message)
        case .failure(let err):
            switch err {
            case .insufficient(let have, _, let message):
                xp = have
                toast = .error(message)
            case .notFound(let message):
                toast = .error(message)
            case .conflict(let message):
                toast = .error(message)
            case .other(let message):
                let lower = message.lowercased()
                if lower.contains("network") || lower.contains("internet") || lower.contains("offline")
                    || lower.contains("connection") || lower.contains("timed out") {
                    phase = .offline(message)
                }
                toast = .error(message)
            }
        }
    }
}
