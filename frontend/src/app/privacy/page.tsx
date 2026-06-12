import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — AutoCoach",
  description: "How AutoCoach collects, uses, and protects your data.",
};

const LAST_UPDATED = "June 11, 2026";
const CONTACT_EMAIL = "abhaykerala@gmail.com";

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--line-default)] pt-8 pb-10">
      <p className="kicker mb-2">
        {n} / {title.toUpperCase()}
      </p>
      <div className="space-y-4 text-[14px] leading-relaxed text-[var(--fg-secondary)] [&_strong]:text-[var(--fg-primary)] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--fg-primary)]">
      <main className="mx-auto max-w-[720px] px-6 py-16">
        <p className="kicker mb-3">LEGAL / PRIVACY</p>
        <h1 className="font-display uppercase text-[32px] font-medium tracking-[-0.02em]">
          Privacy Policy
        </h1>
        <p className="mt-2 font-mono text-[12px] text-[var(--fg-tertiary)]">
          Last updated: {LAST_UPDATED}
        </p>

        <p className="mt-8 mb-10 text-[14px] leading-relaxed text-[var(--fg-secondary)]">
          AutoCoach (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an AI-powered study tool that turns
          documents you upload into interactive quizzes. This policy explains what data we collect,
          how we use it, and the choices you have. By using AutoCoach you agree to this policy.
        </p>

        <Section n="01" title="Data we collect">
          <ul>
            <li>
              <strong>Account data.</strong> Your email address, name, and password (stored as a
              hash) via our authentication provider, Supabase.
            </li>
            <li>
              <strong>Uploaded documents.</strong> PDF and PPTX files you upload, the text extracted
              from them, AI-generated titles and concept lists, and vector embeddings derived from
              that text.
            </li>
            <li>
              <strong>Study activity.</strong> Quiz sessions, questions, your answers, correctness,
              mastery scores, XP, and daily usage counts.
            </li>
            <li>
              <strong>Usage analytics.</strong> Product events (e.g. &ldquo;document uploaded&rdquo;,
              &ldquo;quiz started&rdquo;) collected via PostHog. We strip emails, tokens, and
              document content from analytics events before they are sent.
            </li>
          </ul>
        </Section>

        <Section n="02" title="How we use your data">
          <ul>
            <li>To generate quizzes, evaluate answers, and adapt question difficulty to you.</li>
            <li>To enforce fair-use limits (daily quotas, file size limits).</li>
            <li>To understand product usage and fix problems.</li>
            <li>We do <strong>not</strong> sell your personal data or use it for advertising.</li>
          </ul>
        </Section>

        <Section n="03" title="AI processing & subprocessors">
          <p>
            To provide the service, your data is processed by the following third parties acting on
            our behalf:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — authentication, database, and file storage.
            </li>
            <li>
              <strong>Qdrant Cloud</strong> — stores vector embeddings of your document text for
              retrieval.
            </li>
            <li>
              <strong>Moonshot AI (Kimi)</strong> and <strong>OpenAI</strong> — excerpts of your
              document text and your free-text quiz answers are sent to these LLM providers to
              generate questions, extract concepts, create embeddings, and grade answers. We do not
              permit providers to train on this data under their API terms.
            </li>
            <li>
              <strong>PostHog</strong> — product analytics.
            </li>
            <li>
              <strong>Vercel</strong> and <strong>Railway</strong> — application hosting.
            </li>
          </ul>
        </Section>

        <Section n="04" title="Retention & deletion">
          <ul>
            <li>
              Deleting a document in the app removes the file, its extracted text chunks, and its
              vector embeddings.
            </li>
            <li>
              Account and study data are kept while your account is active. To delete your account
              and all associated data, email{" "}
              <a className="text-[var(--accent-text)]" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{" "}
              — we will complete deletion within 30 days.
            </li>
          </ul>
        </Section>

        <Section n="05" title="Your rights">
          <p>
            Depending on where you live (e.g. GDPR in the EU/UK, CCPA in California), you may have
            the right to access, correct, export, or delete your personal data, and to object to or
            restrict certain processing. To exercise any of these rights, email{" "}
            <a className="text-[var(--accent-text)]" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section n="06" title="Security">
          <p>
            Data is encrypted in transit (TLS) and at rest by our infrastructure providers. Access
            to your documents and study data is scoped to your account. No method of storage is
            100% secure; we cannot guarantee absolute security.
          </p>
        </Section>

        <Section n="07" title="Children">
          <p>
            AutoCoach is not directed at children under 13 (or the minimum age in your
            jurisdiction). Do not use the service if you are under that age.
          </p>
        </Section>

        <Section n="08" title="Changes & contact">
          <p>
            We may update this policy and will revise the date above when we do. Material changes
            will be announced in the app. Questions:{" "}
            <a className="text-[var(--accent-text)]" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <div className="border-t border-[var(--line-default)] pt-8 flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--accent-text)] hover:text-[var(--ink)]"
          >
            ← AutoCoach
          </Link>
          <Link
            href="/terms"
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--accent-text)] hover:text-[var(--ink)]"
          >
            Terms of Service →
          </Link>
        </div>
      </main>
    </div>
  );
}
