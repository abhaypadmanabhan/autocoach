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
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showSettings = true
                } label: {
                    Text("SETTINGS")
                        .font(ACXFont.monoBold(13))
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
            Kicker("03 / PROFILE")
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
            Kicker("01 / ACCOUNT")
            Hairline()
            labeled("EMAIL", value: email)
            labeled("MEMBER SINCE", value: memberSince)
        }
    }

    @ViewBuilder
    private var stateBody: some View {
        switch loadState {
        case .loading:
            VStack(alignment: .leading, spacing: 10) {
                Kicker("02 / MASTERY")
                Hairline()
                Text("Loading mastery…")
                    .font(ACXFont.mono(13))
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
                actionLabel: "RETRY",
                action: { Task { await load() } }
            )
        case .offline(let message):
            EmptyState(
                kicker: "OFFLINE",
                message: message,
                actionLabel: "RETRY",
                action: { Task { await load() } }
            )
        case .quotaExhausted:
            EmptyState(
                kicker: "QUOTA USED",
                message: "Daily quiz credits are spent. Review sessions stay free — or redeem XP.",
                actionLabel: "OPEN CREDITS",
                action: { showCredits = true }
            )
            masteryBlock
        case .ready:
            masteryBlock
        }
    }

    private var masteryBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("02 / MASTERY")
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
            MasteryBar(percent: aggregateMastery, label: "AGGREGATE")
        }
    }

    private var creditsRow: some View {
        Button {
            showCredits = true
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                Kicker("03 / CREDITS")
                Hairline()
                HStack {
                    Text("\(creditsUsed) / \(creditsAllowance)")
                        .font(ACXFont.monoBold(18))
                        .foregroundStyle(ACXColor.ink)
                    Spacer(minLength: 0)
                    CreditPips(used: min(creditsUsed, max(5, creditsAllowance)), total: max(5, creditsAllowance))
                }
                Text("TAP FOR RESET CLOCK + REDEEM")
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.muted)
            }
            .padding(.vertical, 4)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(ACXColor.accent)
                    .frame(width: 2)
            }
            .padding(.leading, 10)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Credits \(creditsUsed) of \(creditsAllowance). Opens credits sheet.")
        .frame(minHeight: 44)
    }

    private var streakBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("04 / STREAK")
            Hairline()
            HStack(alignment: .firstTextBaseline) {
                Text("\(streak.count)")
                    .font(ACXFont.monoBold(36))
                    .foregroundStyle(ACXColor.ink)
                Text(streak.count == 1 ? "DAY" : "DAYS")
                    .font(ACXFont.monoBold(13))
                    .foregroundStyle(ACXColor.muted)
                Spacer(minLength: 0)
                if streak.freezeAvailable {
                    TagPill("FREEZE READY")
                }
            }
            WeekStrip(activeDays: streak.activeDays, todayIndex: todayIndex)
            Text("STREAK IS STORED ON THIS DEVICE")
                .font(ACXFont.mono(13))
                .foregroundStyle(ACXColor.muted)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Streak \(streak.count) days")
    }

    private var xpRow: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("05 / XP")
            Hairline()
            HStack {
                Text("\(xp)")
                    .font(ACXFont.monoBold(28))
                    .foregroundStyle(ACXColor.ink)
                Spacer(minLength: 0)
                Button("REDEEM") { showCredits = true }
                    .buttonStyle(GhostButtonStyle())
                    .frame(maxWidth: 140)
                    .accessibilityLabel("Open redeem sheet")
            }
        }
    }

    private func labeled(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(ACXFont.mono(13))
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
