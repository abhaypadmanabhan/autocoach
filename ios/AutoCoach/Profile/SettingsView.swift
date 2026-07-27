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
                .padding(.top, 4)
                .padding(.bottom, 40)
            }
            .scrollContentBackground(.hidden)

            if confirmSignOut {
                ACXConfirmDialog(
                    title: "Sign out",
                    message: "You'll need your email and password (or Apple) to get back in. Local streak stays on this device.",
                    confirmLabel: "Sign out",
                    onConfirm: {
                        confirmSignOut = false
                        Task { await auth.signOut() }
                    },
                    onCancel: { confirmSignOut = false }
                )
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
        .toolbarBackground(ACXColor.ground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .acxToast($toast)
        .task { await refreshPermissionFlag() }
    }

    private var header: some View {
        ScreenTitle("Settings")
    }

    private var reminderBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel("Study reminder")

            ACXRow(label: "Daily reminder", detail: "One local notification a day.") {
                Toggle("", isOn: $reminderEnabled)
                    .labelsHidden()
                    .tint(ACXColor.accent)
                    .onChange(of: reminderEnabled) { _, enabled in
                        ProfileSettingsStore.reminderEnabled = enabled
                        Task { await applyReminder() }
                    }
                    .accessibilityLabel("Daily reminder")
            }
            Hairline()

            if reminderEnabled {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Time of day")
                        .font(ACXFont.body(17))
                        .foregroundStyle(ACXColor.ink)
                    SegmentedControl(
                        segments: StudyTime.allCases.map { .init($0, $0.title) },
                        selection: $studyTime,
                        accessibilityTitle: "Reminder time"
                    )
                    .onChange(of: studyTime) { _, value in
                        ProfileSettingsStore.studyTime = value
                        Task { await applyReminder() }
                    }
                }
                .padding(.vertical, 4)
                Hairline()

                // A native Stepper instead of two full-width +/- buttons, which
                // spent a third of the screen on a number between 1 and 7.
                ACXRow(label: "Days per week") {
                    HStack(spacing: 10) {
                        Text("\(daysPerWeek)")
                            .font(ACXFont.bodySemibold(17))
                            .monospacedDigit()
                            .foregroundStyle(ACXColor.ink)
                        Stepper("", value: $daysPerWeek, in: 1...7)
                            .labelsHidden()
                            .onChange(of: daysPerWeek) { _, value in
                                ProfileSettingsStore.daysPerWeek = value
                                Task { await applyReminder() }
                            }
                            .accessibilityLabel("Days per week")
                    }
                }
                Hairline()
            }

            if permissionDenied {
                Text("Notifications are off for AutoCoach. Reminders won't fire until you enable them in iOS Settings — this screen still works.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let reminderStatusLine {
                Text(reminderStatusLine)
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
            }
        }
    }

    private var securityBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Security")
            Hairline()
            Text(auth.email ?? "No email on this account")
                .font(ACXFont.body(15))
                .foregroundStyle(ACXColor.ink)

            Button {
                Task { await sendPasswordReset() }
            } label: {
                Text(passwordBusy ? "Sending…" : "Change password")
            }
            .buttonStyle(GhostButtonStyle())
            .disabled(passwordBusy || auth.email == nil)
            .accessibilityHint("Sends a password reset email")

            if let passwordLine {
                Text(passwordLine)
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
            }
        }
    }

    private var analyticsBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Analytics")
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
                    Text("Product analytics")
                        .font(ACXFont.bodySemibold(15))
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
            SectionLabel("Legal")
            Hairline()
                .padding(.top, 10)
                .padding(.bottom, 8)

            NavigationLink {
                TermsView()
            } label: {
                settingsRow("Terms of service")
            }
            .buttonStyle(.plain)

            NavigationLink {
                PrivacyView()
            } label: {
                settingsRow("Privacy policy")
            }
            .buttonStyle(.plain)
        }
    }

    private var accountBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Account")
            Hairline()

            Button {
                confirmSignOut = true
            } label: {
                Text("Sign out")
                    .font(ACXFont.bodySemibold(15))
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
                    .font(ACXFont.body(15))
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
            .font(ACXFont.body(15))
            .foregroundStyle(ACXColor.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 8)
            .accessibilityLabel("Build version \(buildFooter)")
    }

    private func settingsRow(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(ACXFont.bodySemibold(17))
                .foregroundStyle(ACXColor.ink)
            Spacer()
            Text("→")
                .font(ACXFont.body(15))
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
