import SwiftUI

/// Native Terms of Service (PRD §5.12) — copy carried from the web app.
struct TermsView: View {
    var body: some View {
        LegalDocumentView(
            kicker: "LEGAL / TERMS",
            title: "Terms of Service",
            lastUpdated: "June 11, 2026",
            intro: "These terms govern your use of AutoCoach. By creating an account or using the service you agree to them. If you do not agree, do not use AutoCoach.",
            sections: TermsCopy.sections
        )
    }
}

/// Native Privacy Policy (PRD §5.12) — copy carried from the web app.
struct PrivacyView: View {
    var body: some View {
        LegalDocumentView(
            kicker: "LEGAL / PRIVACY",
            title: "Privacy Policy",
            lastUpdated: "June 11, 2026",
            intro: "AutoCoach (“we”, “us”) is an AI-powered study tool that turns documents you upload into interactive quizzes. This policy explains what data we collect, how we use it, and the choices you have. By using AutoCoach you agree to this policy.",
            sections: PrivacyCopy.sections
        )
    }
}

// MARK: - Shared chrome

private struct LegalSection: Identifiable {
    let id: String
    let title: String
    let blocks: [LegalBlock]
}

private enum LegalBlock {
    case paragraph(String)
    case bullets([String])
}

private struct LegalDocumentView: View {
    let kicker: String
    let title: String
    let lastUpdated: String
    let intro: String
    let sections: [LegalSection]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 10) {
                    Kicker(kicker)
                    Hairline()
                    Text(title)
                        .font(ACXFont.display(28))
                        .foregroundStyle(ACXColor.ink)
                        .padding(.top, 6)
                    Text("Last updated: \(lastUpdated)")
                        .font(ACXFont.mono(13))
                        .foregroundStyle(ACXColor.muted)
                    Text(intro)
                        .font(ACXFont.body(15))
                        .foregroundStyle(ACXColor.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 8)
                }
                .padding(.bottom, 24)

                ForEach(sections) { section in
                    VStack(alignment: .leading, spacing: 12) {
                        Kicker("\(section.id) / \(section.title.uppercased())")
                        Hairline()
                        ForEach(Array(section.blocks.enumerated()), id: \.offset) { _, block in
                            switch block {
                            case .paragraph(let text):
                                Text(text)
                                    .font(ACXFont.body(15))
                                    .foregroundStyle(ACXColor.muted)
                                    .fixedSize(horizontal: false, vertical: true)
                            case .bullets(let items):
                                VStack(alignment: .leading, spacing: 8) {
                                    ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                                        HStack(alignment: .top, spacing: 8) {
                                            Text("–")
                                                .font(ACXFont.mono(13))
                                                .foregroundStyle(ACXColor.ink)
                                            Text(item)
                                                .font(ACXFont.body(15))
                                                .foregroundStyle(ACXColor.muted)
                                                .fixedSize(horizontal: false, vertical: true)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(.bottom, 28)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .scrollContentBackground(.hidden)
        .background(GroundBackground())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(ACXColor.ground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
}

// MARK: - Copy (from frontend/src/app/terms|privacy/page.tsx)

private enum TermsCopy {
    static let contact = "abhaypadmanabhan98@gmail.com"

    static let sections: [LegalSection] = [
        LegalSection(id: "01", title: "The service", blocks: [
            .paragraph("AutoCoach turns documents you upload into AI-generated quizzes and tracks your mastery over time. The service is provided as-is and may change, be interrupted, or be discontinued at any time. Free-tier limits (such as document counts, file sizes, and daily quiz quotas) may be adjusted without notice.")
        ]),
        LegalSection(id: "02", title: "Your content", blocks: [
            .bullets([
                "You keep ownership of documents you upload. You grant us a limited license to store and process them (including via third-party AI providers) solely to provide the service to you.",
                "Only upload content you have the right to use. Do not upload materials that infringe copyright, contain other people’s personal data, or are unlawful."
            ])
        ]),
        LegalSection(id: "03", title: "AI-generated content", blocks: [
            .paragraph("Quiz questions, answers, explanations, and grading are generated by AI and may be inaccurate, incomplete, or misleading. AutoCoach is a study aid, not a source of truth — verify important information against your original materials. Do not rely on it for medical, legal, financial, or safety-critical decisions.")
        ]),
        LegalSection(id: "04", title: "Acceptable use", blocks: [
            .bullets([
                "No attempting to access other users’ data or probe the service for vulnerabilities without permission.",
                "No circumventing rate limits, quotas, or usage restrictions (including via multiple accounts).",
                "No using the service to generate or distribute unlawful or harmful content.",
                "No scraping, reselling, or white-labeling the service without written permission."
            ]),
            .paragraph("We may suspend or terminate accounts that violate these terms.")
        ]),
        LegalSection(id: "05", title: "Account & termination", blocks: [
            .paragraph("You are responsible for safeguarding your account credentials. You may stop using the service at any time and request account deletion by emailing \(contact). We may suspend or terminate accounts for breach of these terms or to protect the service.")
        ]),
        LegalSection(id: "06", title: "Disclaimers & liability", blocks: [
            .paragraph("THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THE SERVICE IS LIMITED TO THE GREATER OF $50 OR THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM. WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, OR FOR LOSS OF DATA.")
        ]),
        LegalSection(id: "07", title: "Privacy", blocks: [
            .paragraph("Our Privacy Policy explains how we handle your data and is part of these terms.")
        ]),
        LegalSection(id: "08", title: "Changes, governing law & contact", blocks: [
            .paragraph("We may update these terms; the date above reflects the latest revision and material changes will be announced in the app. Continued use after changes means acceptance. These terms are governed by the laws of the State of California, USA, without regard to conflict-of-law rules, and any disputes will be resolved in the state or federal courts located in California. Questions: \(contact).")
        ]),
    ]
}

private enum PrivacyCopy {
    static let contact = "abhaypadmanabhan98@gmail.com"

    static let sections: [LegalSection] = [
        LegalSection(id: "01", title: "Data we collect", blocks: [
            .bullets([
                "Account data. Your email address, name, and password (stored as a hash) via our authentication provider, Supabase.",
                "Uploaded documents. PDF and PPTX files you upload, the text extracted from them, AI-generated titles and concept lists, and vector embeddings derived from that text.",
                "Study activity. Quiz sessions, questions, your answers, correctness, mastery scores, XP, and daily usage counts.",
                "Usage analytics. Product events (e.g. “document uploaded”, “quiz started”) collected via PostHog. We strip emails, tokens, and document content from analytics events before they are sent."
            ])
        ]),
        LegalSection(id: "02", title: "How we use your data", blocks: [
            .bullets([
                "To generate quizzes, evaluate answers, and adapt question difficulty to you.",
                "To enforce fair-use limits (daily quotas, file size limits).",
                "To understand product usage and fix problems.",
                "We do not sell your personal data or use it for advertising."
            ])
        ]),
        LegalSection(id: "03", title: "AI processing & subprocessors", blocks: [
            .paragraph("To provide the service, your data is processed by the following third parties acting on our behalf:"),
            .bullets([
                "Supabase — authentication, database, and file storage.",
                "Qdrant Cloud — stores vector embeddings of your document text for retrieval.",
                "Moonshot AI (Kimi) and OpenAI — excerpts of your document text and your free-text quiz answers are sent to these LLM providers to generate questions, extract concepts, create embeddings, and grade answers. We do not permit providers to train on this data under their API terms.",
                "PostHog — product analytics.",
                "Vercel and Railway — application hosting."
            ])
        ]),
        LegalSection(id: "04", title: "Retention & deletion", blocks: [
            .bullets([
                "Deleting a document in the app removes the file, its extracted text chunks, and its vector embeddings.",
                "Account and study data are kept while your account is active. To delete your account and all associated data, email \(contact) — we will complete deletion within 30 days."
            ])
        ]),
        LegalSection(id: "05", title: "Your rights", blocks: [
            .paragraph("Depending on where you live (e.g. GDPR in the EU/UK, CCPA in California), you may have the right to access, correct, export, or delete your personal data, and to object to or restrict certain processing. To exercise any of these rights, email \(contact).")
        ]),
        LegalSection(id: "06", title: "Security", blocks: [
            .paragraph("Data is encrypted in transit (TLS) and at rest by our infrastructure providers. Access to your documents and study data is scoped to your account. No method of storage is 100% secure; we cannot guarantee absolute security.")
        ]),
        LegalSection(id: "07", title: "Children", blocks: [
            .paragraph("AutoCoach is not directed at children under 13 (or the minimum age in your jurisdiction). Do not use the service if you are under that age.")
        ]),
        LegalSection(id: "08", title: "Changes & contact", blocks: [
            .paragraph("We may update this policy and will revise the date above when we do. Material changes will be announced in the app. Questions: \(contact).")
        ]),
    ]
}
