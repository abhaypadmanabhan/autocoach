import SwiftUI
import UserNotifications

/// Settings (PRD §5.12) — reminders, password reset, analytics, legal, sign out.
struct SettingsView: View {
    let auth: AuthStore

    @Environment(\.openURL) private var openURL

    @State private var studyTime: StudyTime = ProfileSettingsStore.studyTime
    @State private var daysPerWeek: Int = ProfileSettingsStore.daysPerWeek
    @State private var reminderEnabled: Bool = ProfileSettingsStore.reminderEnabled
    @State private var analyticsOptedOut: Bool = ProfileSettingsStore.analyticsOptedOut
    @State private var permissionDenied = false
    @State private var reminderStatusLine: String?
    @State private var passwordBusy = false
    @State private var passwordLine: String?
    @State private var confirmSignOut = false
    @State private var toast: ACXToast?

    private var buildFooter: String {
        let short = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
        return "AUTOCOACH \(short) (\(build))"
    }

    var body: some View {
        ZStack {
            GroundBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    reminderBlock
                    securityBlock
                    analyticsBlock
                    legalBlock
                    accountBlock
                    footer
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .scrollContentBackground(.hidden)

            if confirmSignOut {
                ACXConfirmDialog(
                    title: "SIGN OUT",
                    message: "You'll need your email and password (or Apple) to get back in. Local streak stays on this device.",
                    confirmLabel: "SIGN OUT",
                    onConfirm: {
                        confirmSignOut = false
                        Task { await auth.signOut() }
                    },
                    onCancel: { confirmSignOut = false }
                )
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(ACXColor.ground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .acxToast($toast)
        .task { await refreshPermissionFlag() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker("04 / SETTINGS")
            Hairline()
            Text("Settings")
                .font(ACXFont.display(28))
                .foregroundStyle(ACXColor.ink)
                .padding(.top, 6)
            Text("STREAK IS STORED ON THIS DEVICE")
                .font(ACXFont.mono(13))
                .foregroundStyle(ACXColor.muted)
        }
        .padding(.top, 16)
    }

    private var reminderBlock: some View {
        VStack(alignment: .leading, spacing: 14) {
            Kicker("01 / STUDY REMINDER")
            Hairline()
            Text("One local notification a day. No APNs, no server.")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.muted)

            Toggle(isOn: $reminderEnabled) {
                Text("ENABLED")
                    .font(ACXFont.monoBold(13))
                    .foregroundStyle(ACXColor.ink)
            }
            .tint(ACXColor.accent)
            .frame(minHeight: 44)
            .onChange(of: reminderEnabled) { _, enabled in
                ProfileSettingsStore.reminderEnabled = enabled
                Task { await applyReminder() }
            }
            .accessibilityLabel("Study reminder enabled")

            Text("TIME")
                .font(ACXFont.mono(13))
                .foregroundStyle(ACXColor.muted)
            SegmentedControl(
                segments: StudyTime.allCases.map { .init($0, $0.title) },
                selection: $studyTime,
                accessibilityTitle: "Reminder time"
            )
            .onChange(of: studyTime) { _, value in
                ProfileSettingsStore.studyTime = value
                Task { await applyReminder() }
            }

            HStack {
                Text("DAYS / WEEK")
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.muted)
                Spacer()
                Text("\(daysPerWeek)")
                    .font(ACXFont.monoBold(18))
                    .foregroundStyle(ACXColor.ink)
                    .frame(minWidth: 32, alignment: .trailing)
            }
            .frame(minHeight: 44)

            HStack(spacing: 10) {
                Button {
                    daysPerWeek = max(1, daysPerWeek - 1)
                    ProfileSettingsStore.daysPerWeek = daysPerWeek
                    Task { await applyReminder() }
                } label: {
                    Text("−")
                        .font(ACXFont.monoBold(20))
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 44)
                }
                .buttonStyle(GhostButtonStyle())
                .accessibilityLabel("Fewer days")

                Button {
                    daysPerWeek = min(7, daysPerWeek + 1)
                    ProfileSettingsStore.daysPerWeek = daysPerWeek
                    Task { await applyReminder() }
                } label: {
                    Text("+")
                        .font(ACXFont.monoBold(20))
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 44)
                }
                .buttonStyle(GhostButtonStyle())
                .accessibilityLabel("More days")
            }

            if permissionDenied {
                Text("Notifications are off for AutoCoach. Reminders won't fire until you enable them in iOS Settings — this screen still works.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let reminderStatusLine {
                Text(reminderStatusLine)
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.muted)
            }
        }
    }

    private var securityBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("02 / SECURITY")
            Hairline()
            Text(auth.email ?? "No email on this account")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.ink)

            Button {
                Task { await sendPasswordReset() }
            } label: {
                Text(passwordBusy ? "SENDING…" : "CHANGE PASSWORD")
            }
            .buttonStyle(GhostButtonStyle())
            .disabled(passwordBusy || auth.email == nil)
            .accessibilityHint("Sends a password reset email")

            if let passwordLine {
                Text(passwordLine)
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.muted)
            }
        }
    }

    private var analyticsBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("03 / ANALYTICS")
            Hairline()
            Toggle(isOn: Binding(
                get: { !analyticsOptedOut },
                set: { enabled in
                    analyticsOptedOut = !enabled
                    ProfileSettingsStore.analyticsOptedOut = !enabled
                    toast = .info(enabled ? "Analytics on." : "Analytics opted out on this device.")
                }
            )) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("PRODUCT ANALYTICS")
                        .font(ACXFont.monoBold(13))
                        .foregroundStyle(ACXColor.ink)
                    Text("Opt out stops local analytics flags. No PostHog ship on iOS yet.")
                        .font(ACXFont.body(15))
                        .foregroundStyle(ACXColor.muted)
                }
            }
            .tint(ACXColor.accent)
            .frame(minHeight: 44)
        }
    }

    private var legalBlock: some View {
        VStack(alignment: .leading, spacing: 0) {
            Kicker("04 / LEGAL")
            Hairline()
                .padding(.top, 10)
                .padding(.bottom, 8)

            NavigationLink {
                TermsView()
            } label: {
                settingsRow("TERMS OF SERVICE")
            }
            .buttonStyle(.plain)

            NavigationLink {
                PrivacyView()
            } label: {
                settingsRow("PRIVACY POLICY")
            }
            .buttonStyle(.plain)
        }
    }

    private var accountBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("05 / ACCOUNT")
            Hairline()

            Button {
                confirmSignOut = true
            } label: {
                Text("SIGN OUT")
                    .font(ACXFont.monoBold(14))
                    .kerning(0.4)
                    .foregroundStyle(ACXColor.error)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(ACXColor.ground)
                    .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 2))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Sign out")

            Button {
                if let url = URL(string: "https://autocoach-rho.vercel.app/settings") {
                    openURL(url)
                }
            } label: {
                Text("DELETE ACCOUNT ON WEB →")
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the web app to request account deletion")
        }
    }

    private var footer: some View {
        Text(buildFooter)
            .font(ACXFont.mono(13))
            .foregroundStyle(ACXColor.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 8)
            .accessibilityLabel("Build version \(buildFooter)")
    }

    private func settingsRow(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(ACXFont.monoBold(13))
                .foregroundStyle(ACXColor.ink)
            Spacer()
            Text("→")
                .font(ACXFont.mono(13))
                .foregroundStyle(ACXColor.muted)
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }

    @MainActor
    private func applyReminder() async {
        if !reminderEnabled {
            await StudyReminderScheduler.cancelAll()
            reminderStatusLine = "Reminders cancelled."
            permissionDenied = false
            return
        }

        let granted = await StudyReminderScheduler.requestAuthorization()
        if !granted {
            permissionDenied = true
            reminderStatusLine = "Permission denied — nothing scheduled."
            // Do not break the screen; prefs still save.
            return
        }
        permissionDenied = false
        let count = await StudyReminderScheduler.schedule(time: studyTime, daysPerWeek: daysPerWeek)
        reminderStatusLine = "Scheduled \(count) weekly reminder\(count == 1 ? "" : "s") at \(studyTime.clockLabel)."
    }

    @MainActor
    private func refreshPermissionFlag() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        permissionDenied = settings.authorizationStatus == .denied
    }

    @MainActor
    private func sendPasswordReset() async {
        guard let email = auth.email else { return }
        passwordBusy = true
        defer { passwordBusy = false }
        let outcome = await auth.sendPasswordReset(email: email)
        switch outcome {
        case .sent:
            passwordLine = "Reset email sent to \(email)."
            toast = .success("Check your inbox.")
        case .rateLimited:
            passwordLine = "Wait a moment, then try again."
            toast = .info("Email send rate-limited.")
        case .failed(let message):
            passwordLine = message
            toast = .error(message)
        }
    }
}
