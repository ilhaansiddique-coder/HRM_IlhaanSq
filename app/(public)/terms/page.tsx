import type { Metadata } from "next";
import { LegalPage, LegalSection } from "../_components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing use of the HRM SaaS human-resources and payroll platform.",
};

// NOTE FOR THE OPERATOR: this is a starter template. Replace every [bracketed]
// placeholder with your real details and have it reviewed by a qualified lawyer
// before relying on it.
export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" updated="16 June 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
        use of the HRM SaaS platform (the &ldquo;Service&rdquo;) provided by{" "}
        <strong>[Company Legal Name]</strong> (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;). By creating an account or using the Service, you agree
        to these Terms. If you are using the Service on behalf of an
        organisation, you represent that you are authorised to bind that
        organisation.
      </p>

      <LegalSection title="1. Accounts">
        <p>
          You are responsible for the accuracy of the information you provide,
          for keeping your login credentials confidential, and for all activity
          under your account. Notify us promptly of any unauthorised use.
        </p>
      </LegalSection>

      <LegalSection title="2. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in breach of any applicable law.</li>
          <li>Attempt to access data belonging to another customer or workspace.</li>
          <li>Probe, scan, or test the vulnerability of the Service without authorisation.</li>
          <li>Upload malicious code, or disrupt or overload the Service.</li>
          <li>Resell or sublicense the Service without our written consent.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Customer data and responsibilities">
        <p>
          You retain ownership of the data you submit (&ldquo;Customer
          Data&rdquo;), including employee records. You are responsible for
          having a lawful basis to collect and process that data, for its
          accuracy, and for informing your employees as required by law. You
          grant us a limited licence to host and process Customer Data solely to
          provide the Service. Our handling of personal data is described in our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </LegalSection>

      <LegalSection title="4. Availability">
        <p>
          We aim to keep the Service available but do not guarantee
          uninterrupted access. We may perform maintenance, and we may modify or
          discontinue features with reasonable notice where practicable.
        </p>
      </LegalSection>

      <LegalSection title="5. Fees">
        <p>
          Access may be provided free of charge or under a separate written
          arrangement between you and us. Any fees, billing cycle and payment
          terms will be as agreed in that arrangement.
        </p>
      </LegalSection>

      <LegalSection title="6. Suspension and termination">
        <p>
          We may suspend or terminate access if you breach these Terms or use the
          Service in a way that risks harm to others or to the Service. You may
          stop using the Service at any time. On termination, your right to use
          the Service ends and Customer Data is handled as described in the
          Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="7. Disclaimers">
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any
          kind, to the maximum extent permitted by law. Payroll and other
          calculations are tools to assist you; you remain responsible for
          verifying outputs and for compliance with applicable tax and
          employment law.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation of liability">
        <p>
          To the maximum extent permitted by law, we will not be liable for any
          indirect, incidental, or consequential damages, or for loss of
          profits, data, or goodwill. Our total liability arising out of or
          relating to the Service is limited to{" "}
          <strong>[the amount you paid us in the 12 months before the claim, or
          a fixed cap]</strong>.
        </p>
      </LegalSection>

      <LegalSection title="9. Governing law">
        <p>
          These Terms are governed by the laws of{" "}
          <strong>[Country / Jurisdiction]</strong>, and any disputes will be
          subject to the courts of <strong>[Jurisdiction]</strong>.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p>
          We may update these Terms from time to time. We will notify you of
          material changes through the Service or by email. Continued use after
          an update constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Questions about these Terms:{" "}
          <a href="mailto:hello@hrmilhaansq.com">hello@hrmilhaansq.com</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
