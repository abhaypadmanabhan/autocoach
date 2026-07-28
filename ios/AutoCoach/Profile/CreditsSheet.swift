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
                                Text("Quiz credits")
                    .font(ACXFont.displayMedium(24))
                    .foregroundStyle(ACXColor.ink)
            }
            Spacer(minLength: 0)
            Button {
                dismiss()
            } label: {
                Text("Close")
                    .font(ACXFont.bodySemibold(15))
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

    /// Credits, reset clock and XP as one continuous block.
    ///
    /// This was four numbered sections — `01 / TODAY`, `02 / RESET`, `03 / XP`,
    /// `04 / FREE PATH` — for what is four lines of information. Chapter markers
    /// on a sheet this small are pure ceremony.
    private var creditsBlock: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(remaining) of \(allowance) left")
                        .font(ACXFont.display(24))
                        .foregroundStyle(ACXColor.ink)
                    Text(resetLabel)
                        .font(ACXFont.body(15))
                        .foregroundStyle(ACXColor.muted)
                }
                Spacer(minLength: 0)
                CreditPips(used: pipUsed, total: pipTotal, cell: 12, spacing: 5)
            }
            .accessibilityElement(children: .combine)

            Hairline()

            ACXRow(label: "XP balance", detail: xp < 100 ? "Need \(100 - xp) more to redeem" : "Enough for one extra quiz") {
                Text("\(xp)")
                    .font(ACXFont.monoBold(20))
                    .monospacedDigit()
                    .foregroundStyle(ACXColor.ink)
            }

            Button {
                Task { await redeem() }
            } label: {
                Text(redeeming ? "Redeeming…" : "Redeem 100 XP for a quiz")
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!canRedeem)
            .opacity(canRedeem ? 1 : 0.45)
            .accessibilityHint(xp < 100 ? "Need 100 XP to redeem" : "Spend 100 XP for one extra quiz credit")
        }
    }

    private var reviewBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Free path")
            Hairline()
            Text("Review sessions don't use credits.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.ink)
            if let onStartReview {
                Button("Start a review") {
                    dismiss()
                    onStartReview()
                }
                .buttonStyle(GhostButtonStyle())
                .accessibilityHint("Opens today's review queue without spending a credit")
            } else {
                Text("Open Today and tap Start review — still free.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
            }
        }
    }

    @ViewBuilder
    private var stateFootnote: some View {
        switch phase {
        case .offline(let message):
            EmptyState(
                kicker: "Offline",
                message: message,
                actionLabel: "Dismiss",
                action: { phase = .ready }
            )
        case .quotaExhausted:
            EmptyState(
                kicker: "Quota used",
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
