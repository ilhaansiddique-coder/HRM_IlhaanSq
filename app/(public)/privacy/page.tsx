import type { Metadata } from "next";
import { LegalPage, LegalSection } from "../_components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How HRM SaaS collects, uses, stores and protects personal data, including employee information processed on behalf of customer organisations.",
};

// NOTE FOR THE OPERATOR: this is a starter template. Replace every [bracketed]
// placeholder with your real details and have it reviewed by a qualified lawyer
// before relying on it — especially because you process other companies'
// employee data (you are a "data processor" for your customers).
export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="16 June 2026">
      <p>
        This Privacy Policy explains how <strong>[Company Legal Name]</strong>{" "}
        (&ldquo;HRM SaaS&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects,
        uses and protects personal data when you use our human-resources and
        payroll platform (the &ldquo;Service&rdquo;). We are based in{" "}
        <strong>[Country / Jurisdiction]</strong>.
      </p>

      <LegalSection title="1. Two roles: controller and processor">
        <p>
          We act as a <strong>data controller</strong> for the account holders
          who sign up and administer a workspace (their name, email, login and
          billing-related details). We act as a <strong>data processor</strong>{" "}
          for the employee records that a customer organisation uploads and
          manages inside their workspace (such as names, contact details,
          attendance, leave, salary and payroll information). The customer
          organisation is the controller of that employee data and is
          responsible for having a lawful basis to process it.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <ul>
          <li>
            <strong>Account data</strong> — name, email address, phone number,
            hashed password and role.
          </li>
          <li>
            <strong>Workspace / employee data</strong> — information your
            organisation enters about its employees: identity, department and
            position, attendance and breaks, leave, documents, salary structures
            and payslips.
          </li>
          <li>
            <strong>Usage and technical data</strong> — log data, activity
            history within the app, device/browser information and IP address,
            used to operate and secure the Service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use data">
        <ul>
          <li>To provide, maintain and secure the Service.</li>
          <li>To authenticate users and enforce access controls.</li>
          <li>To respond to support requests and communicate service notices.</li>
          <li>To comply with legal obligations.</li>
        </ul>
        <p>
          We do <strong>not</strong> sell personal data, and we do not use
          customer employee data for advertising.
        </p>
      </LegalSection>

      <LegalSection title="4. Data isolation and security">
        <p>
          Each customer workspace is logically isolated: data is scoped to a
          tenant identifier on every request so one organisation cannot access
          another&rsquo;s data. Passwords are stored hashed. We use reasonable
          technical and organisational measures to protect data; however, no
          system is perfectly secure.
        </p>
      </LegalSection>

      <LegalSection title="5. Sub-processors">
        <p>
          We rely on third-party infrastructure providers to run the Service,
          which may include database hosting, file storage, email delivery and
          error monitoring (for example{" "}
          <strong>[list your providers — e.g. Neon/Supabase, Cloudinary, your
          SMTP provider, Sentry]</strong>). These providers process data only on
          our instructions.
        </p>
      </LegalSection>

      <LegalSection title="6. Data retention">
        <p>
          We retain workspace data for as long as the account is active. When a
          workspace is closed, data is deleted or anonymised within{" "}
          <strong>[retention period, e.g. 30 days]</strong>, unless we are
          required to keep it for legal reasons.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>
          Depending on your jurisdiction, you may have the right to access,
          correct, export or delete your personal data, or to object to certain
          processing. For employee data held in a workspace, please contact the
          employing organisation (the controller). For all other requests,
          contact us using the details below.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be
          notified through the Service or by email. Continued use after an update
          constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          Questions about this policy or your data:{" "}
          <a href="mailto:hello@hrmilhaansq.com">hello@hrmilhaansq.com</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
