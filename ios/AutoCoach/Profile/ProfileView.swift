import SwiftUI

/// Profile tab (PRD §5.12) — email, member-since, aggregate mastery, XP, streak, credits.
struct ProfileView: View {
    let auth: AuthStore
    let api: APIClient

    @State private var loadState: LoadState = .loading
    @State private var documents: [DocumentProgress] = []
    @State private var streak = LocalStreakSnapshot.zero
    @State private var xp: Int = ProfileBalanceCache.totalXP
    @State private var creditsUsed: Int = ProfileBalanceCache.quizzesUsed
    @State private var creditsAllowance: Int = ProfileBalanceCache.dailyAllowance
    @State private var showCredits = false
    @State private var showSettings = false
    @State private var toast: ACXToast?

    private enum LoadState: Equatable {
        case loading
        case ready
        case empty
        case error(String)
        case offline(String)
        case quotaExhausted
    }

    private var email: String { auth.email ?? "—" }

    private var memberSince: String {
        guard let created = auth.supabase.auth.currentUser?.createdAt else {
            return "—"
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: created)
    }

    private var aggregateMastery: Int {
        guard !documents.isEmpty else { return 0 }
        let sum = documents.reduce(0) { $0 + $1.mastery_percent }
        return sum / documents.count
    }

    private var todayIndex: Int? {
        // WeekStrip is Monday-first (0 == Monday).
        var cal = Calendar.current
        cal.firstWeekday = 2
        let weekday = cal.component(.weekday, from: Date()) // 1=Sun…7=Sat
        // Convert to Monday-first index.
        return (weekday + 5) % 7
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header
                accountBlock
                stateBody
                creditsRow
                streakBlock
                xpRow
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
        .toolbarBackground(ACXColor.ground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showSettings = true
                } label: {
                    Text("Settings")
                        .font(ACXFont.bodySemibold(15))
                        .foregroundStyle(ACXColor.ink)
                        .frame(minHeight: 44)
                }
                .accessibilityLabel("Settings")
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showCredits) {
            CreditsSheet(api: api)
        }
        .navigationDestination(isPresented: $showSettings) {
            SettingsView(auth: auth)
        }
        .acxToast($toast)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScreenTitle("Profile")
            Hairline()
            Text("Profile")
                .font(ACXFont.display(28))
                .foregroundStyle(ACXColor.ink)
                .padding(.top, 6)
            Text("XP, credits, mastery, and the streak on this device.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
        }
        .padding(.top, 16)
    }

    private var accountBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel("Account")
            Hairline()
            labeled("Email", value: email)
            labeled("Member since", value: memberSince)
        }
    }

    @ViewBuilder
    private var stateBody: some View {
        switch loadState {
        case .loading:
            VStack(alignment: .leading, spacing: 10) {
                SectionLabel("Mastery")
                Hairline()
                Text("Loading mastery…")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                ProgressHairline(value: nil)
            }
        case .empty:
            EmptyState(
                kicker: "02 / MASTERY",
                message: "No documents yet. Upload one from Library and mastery will show up here.",
                showsCrosshair: true
            )
        case .error(let message):
            EmptyState(
                kicker: "02 / MASTERY",
                message: message,
                actionLabel: "Retry",
                action: { Task { await load() } }
            )
        case .offline(let message):
            EmptyState(
                kicker: "Offline",
                message: message,
                actionLabel: "Retry",
                action: { Task { await load() } }
            )
        case .quotaExhausted:
            EmptyState(
                kicker: "Quota used",
                message: "Daily quiz credits are spent. Review sessions stay free — or redeem XP.",
                actionLabel: "Open credits",
                action: { showCredits = true }
            )
            masteryBlock
        case .ready:
            masteryBlock
        }
    }

    private var masteryBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Mastery")
            Hairline()
            HStack(alignment: .firstTextBaseline) {
                Text("\(aggregateMastery)%")
                    .font(ACXFont.monoBold(36))
                    .foregroundStyle(ACXColor.ink)
                    .accessibilityLabel("Average mastery \(aggregateMastery) percent")
                Spacer(minLength: 0)
                Text("\(documents.count) DOCS")
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.muted)
            }
            MasteryBar(percent: aggregateMastery, label: "Aggregate")
        }
    }

    private var creditsRow: some View {
        // A tappable row, not a bordered panel with a green rule down its side.
        // The accent bar was decoration standing in for hierarchy, and a green
        // vertical line next to a number reads as a status it does not have.
        Button {
            showCredits = true
        } label: {
            ACXRow(
                label: "Quiz credits",
                detail: "Reset clock and XP redemption"
            ) {
                HStack(spacing: 10) {
                    CreditPips(
                        used: min(creditsUsed, max(5, creditsAllowance)),
                        total: max(5, creditsAllowance),
                        cell: 8, spacing: 4
                    )
                    Text("\(max(0, creditsAllowance - creditsUsed))")
                        .font(ACXFont.monoBold(17))
                        .monospacedDigit()
                        .foregroundStyle(ACXColor.ink)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(ACXColor.muted)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Quiz credits, \(max(0, creditsAllowance - creditsUsed)) of \(creditsAllowance) left. Opens credits.")
    }

    private var streakBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Streak")
            Hairline()
            HStack(alignment: .firstTextBaseline) {
                Text("\(streak.count)")
                    .font(ACXFont.monoBold(36))
                    .foregroundStyle(ACXColor.ink)
                Text(streak.count == 1 ? "DAY" : "Days")
                    .font(ACXFont.monoBold(13))
                    .foregroundStyle(ACXColor.muted)
                Spacer(minLength: 0)
                if streak.freezeAvailable {
                    TagPill("Freeze ready")
                }
            }
            WeekStrip(activeDays: streak.activeDays, todayIndex: todayIndex)
            Text("Streak is stored on this device")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Streak \(streak.count) days")
    }

    private var xpRow: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("XP")
            Hairline()
            HStack {
                Text("\(xp)")
                    .font(ACXFont.monoBold(28))
                    .foregroundStyle(ACXColor.ink)
                Spacer(minLength: 0)
                Button("Redeem") { showCredits = true }
                    .buttonStyle(GhostButtonStyle())
                    .frame(maxWidth: 140)
                    .accessibilityLabel("Open redeem sheet")
            }
        }
    }

    private func labeled(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)
            Text(value)
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.ink)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 4)
    }

    @MainActor
    private func load() async {
        loadState = .loading
        streak = LocalStreakSnapshot.read()
        await ProfileBalanceRefresh.refresh(supabase: auth.supabase)
        xp = ProfileBalanceCache.totalXP
        creditsUsed = ProfileBalanceCache.quizzesUsed
        creditsAllowance = ProfileBalanceCache.dailyAllowance

        if creditsUsed >= creditsAllowance && creditsAllowance > 0 {
            // Soft signal — still load mastery.
            // Quota exhausted is a designed state, not a hard stop on Profile.
        }

        do {
            let summary: DocumentProgressSummaryResponse = try await api.get("/documents/progress/summary")
            documents = summary.documents
            if documents.isEmpty {
                loadState = .empty
            } else if creditsUsed >= max(creditsAllowance, 5) && ProfileBalanceCache.quizzesUsed >= ProfileBalanceCache.dailyAllowance {
                loadState = .quotaExhausted
            } else {
                loadState = .ready
            }
        } catch let err as APIError {
            switch err {
            case .network(let message):
                loadState = .offline(message)
            case .dailyQuota(let limit, _):
                ProfileBalanceCache.markQuotaExhausted(limit: limit)
                creditsUsed = ProfileBalanceCache.quizzesUsed
                creditsAllowance = ProfileBalanceCache.dailyAllowance
                loadState = .quotaExhausted
                showCredits = true
            default:
                loadState = .error(err.localizedDescription)
            }
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}
