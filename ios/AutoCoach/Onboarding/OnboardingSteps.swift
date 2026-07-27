import SwiftUI

/// The four questions and the notification prime (design PRD §5.4 table).
/// One question per screen; every step is skippable.

// MARK: - Step 1 · learning_topics

struct TopicsStep: View {
    let store: OnboardingStore
    @FocusState private var customFocused: Bool

    /// Broad enough to cover what people actually upload, short enough to fit on
    /// one screen without a scroll on the smallest supported device.
    private static let presets = [
        "COMPUTER SCIENCE", "ENGINEERING",
        "MEDICINE", "LAW",
        "BUSINESS", "LANGUAGES",
        "MATHEMATICS", "HISTORY",
        "SCIENCE", "DESIGN",
    ]

    private var columns: [GridItem] {
        [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
    }

    var body: some View {
        OnboardingStepBody(
            kicker: "01 / ONBOARDING",
            title: "What are you studying?",
            subtitle: "Choose up to 3. This shapes the questions we write for you."
        ) {
            VStack(alignment: .leading, spacing: 16) {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(Self.presets, id: \.self) { topic in
                        let isSelected = store.draft.topics.contains(topic)
                        OnboardingChip(
                            title: topic,
                            isSelected: isSelected,
                            isDisabled: !isSelected && !store.draft.canAddTopic
                        ) {
                            store.toggleTopic(topic)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("SOMETHING ELSE")
                        .kickerStyle()
                    TextField(
                        "Type a subject",
                        text: Binding(
                            get: { store.draft.customTopic },
                            set: { store.setCustomTopic($0) }
                        )
                    )
                    .font(ACXFont.body(16))
                    .foregroundStyle(ACXColor.ink)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled(false)
                    .submitLabel(.done)
                    .focused($customFocused)
                    .frame(minHeight: 44)
                    .padding(.horizontal, 12)
                    .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 1))
                    .disabled(store.draft.topics.count >= OnboardingDraft.maxTopics)
                    .opacity(store.draft.topics.count >= OnboardingDraft.maxTopics ? 0.4 : 1)
                    .accessibilityLabel("Something else")
                }

                Text("\(store.draft.topicCount) / \(OnboardingDraft.maxTopics) SELECTED")
                    .font(ACXFont.mono(13))
                    .foregroundStyle(ACXColor.muted)
                    .accessibilityLabel("\(store.draft.topicCount) of \(OnboardingDraft.maxTopics) selected")
            }
        }
        .onTapGesture { customFocused = false }
    }
}

// MARK: - Step 2 · experience_level

struct ExperienceStep: View {
    let store: OnboardingStore

    var body: some View {
        OnboardingStepBody(
            kicker: "02 / ONBOARDING",
            title: "How much do you already know?",
            subtitle: "We start you at the right difficulty instead of wasting a quiz finding out."
        ) {
            VStack(spacing: 10) {
                ForEach(ExperienceLevel.allCases, id: \.self) { level in
                    OnboardingOptionRow(
                        title: level.title,
                        blurb: level.blurb,
                        isSelected: store.draft.experience == level
                    ) {
                        store.select(level)
                    }
                }
            }
        }
    }
}

// MARK: - Step 3 · goal

struct GoalStep: View {
    let store: OnboardingStore

    var body: some View {
        OnboardingStepBody(
            kicker: "03 / ONBOARDING",
            title: "What are you working toward?",
            subtitle: "A deadline changes how we pace the review queue."
        ) {
            VStack(spacing: 10) {
                ForEach(GoalKind.allCases, id: \.self) { goal in
                    OnboardingOptionRow(
                        title: goal.title,
                        blurb: goal.blurb,
                        isSelected: store.draft.goal == goal
                    ) {
                        store.select(goal)
                    }
                }

                if let goal = store.draft.goal, goal.acceptsDate {
                    datePicker
                        .padding(.top, 6)
                }
            }
        }
    }

    private var datePicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("TARGET DATE — OPTIONAL")
                .kickerStyle()

            if let date = store.draft.goalDate {
                HStack(spacing: 12) {
                    DatePicker(
                        "Target date",
                        selection: Binding(
                            get: { date },
                            set: { store.setGoalDate($0) }
                        ),
                        in: Date()...,
                        displayedComponents: .date
                    )
                    .labelsHidden()
                    .datePickerStyle(.compact)

                    Spacer(minLength: 0)

                    Button("CLEAR") { store.setGoalDate(nil) }
                        .font(ACXFont.monoBold(13))
                        .foregroundStyle(ACXColor.muted)
                        .frame(minWidth: 44, minHeight: 44)
                }
            } else {
                Button {
                    // Default a month out — a date the user can drag rather than
                    // an empty control that looks broken.
                    store.setGoalDate(
                        Calendar.current.date(byAdding: .month, value: 1, to: Date()) ?? Date()
                    )
                } label: {
                    Text("ADD A DATE")
                        .font(ACXFont.monoBold(13))
                        .kerning(0.4)
                        .foregroundStyle(ACXColor.ink)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 1))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Step 4 · study_frequency

struct CadenceStep: View {
    let store: OnboardingStore

    var body: some View {
        OnboardingStepBody(
            kicker: "04 / ONBOARDING",
            title: "When will you study?",
            subtitle: "Pick a slot you'll actually keep. We only ever nudge you once a day."
        ) {
            VStack(alignment: .leading, spacing: 24) {
                VStack(spacing: 10) {
                    ForEach(StudyTime.allCases, id: \.self) { time in
                        OnboardingOptionRow(
                            title: time.title,
                            blurb: "Around \(time.clockLabel)",
                            isSelected: store.draft.studyTime == time
                        ) {
                            store.select(time)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("DAYS PER WEEK")
                        .kickerStyle()
                    OnboardingStepper(
                        value: store.draft.daysPerWeek,
                        range: 1...7,
                        unitLabel: "days per week"
                    ) { store.setDaysPerWeek($0) }
                }
            }
        }
    }
}

// MARK: - Notification prime

/// States the benefit *before* the system dialog, then asks — never on launch.
///
/// Denying is a first-class outcome: the flow completes either way and the user
/// keeps every answer they gave.
struct NotificationPrimeStep: View {
    let store: OnboardingStore
    /// Called once the prime is resolved (granted, denied or skipped).
    let onResolved: () -> Void

    @State private var isRequesting = false

    private var summaryLine: String {
        guard let time = store.draft.studyTime else { return "" }
        let days = store.draft.daysPerWeek
        return "\(time.clockLabel) · \(days) DAY\(days == 1 ? "" : "S") A WEEK"
    }

    var body: some View {
        OnboardingStepBody(
            kicker: "05 / ONBOARDING",
            title: "Want a nudge at that time?",
            subtitle: "A single reminder when your queue is due. Nothing else — no streak spam, no marketing, and never more than once a day."
        ) {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("YOUR SLOT")
                        .kickerStyle()
                    Text(summaryLine)
                        .font(ACXFont.monoBold(20, relativeTo: .title3))
                        .foregroundStyle(ACXColor.ink)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .overlay(Rectangle().stroke(ACXColor.ink, lineWidth: 1))

                Text("Reminders are scheduled on this device. AutoCoach does not send push notifications from a server and stores no device token.")
                    .font(ACXFont.body(15))
                    .foregroundStyle(ACXColor.muted)
                    .fixedSize(horizontal: false, vertical: true)

                if case .denied = store.notificationOutcome {
                    Text("NOTIFICATIONS ARE OFF — YOU CAN TURN THEM ON IN SETTINGS")
                        .font(ACXFont.mono(13))
                        .foregroundStyle(ACXColor.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Button {
                    Task { await requestAndSchedule() }
                } label: {
                    Text(isRequesting ? "ASKING…" : "TURN ON REMINDERS")
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(isRequesting)
                .accessibilityHint("Asks iOS for permission to send you one study reminder a day")
            }
        }
    }

    private func requestAndSchedule() async {
        isRequesting = true
        defer { isRequesting = false }

        let granted = await StudyReminderScheduler.requestAuthorization()
        guard granted else {
            store.recordNotificationOutcome(.denied)
            onResolved()
            return
        }
        guard let time = store.draft.studyTime else {
            store.recordNotificationOutcome(.granted(count: 0))
            onResolved()
            return
        }
        let count = await StudyReminderScheduler.schedule(
            time: time,
            daysPerWeek: store.draft.daysPerWeek
        )
        store.recordNotificationOutcome(.granted(count: count))
        onResolved()
    }
}
